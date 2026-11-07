import { z } from 'zod';
import { q } from '@/lib/db';
import { ETIQUETTES_DE_BASE, formaterEtiquette } from '@/lib/etiquettes';
import { lireCorps, ok, route } from '@/lib/http';
import { suggererEtiquettes } from '@/lib/ia';
import { limiter } from '@/lib/limite';
import { ajouterEtiquettes, recettesAEtiqueter } from '@/lib/recettes';

export const maxDuration = 30;

const schema = z.object({
  // Une recette en cours d'écriture (formulaire) : on renvoie seulement les suggestions.
  recette: z
    .object({
      titre: z.string().trim().min(1).max(200),
      description: z.string().max(2000).nullish(),
      ingredients: z.array(z.string().max(300)).max(100).default([]),
      kcal: z.number().nullish(),
      proteines: z.number().nullish(),
      lipides: z.number().nullish(),
      temps_preparation: z.number().nullish(),
      temps_cuisson: z.number().nullish(),
    })
    .optional(),
  // Étiquetage des recettes enregistrées, par lots de 10 (curseur `apres`).
  apres: z.uuid().nullish(),
  toutes: z.boolean().default(false),
});

async function nomsExistants(utilisateurId) {
  const lignes = await q('SELECT nom FROM etiquettes WHERE utilisateur_id = $1 ORDER BY nom', [utilisateurId]);
  return [...new Set([...lignes.map((l) => l.nom), ...ETIQUETTES_DE_BASE])];
}

export const POST = route(async ({ requete, utilisateur }) => {
  const corps = await lireCorps(requete, schema);
  await limiter(`ia:${utilisateur.id}`, 40, 3600);
  const existantes = await nomsExistants(utilisateur.id);

  if (corps.recette) {
    const [etiquettes] = await suggererEtiquettes([corps.recette], existantes);
    return ok({ etiquettes: [...new Set(etiquettes.map(formaterEtiquette).filter(Boolean))] });
  }

  const lot = await recettesAEtiqueter(utilisateur.id, { apres: corps.apres ?? null, sansEtiquettes: !corps.toutes });
  if (!lot.length) return ok({ traitees: 0, etiquetees: 0, suivant: null });
  const suggestions = await suggererEtiquettes(lot, existantes);
  let etiquetees = 0;
  for (let i = 0; i < lot.length; i++) {
    if (!suggestions[i].length) continue;
    await ajouterEtiquettes(utilisateur.id, lot[i].id, suggestions[i]);
    etiquetees++;
  }
  return ok({ traitees: lot.length, etiquetees, suivant: lot.length === 10 ? lot.at(-1).id : null });
});
