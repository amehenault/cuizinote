import { z } from 'zod';
import { q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { listerPlanification } from '@/lib/planification';
import { schemaPlanification } from '@/lib/schemas';

const date = z.iso.date();

export const GET = route(async ({ requete, utilisateur }) => {
  const p = requete.nextUrl.searchParams;
  const debut = date.safeParse(p.get('debut'));
  const fin = date.safeParse(p.get('fin'));
  if (!debut.success || !fin.success) throw new ErreurHttp(400, 'Période invalide');
  return ok(await listerPlanification(utilisateur.id, debut.data, fin.data));
});

export const POST = route(async ({ requete, utilisateur }) => {
  const d = await lireCorps(requete, schemaPlanification);
  if (d.recette_id) {
    const r = await q1('SELECT 1 FROM recettes WHERE id = $1 AND utilisateur_id = $2', [d.recette_id, utilisateur.id]);
    if (!r) throw new ErreurHttp(400, 'Recette invalide');
  }
  if (d.aliment_id) {
    const a = await q1('SELECT 1 FROM aliments WHERE id = $1 AND utilisateur_id = $2', [d.aliment_id, utilisateur.id]);
    if (!a) throw new ErreurHttp(400, 'Aliment invalide');
  }
  const ligne = await q1(
    `INSERT INTO planification (utilisateur_id, jour, moment, recette_id, aliment_id, libelle, portions, grammes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [utilisateur.id, d.jour, d.moment, d.recette_id, d.recette_id ? null : d.aliment_id, d.libelle, d.portions, d.grammes]
  );
  return ok(ligne, 201);
});
