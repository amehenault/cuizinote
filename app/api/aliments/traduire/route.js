import { q } from '@/lib/db';
import { traduireNoms } from '@/lib/ia';
import { ErreurHttp, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';

export const maxDuration = 60;

const LOT = 40;

/**
 * Traduit en français les noms de la banque commune qui n'ont pas encore été vérifiés.
 * Traite jusqu'à 120 aliments par appel ; le navigateur rappelle tant qu'il en reste.
 */
export const POST = route(async ({ utilisateur }) => {
  if (!process.env.GEMINI_API_KEY) throw new ErreurHttp(503, 'Traduction indisponible (GEMINI_API_KEY manquant)');
  await limiter(`traduction:${utilisateur.id}`, 60, 3600);
  const aliments = await q('SELECT id, nom FROM aliments WHERE traduit_le IS NULL ORDER BY cree_le LIMIT 120');
  let traduits = 0;
  for (let i = 0; i < aliments.length; i += LOT) {
    const lot = aliments.slice(i, i + LOT);
    const entree = lot.map((a) => a.nom);
    const noms = await traduireNoms(entree);
    // Échec de l'IA (même tableau rendu) : ce lot sera réessayé plus tard.
    if (noms === entree) continue;
    const changes = lot.filter((a, n) => noms[n] !== a.nom);
    traduits += changes.length;
    await q(
      `UPDATE aliments a SET nom = coalesce(t.nom, a.nom), traduit_le = now()
         FROM unnest($1::uuid[], $2::text[]) AS t(id, nom) WHERE a.id = t.id`,
      [lot.map((a) => a.id), lot.map((a, n) => (noms[n] !== a.nom ? noms[n] : null))]
    );
    // Articles d'inventaire qui portent encore l'ancien nom du produit
    if (changes.length) {
      await q(
        `UPDATE inventaire i SET nom = t.nom
           FROM unnest($1::uuid[], $2::text[], $3::text[]) AS t(id, ancien, nom)
          WHERE i.aliment_id = t.id AND i.nom = t.ancien`,
        [changes.map((a) => a.id), changes.map((a) => a.nom), changes.map((a) => noms[lot.indexOf(a)])]
      );
    }
  }
  const [{ restant }] = await q('SELECT count(*)::int AS restant FROM aliments WHERE traduit_le IS NULL');
  return ok({ traduits, restant });
});
