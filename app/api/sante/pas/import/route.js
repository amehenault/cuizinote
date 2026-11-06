import { z } from 'zod';
import { q } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { lirePasSamsung } from '@/lib/csv';
import { limiter } from '@/lib/limite';

/** Import du fichier CSV de pas exporté depuis Samsung Health. */
export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`import-pas:${utilisateur.id}`, 20, 3600);
  const { csv } = await lireCorps(requete, z.object({ csv: z.string().max(5_000_000) }), 5_200_000);
  const jours = lirePasSamsung(csv).slice(0, 20000);
  if (!jours.length) throw new ErreurHttp(422, 'Aucun nombre de pas reconnu dans ce fichier');
  await q(
    `INSERT INTO pas (utilisateur_id, jour, nombre, source)
     SELECT $1, t.j, t.n, 'samsung' FROM unnest($2::date[], $3::int[]) AS t(j, n)
     ON CONFLICT (utilisateur_id, jour) DO UPDATE SET nombre = EXCLUDED.nombre, source = 'samsung'`,
    [utilisateur.id, jours.map((j) => j.jour), jours.map((j) => j.nombre)]
  );
  return ok({ importes: jours.length });
});
