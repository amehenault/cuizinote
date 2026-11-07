import { copierRecette } from '@/lib/recettes';
import { ok, route, verifierUuid } from '@/lib/http';
import { limiter } from '@/lib/limite';

export const POST = route(async ({ utilisateur, params }) => {
  await limiter(`copie:${utilisateur.id}`, 100, 3600);
  const id = await copierRecette(utilisateur.id, verifierUuid(params.id));
  return ok({ id }, 201);
});
