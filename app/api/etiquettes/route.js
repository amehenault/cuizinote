import { q } from '@/lib/db';
import { ok, route } from '@/lib/http';

export const GET = route(async ({ utilisateur }) =>
  ok(
    await q(
      `SELECT e.id, e.nom, count(re.recette_id)::int AS total
         FROM etiquettes e LEFT JOIN recette_etiquettes re ON re.etiquette_id = e.id
        WHERE e.utilisateur_id = $1 GROUP BY e.id ORDER BY e.nom`,
      [utilisateur.id]
    )
  )
);
