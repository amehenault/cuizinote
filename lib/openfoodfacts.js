import 'server-only';
import { ErreurHttp } from './http';

const arrondi = (v) => (v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

/** Recherche un produit par code-barres dans Open Food Facts (base publique et gratuite). */
export async function produitParCodeBarre(code) {
  if (!/^[0-9]{6,14}$/.test(code)) throw new ErreurHttp(400, 'Code-barres invalide');
  const champs = 'product_name,product_name_fr,brands,nutriments,serving_quantity,image_front_small_url';
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), 8000);
  try {
    const reponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${champs}`, {
      headers: { 'User-Agent': 'Cuizinote/1.0 (application personnelle de recettes)' },
      signal: controleur.signal,
    });
    if (reponse.status === 404) return null;
    if (!reponse.ok) throw new ErreurHttp(502, 'Open Food Facts indisponible');
    const donnees = await reponse.json();
    if (donnees.status !== 1 || !donnees.product) return null;
    const p = donnees.product;
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
    const image = typeof p.image_front_small_url === 'string' && p.image_front_small_url.startsWith('https://images.openfoodfacts.org/')
      ? p.image_front_small_url
      : null;
    return {
      nom: (p.product_name_fr || p.product_name || 'Produit sans nom').slice(0, 200),
      marque: p.brands ? String(p.brands).split(',')[0].trim().slice(0, 200) : null,
      code_barre: code,
      kcal_100g: arrondi(kcal),
      proteines_100g: arrondi(n.proteins_100g),
      glucides_100g: arrondi(n.carbohydrates_100g),
      lipides_100g: arrondi(n.fat_100g),
      fibres_100g: arrondi(n.fiber_100g),
      sucres_100g: arrondi(n.sugars_100g),
      sel_100g: arrondi(n.salt_100g),
      portion_g: arrondi(p.serving_quantity),
      image_url: image,
    };
  } catch (e) {
    if (e instanceof ErreurHttp) throw e;
    throw new ErreurHttp(502, 'Open Food Facts indisponible');
  } finally {
    clearTimeout(minuterie);
  }
}
