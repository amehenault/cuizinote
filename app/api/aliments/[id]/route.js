import { q, q1 } from '@/lib/db';
import { verifierImage } from '@/lib/images';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { schemaAliment } from '@/lib/schemas';
import { COLONNES_ALIMENT } from '@/lib/colonnes';
import { modifierAliment } from '@/lib/versions-aliments';

export const GET = route(async ({ utilisateur, params }) => {
  const ligne = await q1(`SELECT ${COLONNES_ALIMENT}, (utilisateur_id = $2) AS mien FROM aliments WHERE id = $1 AND (NOT prive OR utilisateur_id = $2)`, [
    verifierUuid(params.id),
    utilisateur.id,
  ]);
  if (!ligne) throw new ErreurHttp(404, 'Aliment introuvable');
  return ok(ligne);
});

/** Banque commune : tout le monde peut corriger une fiche ; les autres personnes qui l'utilisent choisissent leur version. */
export const PUT = route(async ({ requete, utilisateur, params }) => {
  const id = verifierUuid(params.id);
  const a = await lireCorps(requete, schemaAliment);
  const actuel = await q1('SELECT image_id FROM aliments WHERE id = $1 AND (NOT prive OR utilisateur_id = $2)', [id, utilisateur.id]);
  if (!actuel) throw new ErreurHttp(404, 'Aliment introuvable');
  await verifierImage(utilisateur.id, a.image_id, actuel.image_id);
  return ok(await modifierAliment(utilisateur.id, id, a));
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
