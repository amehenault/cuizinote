import { q, q1 } from '@/lib/db';
import { verifierImage } from '@/lib/images';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { schemaAliment } from '@/lib/schemas';
import { COLONNES_ALIMENT, LIBELLE_CONTENANT_SQL } from '@/lib/colonnes';
import { recalculerJournal } from '@/lib/planification';

export const GET = route(async ({ utilisateur, params }) => {
  const ligne = await q1(`SELECT ${COLONNES_ALIMENT}, (utilisateur_id = $2) AS mien FROM aliments WHERE id = $1`, [
    verifierUuid(params.id),
    utilisateur.id,
  ]);
  if (!ligne) throw new ErreurHttp(404, 'Aliment introuvable');
  return ok(ligne);
});

/** Banque commune : tout le monde peut corriger une fiche (calories, photo...). */
export const PUT = route(async ({ requete, utilisateur, params }) => {
  const id = verifierUuid(params.id);
  const a = await lireCorps(requete, schemaAliment);
  const actuel = await q1('SELECT image_id, contenant_qte::float, contenant_unite FROM aliments WHERE id = $1', [id]);
  if (!actuel) throw new ErreurHttp(404, 'Aliment introuvable');
  await verifierImage(utilisateur.id, a.image_id, actuel.image_id);
  if (a.code_barre) {
    const autre = await q1('SELECT nom FROM aliments WHERE code_barre = $1 AND id <> $2', [a.code_barre, id]);
    if (autre) throw new ErreurHttp(409, `Ce code-barres est déjà utilisé par « ${autre.nom} »`);
  }
  const ligne = await q1(
    `UPDATE aliments SET nom=$1, marque=$2, code_barre=$3, kcal_100g=$4, proteines_100g=$5, glucides_100g=$6,
            lipides_100g=$7, fibres_100g=$8, sucres_100g=$9, sel_100g=$10, portion_g=$11, image_url=$12, unite=$14,
            portion_texte=$15, sodium_100g=$16, image_id=$17, contenant_qte=$19, contenant_unite=$20, contenant_estime_le=NULL, traduit_le=now()
      WHERE id=$13 RETURNING ${COLONNES_ALIMENT}, (utilisateur_id = $18) AS mien`,
    [a.nom, a.marque, a.code_barre, a.kcal_100g, a.proteines_100g, a.glucides_100g, a.lipides_100g,
      a.fibres_100g, a.sucres_100g, a.sel_100g, a.portion_g, a.image_url, id, a.unite, a.portion_texte, a.sodium_100g,
      a.image_id, utilisateur.id, a.contenant_qte, a.contenant_qte ? a.contenant_unite || a.unite : null]
  );
  // Les recettes et le menu se recalculent tout seuls ; le journal (déjà mangé) est mis à jour ici.
  await recalculerJournal({ alimentId: id });
  // Format du contenant entré ou modifié : appliqué aux articles de son inventaire liés à ce produit.
  // Une quantité déjà en contenants (« 3 × 893 ml ») est gardée ; sinon elle devient 1 contenant.
  if (ligne.contenant_qte && (ligne.contenant_qte !== actuel.contenant_qte || ligne.contenant_unite !== actuel.contenant_unite)) {
    await q(
      `UPDATE inventaire i
          SET quantite = CASE WHEN i.unite LIKE '× %' AND i.quantite > 0 THEN i.quantite ELSE 1 END,
              unite = ${LIBELLE_CONTENANT_SQL}
         FROM aliments a
        WHERE a.id = i.aliment_id AND a.id = $1 AND i.utilisateur_id = $2`,
      [id, utilisateur.id]
    );
  }
  return ok(ligne);
});

/** Seule la personne qui a ajouté l'aliment peut le retirer de la banque commune. */
export const DELETE = route(async ({ utilisateur, params }) => {
  const id = verifierUuid(params.id);
  const ligne = await q1('SELECT utilisateur_id FROM aliments WHERE id = $1', [id]);
  if (!ligne) return ok({ ok: true });
  if (ligne.utilisateur_id !== utilisateur.id) {
    throw new ErreurHttp(403, "Cet aliment a été ajouté par une autre personne : vous pouvez le modifier, mais pas le supprimer.");
  }
  await q('DELETE FROM aliments WHERE id = $1', [id]);
  return ok({ ok: true });
});
