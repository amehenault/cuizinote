import { z } from 'zod';
import { q } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { demanderIdees } from '@/lib/ia';
import { limiter } from '@/lib/limite';
import { EMPLACEMENTS } from '@/lib/schemas';

export const maxDuration = 60;

const schema = z.object({
  demande: z.string().trim().min(1).max(1000),
  emplacements: z.array(z.enum(EMPLACEMENTS)).max(3).default([]),
  historique: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(10)
    .default([]),
});

const chaine = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const nombre = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
const liste = (v, max, long) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.slice(0, long)) : []);

export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`ia:${utilisateur.id}`, 40, 3600);
  const { demande, emplacements, historique } = await lireCorps(requete, schema, 60_000);

  const inventaire = emplacements.length
    ? await q(
        `SELECT nom, quantite::float, unite, emplacement, to_char(expire_le, 'YYYY-MM-DD') AS expire_le
           FROM inventaire WHERE utilisateur_id = $1 AND emplacement = ANY($2::text[])
          ORDER BY expire_le NULLS LAST LIMIT 150`,
        [utilisateur.id, emplacements]
      )
    : [];

  const reponse = await demanderIdees({ demande, inventaire, historique });

  // Le contenu de l'IA est traité comme non fiable : on le filtre avant de le renvoyer.
  const recettes = (Array.isArray(reponse.recettes) ? reponse.recettes : []).slice(0, 10).map((r) => ({
    titre: chaine(r?.titre, 200) || 'Idée de recette',
    description: chaine(r?.description, 1000) || null,
    portions: nombre(r?.portions, 50) || 2,
    temps_preparation: nombre(r?.temps_preparation, 1000),
    temps_cuisson: nombre(r?.temps_cuisson, 1000),
    ingredients: liste(r?.ingredients, 60, 300),
    etapes: liste(r?.etapes, 40, 2000),
    kcal_portion: nombre(r?.kcal_portion, 10000),
    proteines_portion: nombre(r?.proteines_portion, 1000),
    glucides_portion: nombre(r?.glucides_portion, 1000),
    lipides_portion: nombre(r?.lipides_portion, 1000),
    etiquettes: liste(r?.etiquettes, 8, 40).map((e) => e.toLowerCase()),
    manquants: liste(r?.manquants, 30, 200),
  }));

  return ok({ message: chaine(reponse.message, 4000), recettes });
});
