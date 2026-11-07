import 'server-only';
import { q, q1, transaction } from './db';
import { ErreurHttp } from './http';
import { COLONNES_ALIMENT, LIBELLE_CONTENANT_SQL } from './colonnes';
import { recalculerJournal } from './planification';

/**
 * Banque d'aliments commune, avec versions.
 * Quand une personne modifie une fiche commune, chaque AUTRE personne qui utilise ce produit garde sa version
 * (copie privée, « version_de ») et reçoit une proposition : garder la sienne ou prendre la nouvelle.
 */

// Champs comparés et copiés (dans l'ordre d'affichage de la comparaison).
export const CHAMPS_ALIMENT = [
  'nom', 'marque', 'kcal_100g', 'proteines_100g', 'glucides_100g', 'lipides_100g', 'fibres_100g', 'sucres_100g',
  'sel_100g', 'sodium_100g', 'portion_g', 'portion_texte', 'unite', 'contenant_qte', 'contenant_unite', 'image_id', 'image_url',
];
const NUMERIQUES = new Set(['kcal_100g', 'proteines_100g', 'glucides_100g', 'lipides_100g', 'fibres_100g', 'sucres_100g',
  'sel_100g', 'sodium_100g', 'portion_g', 'contenant_qte']);

const instantane = (ligne) =>
  Object.fromEntries(CHAMPS_ALIMENT.map((c) => [c, ligne[c] == null ? null : NUMERIQUES.has(c) ? Number(ligne[c]) : ligne[c]]));

/** Références d'une personne vers un aliment, déplacées vers un autre (inventaire, recettes, menu, journal). */
function deplacerReferences(utilisateurId, deId, versId) {
  return [
    ['UPDATE inventaire SET aliment_id = $3 WHERE utilisateur_id = $1 AND aliment_id = $2', [utilisateurId, deId, versId]],
    ['UPDATE planification SET aliment_id = $3 WHERE utilisateur_id = $1 AND aliment_id = $2', [utilisateurId, deId, versId]],
    ['UPDATE journal SET aliment_id = $3 WHERE utilisateur_id = $1 AND aliment_id = $2', [utilisateurId, deId, versId]],
    [
      `UPDATE recette_ingredients ri SET aliment_id = $3 FROM recettes r
        WHERE r.id = ri.recette_id AND r.utilisateur_id = $1 AND ri.aliment_id = $2`,
      [utilisateurId, deId, versId],
    ],
  ];
}

/** Personnes (autres que l'autrice) qui utilisent ce produit, l'ont ajouté ou en gardent leur version. */
async function personnesConcernees(alimentId, auteurId) {
  const lignes = await q(
    `SELECT DISTINCT u FROM (
       SELECT utilisateur_id AS u FROM inventaire WHERE aliment_id = $1
       UNION SELECT utilisateur_id FROM planification WHERE aliment_id = $1
       UNION SELECT utilisateur_id FROM journal WHERE aliment_id = $1
       UNION SELECT r.utilisateur_id FROM recette_ingredients ri JOIN recettes r ON r.id = ri.recette_id WHERE ri.aliment_id = $1
       UNION SELECT utilisateur_id FROM aliments WHERE id = $1
       UNION SELECT utilisateur_id FROM aliments WHERE version_de = $1
     ) x WHERE u <> $2`,
    [alimentId, auteurId]
  );
  return lignes.map((l) => l.u);
}

/**
 * Modifie une fiche. Fiche privée (sa propre version) : simple mise à jour.
 * Fiche commune : les autres personnes concernées gardent leur version et reçoivent une proposition.
 */
export async function modifierAliment(utilisateurId, id, a) {
  const actuel = await q1('SELECT * FROM aliments WHERE id = $1', [id]);
  if (!actuel || (actuel.prive && actuel.utilisateur_id !== utilisateurId)) throw new ErreurHttp(404, 'Aliment introuvable');

  // Une version privée ne porte pas de code-barres (il reste sur la fiche commune).
  const codeBarre = actuel.prive ? null : a.code_barre;
  if (codeBarre) {
    const autre = await q1('SELECT nom FROM aliments WHERE code_barre = $1 AND id <> $2', [codeBarre, id]);
    if (autre) throw new ErreurHttp(409, `Ce code-barres est déjà utilisé par « ${autre.nom} »`);
  }

  if (!actuel.prive) {
    const apres = instantane({ ...a, contenant_unite: a.contenant_qte ? a.contenant_unite || a.unite : null });
    const avantCommun = instantane(actuel);
    const change = CHAMPS_ALIMENT.some((c) => JSON.stringify(avantCommun[c]) !== JSON.stringify(apres[c]));
    if (change) {
      for (const personne of await personnesConcernees(id, utilisateurId)) {
        let copie = await q1('SELECT * FROM aliments WHERE version_de = $1 AND utilisateur_id = $2', [id, personne]);
        const requetes = [];
        if (!copie) {
          // Sa version actuelle (= la fiche commune avant modification) devient une copie privée.
          copie = await q1(
            `INSERT INTO aliments (utilisateur_id, prive, version_de, nom, marque, kcal_100g, proteines_100g, glucides_100g,
                    lipides_100g, fibres_100g, sucres_100g, sel_100g, sodium_100g, portion_g, portion_texte, unite,
                    contenant_qte, contenant_unite, image_id, image_url, traduit_le, contenant_verifie_le, contenant_estime_le, contenant_upc_le)
             SELECT $2, true, id, nom, marque, kcal_100g, proteines_100g, glucides_100g, lipides_100g, fibres_100g, sucres_100g,
                    sel_100g, sodium_100g, portion_g, portion_texte, unite, contenant_qte, contenant_unite, image_id, image_url,
                    now(), now(), now(), now()
               FROM aliments WHERE id = $1
             RETURNING *`,
            [id, personne]
          );
          requetes.push(...deplacerReferences(personne, id, copie.id));
        }
        // Une seule proposition en attente par produit et par personne : la plus récente.
        requetes.push(
          ['DELETE FROM aliments_propositions WHERE destinataire_id = $1 AND aliment_id = $2 AND traitee_le IS NULL', [personne, id]],
          [
            `INSERT INTO aliments_propositions (aliment_id, copie_id, destinataire_id, auteur_id, avant, apres)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
            [id, copie.id, personne, utilisateurId, JSON.stringify(instantane(copie)), JSON.stringify(apres)],
          ]
        );
        await transaction(requetes);
      }
    }
  }

  const ligne = await q1(
    `UPDATE aliments SET nom=$1, marque=$2, code_barre=$3, kcal_100g=$4, proteines_100g=$5, glucides_100g=$6,
            lipides_100g=$7, fibres_100g=$8, sucres_100g=$9, sel_100g=$10, portion_g=$11, image_url=$12, unite=$14,
            portion_texte=$15, sodium_100g=$16, image_id=$17, contenant_qte=$19, contenant_unite=$20, contenant_estime_le=NULL, traduit_le=now()
      WHERE id=$13 RETURNING ${COLONNES_ALIMENT}, (utilisateur_id = $18) AS mien`,
    [a.nom, a.marque, codeBarre, a.kcal_100g, a.proteines_100g, a.glucides_100g, a.lipides_100g,
      a.fibres_100g, a.sucres_100g, a.sel_100g, a.portion_g, a.image_url, id, a.unite, a.portion_texte, a.sodium_100g,
      a.image_id, utilisateurId, a.contenant_qte, a.contenant_qte ? a.contenant_unite || a.unite : null]
  );
  // Les recettes et le menu se recalculent tout seuls ; le journal (déjà mangé) est mis à jour ici.
  await recalculerJournal({ alimentId: id });
  // Format du contenant entré ou modifié : appliqué aux articles de son inventaire liés à ce produit.
  // Une quantité déjà en contenants (« 3 × 893 ml ») est gardée ; sinon elle devient 1 contenant.
  const ancienQte = actuel.contenant_qte == null ? null : Number(actuel.contenant_qte);
  if (ligne.contenant_qte && (ligne.contenant_qte !== ancienQte || ligne.contenant_unite !== actuel.contenant_unite)) {
    await q(
      `UPDATE inventaire i
          SET quantite = CASE WHEN i.unite LIKE '× %' AND i.quantite > 0 THEN i.quantite ELSE 1 END,
              unite = ${LIBELLE_CONTENANT_SQL}
         FROM aliments a
        WHERE a.id = i.aliment_id AND a.id = $1 AND i.utilisateur_id = $2`,
      [id, utilisateurId]
    );
  }
  return ligne;
}

/** Propositions en attente pour une personne (la plus ancienne d'abord). */
export function propositionsEnAttente(utilisateurId) {
  return q(
    `SELECT p.id, p.avant, p.apres, p.cree_le, u.nom AS auteur
       FROM aliments_propositions p JOIN utilisateurs u ON u.id = p.auteur_id
      WHERE p.destinataire_id = $1 AND p.traitee_le IS NULL
      ORDER BY p.cree_le`,
    [utilisateurId]
  );
}

/** Garder sa version (refuser) ou prendre la nouvelle (accepter). */
export async function repondreProposition(utilisateurId, propositionId, accepter) {
  const p = await q1(
    `SELECT p.aliment_id, p.copie_id, (SELECT 1 FROM aliments WHERE id = p.aliment_id) IS NOT NULL AS commun_existe
       FROM aliments_propositions p
      WHERE p.id = $1 AND p.destinataire_id = $2 AND p.traitee_le IS NULL`,
    [propositionId, utilisateurId]
  );
  if (!p) throw new ErreurHttp(404, 'Proposition introuvable');
  const requetes = [];
  if (accepter && p.commun_existe && p.copie_id) {
    // Retour à la fiche commune : ses références quittent la copie privée, qui est supprimée.
    requetes.push(...deplacerReferences(utilisateurId, p.copie_id, p.aliment_id));
    requetes.push(['DELETE FROM aliments WHERE id = $1 AND utilisateur_id = $2 AND prive', [p.copie_id, utilisateurId]]);
  }
  requetes.push([
    'UPDATE aliments_propositions SET traitee_le = now(), acceptee = $2 WHERE id = $1',
    [propositionId, accepter],
  ]);
  await transaction(requetes);
  if (accepter) await recalculerJournal({ alimentId: p.aliment_id });
}
