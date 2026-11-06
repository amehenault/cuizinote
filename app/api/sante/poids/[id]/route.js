import { q } from '@/lib/db';
import { ok, route, verifierUuid } from '@/lib/http';

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM poids WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
