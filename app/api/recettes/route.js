import { after } from 'next/server';
import { lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { enregistrerRecette, etiqueterAutomatiquement, etiqueterRecette, listerRecettes, recettesAEtiqueter } from '@/lib/recettes';
import { schemaRecette } from '@/lib/schemas';

export const maxDuration = 60;

export const GET = route(async ({ requete, utilisateur }) => {
  const p = requete.nextUrl.searchParams;
  const recettes = await listerRecettes(utilisateur.id, {
    recherche: (p.get('q') || '').slice(0, 100),
    etiquette: (p.get('etiquette') || '').slice(0, 40),
  });
  // Recettes pas encore étiquetées (anciennes, importées, copiées) : rattrapage automatique en arrière-plan,
  // par lots de 10, tant qu'il reste du temps.
  after(async () => {
    const debut = Date.now();
    let apres = null;
    try {
      while (Date.now() - debut < 40000) {
        const lot = await recettesAEtiqueter(utilisateur.id, { limite: 10, apres });
        if (!lot.length) return;
        await limiter(`ia-auto:${utilisateur.id}`, 30, 3600);
        await etiqueterAutomatiquement(utilisateur.id, lot);
        apres = lot.at(-1).id;
      }
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
