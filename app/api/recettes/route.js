import { after } from 'next/server';
import { lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { enregistrerRecette, etiqueterAutomatiquement, etiqueterRecette, listerRecettes, recettesAEtiqueter } from '@/lib/recettes';
import { schemaRecette } from '@/lib/schemas';

export const GET = route(async ({ requete, utilisateur }) => {
  const p = requete.nextUrl.searchParams;
  const recettes = await listerRecettes(utilisateur.id, {
    recherche: (p.get('q') || '').slice(0, 100),
    etiquette: (p.get('etiquette') || '').slice(0, 40),
  });
  // Recettes jamais étiquetées (ex. : importées) : un lot de 10 est étiqueté en arrière-plan à chaque visite.
  after(async () => {
    try {
      const lot = await recettesAEtiqueter(utilisateur.id, { limite: 10 });
      if (!lot.length) return;
      await limiter(`ia-auto:${utilisateur.id}`, 20, 3600);
      await etiqueterAutomatiquement(utilisateur.id, lot);
    } catch (e) {
      if (e?.statut !== 429) console.error('Étiquetage automatique :', e.message);
    }
  });
  return ok(recettes);
});

export const POST = route(async ({ requete, utilisateur }) => {
  const donnees = await lireCorps(requete, schemaRecette);
  const id = await enregistrerRecette(utilisateur.id, donnees);
  after(() => etiqueterRecette(utilisateur.id, id).catch((e) => console.error('Étiquetage automatique :', e.message)));
  return ok({ id }, 201);
});
