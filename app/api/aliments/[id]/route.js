import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { schemaAliment } from '@/lib/schemas';
import { COLONNES_ALIMENT } from '@/lib/colonnes';

export const GET = route(async ({ utilisateur, params }) => {
  const ligne = await q1(`SELECT ${COLONNES_ALIMENT} FROM aliments WHERE id = $1 AND utilisateur_id = $2`, [
    verifierUuid(params.id),
    utilisateur.id,
  ]);
  if (!ligne) throw new ErreurHttp(404, 'Aliment introuvable');
  return ok(ligne);
});

export const PUT = route(async ({ requete, utilisateur, params }) => {
  const a = await lireCorps(requete, schemaAliment);
  const ligne = await q1(
    `UPDATE aliments SET nom=$1, marque=$2, code_barre=$3, kcal_100g=$4, proteines_100g=$5, glucides_100g=$6,
            lipides_100g=$7, fibres_100g=$8, sucres_100g=$9, sel_100g=$10, portion_g=$11, image_url=$12
      WHERE id=$13 AND utilisateur_id=$14 RETURNING ${COLONNES_ALIMENT}`,
    [a.nom, a.marque, a.code_barre, a.kcal_100g, a.proteines_100g, a.glucides_100g, a.lipides_100g,
      a.fibres_100g, a.sucres_100g, a.sel_100g, a.portion_g, a.image_url, verifierUuid(params.id), utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Aliment introuvable');
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM aliments WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
