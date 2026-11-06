import { z } from 'zod';
import { q } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';

export const GET = route(async ({ utilisateur }) => ok(utilisateur));

export const PATCH = route(async ({ requete, utilisateur }) => {
  const { objectif_kcal } = await lireCorps(
    requete,
    z.object({ objectif_kcal: z.number().int().min(500).max(10000).nullable() })
  );
  await q('UPDATE utilisateurs SET objectif_kcal = $1 WHERE id = $2', [objectif_kcal, utilisateur.id]);
  return ok({ ok: true });
});
