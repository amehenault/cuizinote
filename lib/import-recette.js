import 'server-only';
import { fetchSecurise } from './fetch-securise';
import { ErreurHttp } from './http';

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', icirc: 'î', ucirc: 'û', deg: '°', frac12: '½', frac14: '¼', frac34: '¾' };

function nettoyer(valeur) {
  if (valeur == null) return '';
  return String(valeur)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, nom) => ENTITES[nom.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convertit une durée ISO 8601 (PT1H30M) en minutes. */
function dureeEnMinutes(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const total = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return total > 0 ? total : null;
}

function nombre(valeur) {
  if (valeur == null) return null;
  const m = String(valeur).replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function premierTexte(valeur) {
  if (Array.isArray(valeur)) return premierTexte(valeur[0]);
  if (valeur && typeof valeur === 'object') return valeur.url || valeur['@id'] || null;
  return valeur || null;
}

function trouverRecette(noeud) {
  if (!noeud || typeof noeud !== 'object') return null;
  if (Array.isArray(noeud)) {
    for (const n of noeud) {
      const r = trouverRecette(n);
      if (r) return r;
    }
    return null;
  }
  const type = noeud['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return noeud;
  if (noeud['@graph']) return trouverRecette(noeud['@graph']);
  if (noeud.mainEntity) return trouverRecette(noeud.mainEntity);
  return null;
}

function aplatirEtapes(instructions) {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return instructions.split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/).map(nettoyer).filter(Boolean);
  }
  if (Array.isArray(instructions)) return instructions.flatMap(aplatirEtapes);
  if (typeof instructions === 'object') {
    if (instructions.itemListElement) return aplatirEtapes(instructions.itemListElement);
    const t = nettoyer(instructions.text || instructions.name);
    return t ? [t] : [];
  }
  return [];
}

function balise(html, propriete) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${propriete}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${propriete}["']`, 'i');
  return nettoyer(html.match(re)?.[1] || html.match(re2)?.[1] || '');
}

/** Lit une page de recette et retourne un brouillon (non enregistré). */
export async function importerDepuisLien(lien) {
  const { contenu: html, url } = await fetchSecurise(lien, { accepte: 'text/html,application/xhtml+xml' });

  let recette = null;
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of scripts) {
    try {
      recette = trouverRecette(JSON.parse(json.trim()));
    } catch {
      /* bloc JSON-LD mal formé : on ignore */
    }
    if (recette) break;
  }

  if (!recette) {
    const titre = balise(html, 'og:title') || nettoyer(html.match(/<title>([^<]*)<\/title>/i)?.[1]);
    if (!titre) throw new ErreurHttp(422, 'Aucune recette détectée sur cette page');
    return {
      titre: titre.slice(0, 200),
      description: balise(html, 'og:description') || null,
      portions: 1,
      temps_preparation: null,
      temps_cuisson: null,
      etapes: [],
      ingredients: [],
      source_url: url,
      image_source: balise(html, 'og:image') || null,
      kcal_portion: null,
      proteines_portion: null,
      glucides_portion: null,
      lipides_portion: null,
      etiquettes: [],
      complet: false,
    };
  }

  const nutrition = recette.nutrition || {};
  const portions = nombre(Array.isArray(recette.recipeYield) ? recette.recipeYield[0] : recette.recipeYield) || 1;
  const motsCles = [recette.recipeCategory, recette.recipeCuisine]
    .flat()
    .filter(Boolean)
    .flatMap((v) => String(v).split(','))
    .map((v) => nettoyer(v).toLowerCase())
    .filter((v) => v && v.length <= 40);

  const image = premierTexte(recette.image);

  return {
    titre: nettoyer(recette.name).slice(0, 200) || 'Recette importée',
    description: nettoyer(recette.description).slice(0, 5000) || null,
    portions: Math.min(portions, 200),
    temps_preparation: dureeEnMinutes(recette.prepTime),
    temps_cuisson: dureeEnMinutes(recette.cookTime),
    etapes: aplatirEtapes(recette.recipeInstructions).slice(0, 100).map((e) => e.slice(0, 5000)),
    ingredients: (recette.recipeIngredient || recette.ingredients || [])
      .map(nettoyer)
      .filter(Boolean)
      .slice(0, 150)
      .map((texte) => ({ texte: texte.slice(0, 300), aliment_id: null, grammes: null })),
    source_url: url,
    image_source: image ? new URL(image, url).toString() : null,
    kcal_portion: nombre(nutrition.calories),
    proteines_portion: nombre(nutrition.proteinContent),
    glucides_portion: nombre(nutrition.carbohydrateContent),
    lipides_portion: nombre(nutrition.fatContent),
    etiquettes: [...new Set(motsCles)].slice(0, 10),
    complet: true,
  };
}
