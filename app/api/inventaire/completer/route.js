import { LIBELLE_CONTENANT_SQL as LIBELLE_SQL } from '@/lib/colonnes';
import { q } from '@/lib/db';
import { ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { produitParCodeBarre } from '@/lib/openfoodfacts';
import { formatParUpcitemdb } from '@/lib/upcitemdb';

export const maxDuration = 60;

const LOT_OFF = 12;
const EN_PARALLELE = 4;
const LOT_UPC = 5;

// Produits de la personne : ceux qu'elle a ajoutés à la banque et ceux de son inventaire.
const MES_PRODUITS = `(a.utilisateur_id = $1 OR a.id IN (SELECT aliment_id FROM inventaire WHERE utilisateur_id = $1))`;
const A_CHERCHER_OFF = `${MES_PRODUITS} AND a.code_barre IS NOT NULL AND a.contenant_qte IS NULL AND a.contenant_verifie_le IS NULL`;
// Inconnus d'Open Food Facts : cherchés dans UPCitemdb (autre base publique de codes-barres), une fois
const A_CHERCHER_UPC = `${MES_PRODUITS} AND a.code_barre IS NOT NULL AND a.contenant_qte IS NULL
  AND a.contenant_verifie_le IS NOT NULL AND a.contenant_upc_le IS NULL`;


/**
 * Retire les formats estimés (version précédente) : seules les vraies mesures sont gardées.
 * Un format corrigé à la main ensuite (fiche enregistrée après l'estimation) est conservé.
 */
async function retirerEstimations(u) {
  const estime = `a.contenant_estime_le IS NOT NULL AND (a.traduit_le IS NULL OR a.traduit_le < a.contenant_estime_le)`;
  await q(
    `UPDATE inventaire i SET unite = NULL FROM aliments a
      WHERE a.id = i.aliment_id AND i.utilisateur_id = $1 AND ${estime} AND i.quantite = 1 AND i.unite = ${LIBELLE_SQL}`,
    [u]
  );
  // Réessai d'Open Food Facts pour ces produits (un échec passé avait pu mener à l'estimation)
  await q(
    `UPDATE aliments a SET contenant_qte = NULL, contenant_unite = NULL, contenant_estime_le = NULL, contenant_verifie_le = NULL
      WHERE ${MES_PRODUITS} AND ${estime}`,
    [u]
  );
  await q('UPDATE aliments a SET contenant_estime_le = NULL WHERE contenant_estime_le IS NOT NULL AND ' + MES_PRODUITS, [u]);
  // Formats trouvés par l'ancienne recherche Google de l'IA : retirés aussi (sauf corrigés à la main)
  const parIa = `a.contenant_web_le IS NOT NULL AND (a.traduit_le IS NULL OR a.traduit_le < a.contenant_web_le)`;
  await q(
    `UPDATE inventaire i SET unite = NULL FROM aliments a
      WHERE a.id = i.aliment_id AND i.utilisateur_id = $1 AND ${parIa} AND a.contenant_qte > 0
        AND i.quantite = 1 AND i.unite = ${LIBELLE_SQL}`,
    [u]
  );
  await q(`UPDATE aliments a SET contenant_qte = NULL, contenant_unite = NULL WHERE ${MES_PRODUITS} AND ${parIa}`, [u]);
  await q('UPDATE aliments a SET contenant_web_le = NULL WHERE contenant_web_le IS NOT NULL AND ' + MES_PRODUITS, [u]);
  await q(
    `UPDATE inventaire SET unite = NULL, format_estime_le = NULL
      WHERE utilisateur_id = $1 AND format_estime_le IS NOT NULL AND quantite = 1 AND unite LIKE '× %'`,
    [u]
  );
}

/**
 * Complète automatiquement l'inventaire avec les vraies mesures :
 * 1. format du contenant de ses produits par code-barres (Open Food Facts), une fois par produit ;
 * 2. quantités vides : un contenant complet (1 × 893 ml), ou 1 si le format est inconnu.
 * Rend aussi la liste des articles sans format connu, avec la raison.
 * Traite un lot par appel ; le navigateur rappelle tant qu'il en reste.
 */
export const POST = route(async ({ utilisateur }) => {
  await limiter(`completer:${utilisateur.id}`, 200, 3600);
  const u = utilisateur.id;
  await retirerEstimations(u);

  let trouves = 0;
  let erreur = null;
  const nouveaux = [];
  const parCode = await q(`SELECT a.id, a.code_barre FROM aliments a WHERE ${A_CHERCHER_OFF} ORDER BY a.cree_le LIMIT ${LOT_OFF}`, [u]);
  for (let i = 0; i < parCode.length; i += EN_PARALLELE) {
    const resultats = await Promise.all(
      parCode.slice(i, i + EN_PARALLELE).map((a) =>
        produitParCodeBarre(a.code_barre, { traduire: false })
          .then((p) => ({ a, p, reussi: true }))
          .catch((e) => {
            // Code-barres refusé : inutile de réessayer. Sinon (service indisponible), on réessaiera.
            if (e?.statut === 400) return { a, p: null, reussi: true };
            erreur = `Open Food Facts : ${e?.message || e}`;
            return { a, reussi: false };
          })
      )
    );
    for (const { a, p, reussi } of resultats) {
      if (!reussi) continue;
      if (p?.contenant_qte) {
        trouves += 1;
        nouveaux.push(a.id);
      }
      await q(
        `UPDATE aliments SET contenant_qte = coalesce(contenant_qte, $2), contenant_unite = coalesce(contenant_unite, $3),
                contenant_verifie_le = now() WHERE id = $1`,
        [a.id, p?.contenant_qte ?? null, p?.contenant_qte ? p.contenant_unite : null]
      );
    }
  }

  // Pas dans Open Food Facts : UPCitemdb (seulement si rien d'autre à faire dans cet appel ; ~100 recherches par jour)
  if (!parCode.length) {
    const parUpc = await q(
      `SELECT a.id, a.code_barre FROM aliments a WHERE ${A_CHERCHER_UPC} ORDER BY a.cree_le LIMIT ${LOT_UPC}`,
      [u]
    );
    for (const a of parUpc) {
      let contenant;
      try {
        contenant = await formatParUpcitemdb(a.code_barre);
      } catch {
        break; // Service indisponible ou limite du jour atteinte : on réessaiera plus tard.
      }
      if (contenant?.contenant_qte) {
        trouves += 1;
        nouveaux.push(a.id);
      }
      await q(
        `UPDATE aliments SET contenant_qte = coalesce(contenant_qte, $2), contenant_unite = coalesce(contenant_unite, $3),
                contenant_upc_le = now() WHERE id = $1`,
        [a.id, contenant?.contenant_qte ?? null, contenant?.contenant_qte ? contenant.contenant_unite : null]
      );
    }
  }

  // Format trouvé (Open Food Facts ou UPCitemdb) : appliqué à ses articles liés (1 contenant)
  const appliques = nouveaux.length
    ? await q(
        `UPDATE inventaire i SET quantite = 1, unite = ${LIBELLE_SQL}
           FROM aliments a
          WHERE a.id = i.aliment_id AND a.id = ANY($2::uuid[]) AND i.utilisateur_id = $1 AND a.contenant_qte > 0
          RETURNING i.id`,
        [u, nouveaux]
      )
    : [];

  // Quantités vides ou « 1 » sans unité : un contenant complet du produit lié
  const completes = await q(
    `UPDATE inventaire i SET quantite = 1, unite = ${LIBELLE_SQL}
       FROM aliments a
      WHERE a.id = i.aliment_id AND i.utilisateur_id = $1 AND a.contenant_qte > 0
        AND (i.quantite IS NULL OR i.quantite = 1) AND coalesce(i.unite, '') = ''
      RETURNING i.id`,
    [u]
  );
  const uns = await q('UPDATE inventaire SET quantite = 1 WHERE utilisateur_id = $1 AND quantite IS NULL RETURNING id', [u]);

  const [{ restant }] = await q(
    `SELECT (SELECT count(*) FROM aliments a WHERE ${A_CHERCHER_OFF})::int
          + (SELECT count(*) FROM aliments a WHERE ${A_CHERCHER_UPC})::int AS restant`,
    [u]
  );

  // Passage unique : chaque article lié à un produit de format connu devient « 1 × format »
  // (la personne ajuste ensuite la quantité). Les formats trouvés plus tard sont appliqués plus haut.
  const [{ fait }] = await q('SELECT formats_inventaire_le IS NOT NULL AS fait FROM utilisateurs WHERE id = $1', [u]);
  if (!fait) {
    const tous = await q(
      `UPDATE inventaire i SET quantite = 1, unite = ${LIBELLE_SQL}
         FROM aliments a
        WHERE a.id = i.aliment_id AND i.utilisateur_id = $1 AND a.contenant_qte > 0
          AND (i.quantite IS DISTINCT FROM 1 OR i.unite IS DISTINCT FROM ${LIBELLE_SQL})
        RETURNING i.id`,
      [u]
    );
    await q('UPDATE utilisateurs SET formats_inventaire_le = now() WHERE id = $1', [u]);
    completes.push(...tous);
  }

  return ok({ trouves, erreur, quantites: completes.length + uns.length + appliques.length, restant });
});
