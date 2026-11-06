import { q, q1 } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaPas } from '@/lib/schemas';

export const GET = route(async ({ requete, utilisateur }) => {
  const jours = Math.min(Math.max(Number(requete.nextUrl.searchParams.get('jours')) || 30, 7), 3650);
  return ok(
    await q(
      `SELECT id, to_char(jour, 'YYYY-MM-DD') AS jour, nombre, source FROM pas
        WHERE utilisateur_id = $1 AND jour > current_date - $2::int ORDER BY jour`,
      [utilisateur.id, jours]
    )
  );
});

export const POST = route(async ({ requete, utilisateur }) => {
  const p = await lireCorps(requete, schemaPas);
  const ligne = await q1(
    `INSERT INTO pas (utilisateur_id, jour, nombre, source) VALUES ($1,$2,$3,'manuel')
     ON CONFLICT (utilisateur_id, jour) DO UPDATE SET nombre = EXCLUDED.nombre, source = 'manuel'
     RETURNING id`,
    [utilisateur.id, p.jour, p.nombre]
  );
  return ok(ligne, 201);
});
