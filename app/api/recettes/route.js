import { after } from 'next/server';
import { q } from '@/lib/db';
import { ETIQUETTES_DE_BASE } from '@/lib/etiquettes';
import { lireCorps, ok, route } from '@/lib/http';
import { suggererEtiquettes } from '@/lib/ia';
import { ajouterEtiquettes, enregistrerRecette, listerRecettes, recettesAEtiqueter } from '@/lib/recettes';
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
  // Nouvelle recette sans étiquette : elles sont ajoutées automatiquement, après la réponse.
  if (!donnees.etiquettes.length) {
    after(async () => {
      try {
        const [recette] = await recettesAEtiqueter(utilisateur.id, { seule: id, limite: 1 });
        if (!recette) return;
        const noms = (await q('SELECT nom FROM etiquettes WHERE utilisateur_id = $1', [utilisateur.id])).map((l) => l.nom);
        const [etiquettes] = await suggererEtiquettes([recette], [...new Set([...noms, ...ETIQUETTES_DE_BASE])]);
        await ajouterEtiquettes(utilisateur.id, id, etiquettes);
      } catch (e) {
        console.error('Étiquetage automatique :', e.message);
      }
    });
  }
  return ok({ id }, 201);
});
