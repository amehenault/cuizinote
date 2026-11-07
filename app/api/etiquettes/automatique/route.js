import { z } from 'zod';
import { lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { etiqueterAutomatiquement, recettesAEtiqueter } from '@/lib/recettes';

export const maxDuration = 30;

// Recalcul des étiquettes automatiques de toutes les recettes, par lots de 10 (curseur `apres`).
const schema = z.object({ apres: z.uuid().nullish() });

export const POST = route(async ({ requete, utilisateur }) => {
  const { apres } = await lireCorps(requete, schema);
  await limiter(`ia:${utilisateur.id}`, 40, 3600);
  const lot = await recettesAEtiqueter(utilisateur.id, { apres: apres ?? null, aEtiqueter: false });
  if (!lot.length) return ok({ etiquetees: 0, suivant: null });
  const etiquetees = await etiqueterAutomatiquement(utilisateur.id, lot, { forcer: true });
  return ok({ etiquetees, suivant: lot.length === 10 ? lot.at(-1).id : null });
});
