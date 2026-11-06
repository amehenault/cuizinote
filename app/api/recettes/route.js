import { enregistrerRecette, listerRecettes } from '@/lib/recettes';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaRecette } from '@/lib/schemas';

export const GET = route(async ({ requete, utilisateur }) => {
  const p = requete.nextUrl.searchParams;
  const recettes = await listerRecettes(utilisateur.id, {
    recherche: (p.get('q') || '').slice(0, 100),
    etiquette: (p.get('etiquette') || '').slice(0, 40),
  });
  return ok(recettes);
});

export const POST = route(async ({ requete, utilisateur }) => {
  const donnees = await lireCorps(requete, schemaRecette);
  const id = await enregistrerRecette(utilisateur.id, donnees);
  return ok({ id }, 201);
});
