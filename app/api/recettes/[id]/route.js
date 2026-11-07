import { after } from 'next/server';
import { q } from '@/lib/db';
import { enregistrerRecette, etiqueterRecette, obtenirRecette } from '@/lib/recettes';
import { recalculerJournal } from '@/lib/planification';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { schemaRecette } from '@/lib/schemas';

export const GET = route(async ({ utilisateur, params }) =>
  ok(await obtenirRecette(utilisateur.id, verifierUuid(params.id)))
);

export const PUT = route(async ({ requete, utilisateur, params }) => {
  const id = verifierUuid(params.id);
  const donnees = await lireCorps(requete, schemaRecette);
  await enregistrerRecette(utilisateur.id, donnees, id);
  // Ingrédients, portions ou valeurs changés : les repas déjà mangés de cette recette suivent.
  await recalculerJournal({ recetteId: id });
  // Titre ou ingrédients changés : les étiquettes automatiques sont recalculées.
  after(() => etiqueterRecette(utilisateur.id, id).catch((e) => console.error('Étiquetage automatique :', e.message)));
  return ok({ id });
});

export const DELETE = route(async ({ utilisateur, params }) => {
  const lignes = await q('DELETE FROM recettes WHERE id = $1 AND utilisateur_id = $2 RETURNING image_id', [
    verifierUuid(params.id),
    utilisateur.id,
  ]);
  if (!lignes.length) throw new ErreurHttp(404, 'Recette introuvable');
  if (lignes[0].image_id) {
    await q('DELETE FROM images WHERE id = $1 AND utilisateur_id = $2', [lignes[0].image_id, utilisateur.id]);
  }
  return ok({ ok: true });
});
