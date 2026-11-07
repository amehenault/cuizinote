import 'server-only';
import { ErreurHttp } from './http';
import { portionDepuisEtiquette } from './portion';
import { traduireNoms } from './ia';

const arrondi = (v) => (v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

/**
 * Format du contenant complet (ex. : 893 ml, 1,89 L, 400 g), à partir des champs d'Open Food Facts.
 * Converti en g ou ml. Les multiemballages (« 6 x 355 ml ») donnent le total.
 */
export function contenantDepuis(p) {
  const vide = { contenant_qte: null, contenant_unite: null };
  const texte = String(p.quantity || '').toLowerCase().replace(',', '.');
  const m = texte.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|mg|l|dl|cl|ml)\b/);
  const facteurs = { kg: [1000, 'g'], g: [1, 'g'], mg: [0.001, 'g'], l: [1000, 'ml'], dl: [100, 'ml'], cl: [10, 'ml'], ml: [1, 'ml'] };
  let qte = null;
  let unite = null;
  if (m) {
    const [f, u] = facteurs[m[3]];
    qte = Number(m[2]) * f * (m[1] ? Number(m[1]) : 1);
    unite = u;
  } else if (Number(p.product_quantity) > 0) {
    qte = Number(p.product_quantity);
    unite = /^(ml|l|cl|dl)$/i.test(p.product_quantity_unit || '') ? 'ml' : 'g';
  }
  if (!qte || qte > 100000) return vide;
  return { contenant_qte: Math.round(qte * 100) / 100, contenant_unite: unite };
}

/** Recherche un produit par code-barres dans Open Food Facts (base publique et gratuite). */
export async function produitParCodeBarre(code, { traduire = true } = {}) {
  if (!/^[0-9]{6,14}$/.test(code)) throw new ErreurHttp(400, 'Code-barres invalide');
  const champs = 'product_name,product_name_fr,brands,nutriments,serving_quantity,serving_quantity_unit,serving_size,nutrition_data_per,image_front_small_url,product_quantity,product_quantity_unit,quantity';
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
      // Nom français d'Open Food Facts s'il existe, sinon traduction automatique du nom anglais
      nom: p.product_name_fr
        ? String(p.product_name_fr).slice(0, 200)
        : p.product_name
          ? traduire
            ? (await traduireNoms([String(p.product_name).slice(0, 200)]))[0]
            : String(p.product_name).slice(0, 200)
          : 'Produit sans nom',
      marque: p.brands ? String(p.brands).split(',')[0].trim().slice(0, 200) : null,
      code_barre: code,
      kcal_100g: arrondi(kcal),
      proteines_100g: arrondi(n.proteins_100g),
      glucides_100g: arrondi(n.carbohydrates_100g),
      lipides_100g: arrondi(n.fat_100g),
      fibres_100g: arrondi(n.fiber_100g),
      sucres_100g: arrondi(n.sugars_100g),
      sel_100g: arrondi(n.salt_100g),
      sodium_100g: n.sodium_100g != null ? Math.round(Number(n.sodium_100g) * 100000) / 100000 : null,
      portion_g: arrondi(p.serving_quantity),
      portion_texte:
        portionDepuisEtiquette(p.serving_size) ||
        (p.serving_quantity ? `1 portion (${arrondi(p.serving_quantity)} ${p.serving_quantity_unit === 'ml' ? 'ml' : 'g'})` : null),
      // Boissons et liquides : valeurs pour 100 ml
      unite: p.serving_quantity_unit === 'ml' || p.nutrition_data_per === '100ml' ? 'ml' : 'g',
      image_url: image,
      ...contenantDepuis(p),
    };
  } catch (e) {
    if (e instanceof ErreurHttp) throw e;
    throw new ErreurHttp(502, 'Open Food Facts indisponible');
  } finally {
    clearTimeout(minuterie);
  }
}
