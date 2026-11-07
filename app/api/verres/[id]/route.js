import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { schemaVerre } from '@/lib/schemas';

export const PUT = route(async ({ requete, utilisateur, params }) => {
  const d = await lireCorps(requete, schemaVerre);
  const ligne = await q1(
    'UPDATE verres SET nom = $1, ml = $2 WHERE id = $3 AND utilisateur_id = $4 RETURNING id, nom, ml::float',
    [d.nom, d.ml, verifierUuid(params.id), utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Verre introuvable');
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM verres WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
