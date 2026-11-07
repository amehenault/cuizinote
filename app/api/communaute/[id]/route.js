import { obtenirRecetteCommunaute } from '@/lib/recettes';
import { ok, route, verifierUuid } from '@/lib/http';

export const GET = route(async ({ utilisateur, params }) =>
  ok(await obtenirRecetteCommunaute(utilisateur.id, verifierUuid(params.id)))
);
