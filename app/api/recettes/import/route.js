import { z } from 'zod';
import { importerDepuisLien } from '@/lib/import-recette';
import { fetchSecurise } from '@/lib/fetch-securise';
import { enregistrerImage } from '@/lib/images';
import { lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';

export const maxDuration = 30;

export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`import:${utilisateur.id}`, 30, 3600);
  const { url } = await lireCorps(requete, z.object({ url: z.string().trim().max(2000) }));
  const brouillon = await importerDepuisLien(url);

  // On rapatrie l'image dans la base pour ne dépendre d'aucun site externe.
  brouillon.image_id = null;
  if (brouillon.image_source) {
    try {
      const { contenu } = await fetchSecurise(brouillon.image_source, {
        binaire: true,
        tailleMax: 2_500_000,
        accepte: 'image/jpeg,image/png,image/webp',
      });
      brouillon.image_id = await enregistrerImage(utilisateur.id, contenu);
    } catch {
      /* image facultative */
    }
  }
  delete brouillon.image_source;
  return ok(brouillon);
});
