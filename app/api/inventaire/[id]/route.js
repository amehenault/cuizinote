import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { schemaInventaire } from '@/lib/schemas';
import { COLONNES_INVENTAIRE } from '@/lib/colonnes';

export const PUT = route(async ({ requete, utilisateur, params }) => {
  const i = await lireCorps(requete, schemaInventaire);
  const ligne = await q1(
    `UPDATE inventaire SET emplacement=$1, nom=$2,
            aliment_id=(SELECT id FROM aliments WHERE id = $3),
            quantite=$4, unite=$5, expire_le=$6
      WHERE id=$7 AND utilisateur_id=$8 RETURNING ${COLONNES_INVENTAIRE}`,
    [i.emplacement, i.nom, i.aliment_id, i.quantite, i.unite, i.expire_le, verifierUuid(params.id), utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Article introuvable');
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM inventaire WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
