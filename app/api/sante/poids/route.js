import { q, q1 } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaPoids } from '@/lib/schemas';

export const GET = route(async ({ requete, utilisateur }) => {
  const jours = Math.min(Math.max(Number(requete.nextUrl.searchParams.get('jours')) || 90, 7), 3650);
  return ok(
    await q(
      `SELECT id, mesure_le, poids_kg::float, gras_pct::float, source FROM poids
        WHERE utilisateur_id = $1 AND mesure_le > now() - make_interval(days => $2)
        ORDER BY mesure_le`,
      [utilisateur.id, jours]
    )
  );
});

export const POST = route(async ({ requete, utilisateur }) => {
  const p = await lireCorps(requete, schemaPoids);
  const ligne = await q1(
    `INSERT INTO poids (utilisateur_id, mesure_le, poids_kg, gras_pct, source) VALUES ($1,$2,$3,$4,'manuel')
     ON CONFLICT (utilisateur_id, mesure_le) DO UPDATE SET poids_kg = EXCLUDED.poids_kg, gras_pct = EXCLUDED.gras_pct
     RETURNING id`,
    [utilisateur.id, p.mesure_le, p.poids_kg, p.gras_pct]
  );
  return ok(ligne, 201);
});
