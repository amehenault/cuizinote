import { z } from 'zod';
import { q } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { lirePoidsVesync } from '@/lib/csv';
import { limiter } from '@/lib/limite';

/** Import du fichier CSV exporté depuis l'application VeSync. */
export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`import-poids:${utilisateur.id}`, 20, 3600);
  const { csv } = await lireCorps(requete, z.object({ csv: z.string().max(5_000_000) }), 5_200_000);
  const mesures = lirePoidsVesync(csv).slice(0, 20000);
  if (!mesures.length) throw new ErreurHttp(422, 'Aucune pesée reconnue dans ce fichier');
  await q(
    `INSERT INTO poids (utilisateur_id, mesure_le, poids_kg, gras_pct, source)
     SELECT $1, t.m, t.p, t.g, 'vesync' FROM unnest($2::timestamptz[], $3::numeric[], $4::numeric[]) AS t(m, p, g)
     ON CONFLICT (utilisateur_id, mesure_le) DO UPDATE SET poids_kg = EXCLUDED.poids_kg, gras_pct = EXCLUDED.gras_pct`,
    [utilisateur.id, mesures.map((m) => m.mesure_le), mesures.map((m) => m.poids_kg), mesures.map((m) => m.gras_pct)]
  );
  return ok({ importes: mesures.length });
});
