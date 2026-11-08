import { z } from 'zod';
import { importerDepuisLien, importerDepuisTexte } from '@/lib/import-recette';
import { fetchSecurise } from '@/lib/fetch-securise';
import { enregistrerImage } from '@/lib/images';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';

// Lecture de la page (10 s au plus) puis, si elle n'a pas de données structurées, extraction par l'IA.
export const maxDuration = 60;

const schema = z.object({
  url: z.string().trim().max(2000).optional(),
  texte: z.string().trim().max(30000).optional(),
});

export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`import:${utilisateur.id}`, 30, 3600);
  const { url, texte } = await lireCorps(requete, schema, 100_000);
  if (!url && !texte) throw new ErreurHttp(400, 'Collez un lien ou le texte de la recette');
  const brouillon = texte ? await importerDepuisTexte(texte) : await importerDepuisLien(url);

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
