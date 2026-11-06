// Lecture d'un export CookMate / My CookBook (.mcb = archive ZIP : un XML + dossier images/).
import { unzipSync, strFromU8 } from 'fflate';

const TAILLE_MAX_FICHIER = 60_000_000;
const TAILLE_MAX_ELEMENT = 15_000_000;

/** Durée libre (« 10 », « 10m », « 15 minutes », « 1 heure », « 1h15 », « 2 h 30 ») en minutes. */
export function dureeEnMinutes(texte) {
  if (!texte) return null;
  const t = texte.toLowerCase().replace(',', '.').trim();
  const heures = t.match(/(\d+(?:\.\d+)?)\s*(?:heures?|hours?|hrs?|h)(?![a-z])/);
  const minutes = t.match(/(\d+)\s*(?:minutes?|mins?|mn|m)\b/);
  const apresH = t.match(/\d+\s*h\s*(\d{1,2})\b/);
  let total = 0;
  if (heures) total += Math.round(Number(heures[1]) * 60);
  if (minutes) total += Number(minutes[1]);
  else if (apresH) total += Number(apresH[1]);
  if (!heures && !minutes) {
    const seul = t.match(/^(\d+)$/);
    if (seul) total = Number(seul[1]);
  }
  return total > 0 && total < 10000 ? total : null;
}

const nombre = (t) => {
  const m = String(t || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Valeurs nutritives « Calories : 296 », « Protéines : 25g »... */
export function lireNutrition(lignes) {
  const r = { kcal_portion: null, proteines_portion: null, glucides_portion: null, lipides_portion: null };
  for (const l of lignes) {
    const t = l.toLowerCase();
    const n = nombre(l.split(/[:=]/).slice(1).join(':') || l);
    if (n == null) continue;
    if (/calor|kcal|énergie|energie/.test(t)) r.kcal_portion = n;
    else if (/prot/.test(t)) r.proteines_portion = n;
    else if (/glucid|carb/.test(t)) r.glucides_portion = n;
    else if (/lipid|gras|fat/.test(t)) r.lipides_portion = n;
  }
  return r;
}

const texteDe = (el, nom) => el.getElementsByTagName(nom)[0]?.textContent?.trim() || '';
const listeDe = (el, nom) => {
  const bloc = el.getElementsByTagName(nom)[0];
  if (!bloc) return [];
  const li = [...bloc.getElementsByTagName('li')].map((x) => x.textContent.trim()).filter(Boolean);
  return li.length ? li : [bloc.textContent.trim()].filter(Boolean);
};
const tousDe = (el, nom) => [...el.getElementsByTagName(nom)].map((x) => x.textContent.trim()).filter(Boolean);

/**
 * Lit le fichier et retourne [{ recette, image: Uint8Array | null }].
 * La recette est au format attendu par l'API /api/recettes.
 */
export function lireExportCookmate(octets) {
  if (octets.length > TAILLE_MAX_FICHIER) throw new Error('Fichier trop volumineux (60 Mo maximum).');
  let fichiers;
  try {
    fichiers = unzipSync(octets, {
      // Protection : on ignore les éléments anormalement gros et ce qui n'est ni XML ni image.
      filter: (f) => f.originalSize <= TAILLE_MAX_ELEMENT && /\.(xml|jpe?g|png|webp)$/i.test(f.name),
    });
  } catch {
    throw new Error('Ce fichier n\'est pas un export CookMate valide (.mcb).');
  }
  const nomXml = Object.keys(fichiers).find((n) => n.toLowerCase().endsWith('.xml'));
  if (!nomXml) throw new Error('Aucune recette trouvée dans ce fichier.');

  const doc = new DOMParser().parseFromString(strFromU8(fichiers[nomXml]), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Le contenu du fichier est illisible.');

  return [...doc.getElementsByTagName('recipe')].slice(0, 2000).map((r) => {
    const commentaires = [
      ...listeDe(r, 'comments'),
      ...listeDe(r, 'source').map((s) => `Source : ${s}`),
    ];
    const note = nombre(texteDe(r, 'rating'));
    const url = texteDe(r, 'url');
    const etiquettes = [...tousDe(r, 'category'), ...tousDe(r, 'tag')]
      .map((e) => e.toLowerCase().slice(0, 40))
      .filter((e, i, l) => e && l.indexOf(e) === i)
      .slice(0, 30);
    const cheminImage = texteDe(r, 'imagepath');

    return {
      recette: {
        titre: (texteDe(r, 'title') || 'Recette sans titre').slice(0, 200),
        description: listeDe(r, 'description').join('\n').slice(0, 5000) || null,
        portions: Math.min(nombre(texteDe(r, 'quantity')) || 1, 200),
        temps_preparation: dureeEnMinutes(texteDe(r, 'preptime')),
        temps_cuisson: dureeEnMinutes(texteDe(r, 'cooktime')),
        etapes: listeDe(r, 'recipetext').slice(0, 100).map((e) => e.slice(0, 5000)),
        ingredients: listeDe(r, 'ingredient').slice(0, 150).map((texte) => ({ texte: texte.slice(0, 300) })),
        source_url: /^https?:\/\//i.test(url) ? url.slice(0, 2000) : null,
        note: note != null && note >= 0 && note <= 5 ? Math.round(note) : null,
        commentaires: commentaires.join('\n').slice(0, 10000) || null,
        etiquettes,
        ...lireNutrition(listeDe(r, 'nutrition')),
      },
      image: cheminImage && fichiers[cheminImage] ? fichiers[cheminImage] : null,
    };
  });
}
