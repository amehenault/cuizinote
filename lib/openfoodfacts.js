import 'server-only';
import { ErreurHttp } from './http';
import { portionDepuisEtiquette } from './portion';
import { traduireNoms } from './ia';

const arrondi = (v) => (v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

/**
 * Format du contenant complet (ex. : 893 ml, 1,89 L, 400 g, 8 lb), à partir d'un texte de quantité
 * (champ « quantity » d'Open Food Facts, format d'UPCitemdb...).
 * Garde l'unité de l'emballage : g, kg, ml, L ou lb (onces, cl et dl convertis en g ou ml).
 * Les multiemballages (« 6 x 355 ml ») donnent le total.
 */
export function contenantDepuis(p) {
  const vide = { contenant_qte: null, contenant_unite: null };
  const texte = String(p.quantity || '').toLowerCase().replace(',', '.');
  const m = texte.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|mg|l|dl|cl|ml|fl\.?\s?oz|oz|lbs?|ounces?|pounds?|grams?|millilit(?:re|er)s?|lit(?:re|er)s?)(?![a-z])/);
  const facteurs = {
    kg: [1, 'kg'], g: [1, 'g'], mg: [0.001, 'g'], l: [1, 'L'], dl: [100, 'ml'], cl: [10, 'ml'], ml: [1, 'ml'],
    oz: [28.3495, 'g'], lb: [1, 'lb'], lbs: [1, 'lb'], floz: [29.5735, 'ml'],
  };
  const synonymes = { ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', gram: 'g', grams: 'g' };
  let qte = null;
  let unite = null;
  let imperial = false;
  if (m) {
    const cle = m[3].replace(/[\s.]/g, '');
    const nom = synonymes[cle] || (/^millilit/.test(cle) ? 'ml' : /^lit/.test(cle) ? 'l' : cle);
    const [f, u] = facteurs[nom];
    imperial = ['oz', 'floz'].includes(nom);
    qte = Number(m[2]) * f * (m[1] ? Number(m[1]) : 1);
    unite = u;
  } else if (Number(p.product_quantity) > 0) {
    qte = Number(p.product_quantity);
    unite = /^(ml|l|cl|dl)$/i.test(p.product_quantity_unit || '') ? 'ml' : 'g';
  }
  if (!qte || qte > 100000) return vide;
  // Conversion depuis les onces : arrondi au gramme ou au millilitre près
  return { contenant_qte: imperial ? Math.round(qte) : Math.round(qte * 100) / 100, contenant_unite: unite };
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
    const portion = Number(p.serving_quantity) > 0 ? Number(p.serving_quantity) : null;
    // Étiquette canadienne = valeurs par portion. Quand Open Food Facts les a, on part de celles-ci
    // (ramenées à 100 avec le même poids de portion) : les calories d'une portion sont alors exactement
    // celles de l'étiquette, même si les valeurs « pour 100 g » d'Open Food Facts sont fausses ou mal converties.
    // Un résultat impossible (plus de 100 g pour 100 g) veut dire un poids de portion erroné : valeur pour 100 g d'OFF.
    const pour100 = (cle, max = 100) => {
      const parPortion = Number(n[`${cle}_serving`]);
      if (portion && n[`${cle}_serving`] != null && Number.isFinite(parPortion)) {
        const v = (parPortion * 100) / portion;
        if (v <= max) return v;
      }
      return n[`${cle}_100g`] ?? null;
    };
    const kcal100Off = n['energy-kcal_100g'] ?? (n['energy-kj_100g'] != null ? n['energy-kj_100g'] / 4.184 : n.energy_100g != null ? n.energy_100g / 4.184 : null);
    const kcalServ = n['energy-kcal_serving'] ?? (n['energy-kj_serving'] != null ? n['energy-kj_serving'] / 4.184 : null);
    const kcalDepuisPortion = portion && kcalServ != null ? (Number(kcalServ) * 100) / portion : null;
    // Rien ne dépasse ~900 kcal pour 100 g (l'huile pure)
    const kcal = kcalDepuisPortion != null && kcalDepuisPortion <= 950 ? kcalDepuisPortion : kcal100Off;
    // Unité de la portion d'après l'étiquette : « 1/4 cup (28 g) » est en grammes, même si Open Food Facts dit « ml »
    const uniteEtiquette = String(p.serving_size || '').match(/\d\s*(g|gr|grammes?|ml)\b/i)?.[1]?.toLowerCase();
    const unitePortion = uniteEtiquette ? (uniteEtiquette === 'ml' ? 'ml' : 'g') : p.serving_quantity_unit === 'ml' ? 'ml' : 'g';
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
      proteines_100g: arrondi(pour100('proteins')),
      glucides_100g: arrondi(pour100('carbohydrates')),
      lipides_100g: arrondi(pour100('fat')),
      fibres_100g: arrondi(pour100('fiber')),
      sucres_100g: arrondi(pour100('sugars')),
      sel_100g: arrondi(pour100('salt')),
      sodium_100g: pour100('sodium') != null ? Math.round(Number(pour100('sodium')) * 100000) / 100000 : null,
      portion_g: arrondi(portion),
      portion_texte:
        portionDepuisEtiquette(p.serving_size) ||
        (portion ? `1 portion (${arrondi(portion)} ${unitePortion})` : null),
      // Boissons et liquides : valeurs pour 100 ml
      unite: uniteEtiquette ? unitePortion : p.serving_quantity_unit === 'ml' || p.nutrition_data_per === '100ml' ? 'ml' : 'g',
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
