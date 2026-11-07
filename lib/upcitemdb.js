import 'server-only';
import { contenantDepuis } from './openfoodfacts';

/**
 * Format du contenant d'après UPCitemdb (base publique de codes-barres, sans clé, ~100 recherches par jour).
 * Sert quand Open Food Facts ne donne pas le format. Lit le champ « size », sinon le format écrit dans le titre
 * (ex. : « Becel Original Margarine 907g »). Rend { contenant_qte, contenant_unite } ou null si introuvable.
 * Lève une erreur si le service ne répond pas ou si la limite du jour est atteinte (à réessayer plus tard).
 */
export async function formatParUpcitemdb(code) {
  if (!/^[0-9]{8,14}$/.test(code)) return null;
  const reponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Cuizinote/1.0 (application personnelle de recettes)' },
    signal: AbortSignal.timeout(8000),
  });
  if (reponse.status === 404 || reponse.status === 400) return null;
  if (!reponse.ok) throw new Error(`UPCitemdb ${reponse.status}`);
  const donnees = await reponse.json();
  for (const item of donnees.items || []) {
    for (const texte of [item.size, item.title]) {
      const c = contenantDepuis({ quantity: texte });
      if (c.contenant_qte) return c;
    }
  }
  return null;
}
