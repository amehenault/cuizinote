import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';

const date = z.iso.date();

/**
 * Récapitulatif des calories : total par jour entre deux dates (400 jours au plus), pesées de la période
 * (et de la semaine qui suit, pour la pesée de fin), objectif quotidien et jour de début de semaine choisi.
 */
export const GET = route(async ({ requete, utilisateur }) => {
  const p = requete.nextUrl.searchParams;
  const debut = date.safeParse(p.get('debut'));
  const fin = date.safeParse(p.get('fin'));
  if (!debut.success || !fin.success || fin.data < debut.data) throw new ErreurHttp(400, 'Période invalide');
  if ((new Date(fin.data) - new Date(debut.data)) / 86400000 > 400) throw new ErreurHttp(400, 'Période trop longue (400 jours au plus)');

  const [jours, poids, prefs] = await Promise.all([
    q(
      `SELECT to_char(jour, 'YYYY-MM-DD') AS jour, round(coalesce(sum(kcal), 0))::int AS kcal, count(*)::int AS repas
         FROM journal WHERE utilisateur_id = $1 AND jour BETWEEN $2 AND $3
        GROUP BY jour ORDER BY jour`,
      [utilisateur.id, debut.data, fin.data]
    ),
    q(
      `SELECT mesure_le, poids_kg::float FROM poids
        WHERE utilisateur_id = $1 AND mesure_le >= $2::date - 1 AND mesure_le < $3::date + 9
        ORDER BY mesure_le`,
      [utilisateur.id, debut.data, fin.data]
    ),
    q1('SELECT recap_debut_semaine FROM utilisateurs WHERE id = $1', [utilisateur.id]),
  ]);
  return ok({ jours, poids, objectif: utilisateur.objectif_kcal ?? null, debut_semaine: prefs?.recap_debut_semaine ?? 1 });
});

/** Jour où commence la semaine du récapitulatif (ex. : 2 = mardi, jour de la pesée). */
export const PUT = route(async ({ requete, utilisateur }) => {
  const { debut_semaine } = await lireCorps(requete, z.object({ debut_semaine: z.number().int().min(0).max(6) }));
  await q('UPDATE utilisateurs SET recap_debut_semaine = $1 WHERE id = $2', [debut_semaine, utilisateur.id]);
  return ok({ debut_semaine });
});
