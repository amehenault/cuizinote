import { enregistrerImage, TAILLE_MAX_IMAGE } from '@/lib/images';
import { ErreurHttp, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';

export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`image:${utilisateur.id}`, 60, 3600);
  const taille = Number(requete.headers.get('content-length') || 0);
  if (taille > TAILLE_MAX_IMAGE + 10_000) throw new ErreurHttp(413, 'Image trop volumineuse');
  const formulaire = await requete.formData();
  const fichier = formulaire.get('image');
  if (!fichier || typeof fichier === 'string') throw new ErreurHttp(400, 'Image manquante');
  const id = await enregistrerImage(utilisateur.id, Buffer.from(await fichier.arrayBuffer()));
  return ok({ id }, 201);
});
