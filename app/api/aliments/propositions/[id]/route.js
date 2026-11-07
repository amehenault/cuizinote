import { z } from 'zod';
import { lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { repondreProposition } from '@/lib/versions-aliments';

const schema = z.object({ accepter: z.boolean() });

/** Prendre la nouvelle version (accepter: true) ou garder la mienne (false). */
export const POST = route(async ({ requete, utilisateur, params }) => {
  const { accepter } = await lireCorps(requete, schema);
  await repondreProposition(utilisateur.id, verifierUuid(params.id), accepter);
  return ok({ ok: true });
});
