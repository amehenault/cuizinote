// Portions « comme sur l'étiquette » (ex. : 2 c. à soupe, 15 croustilles, 2 tranches).
// Le poids de la portion (portion_g) reste caché : il sert seulement au calcul des calories.

// Pluriel avant singulier pour garder l'accord (« 3 cookies » -> « 3 biscuits »).
const TRADUCTIONS = [
  [/\btbsps?\b|\btablespoons?\b/gi, 'c. à soupe'],
  [/\btsps?\b|\bteaspoons?\b/gi, 'c. à thé'],
  [/\bcups\b/gi, 'tasses'],
  [/\bcup\b/gi, 'tasse'],
  [/\bslices\b/gi, 'tranches'],
  [/\bslice\b/gi, 'tranche'],
  [/\bpieces\b|\bpcs\b/gi, 'morceaux'],
  [/\bpiece\b|\bpc\b/gi, 'morceau'],
  [/\bcookies\b/gi, 'biscuits'],
  [/\bcookie\b/gi, 'biscuit'],
  [/\bchips\b|\bcrisps\b/gi, 'croustilles'],
  [/\bcrackers\b/gi, 'craquelins'],
  [/\bcracker\b/gi, 'craquelin'],
  [/\bcans\b/gi, 'canettes'],
  [/\bcan\b/gi, 'canette'],
  [/\bbottles\b/gi, 'bouteilles'],
  [/\bbottle\b/gi, 'bouteille'],
  [/\bbars\b/gi, 'barres'],
  [/\bbar\b/gi, 'barre'],
  [/\bservings\b/gi, 'portions'],
  [/\bserving\b/gi, 'portion'],
  [/\bpackets\b|\bpouches\b/gi, 'sachets'],
  [/\bpacket\b|\bpouch\b/gi, 'sachet'],
  [/\b(?:average|avorage|medium|regular)\s+/gi, ''],
  [/\b0[.,]25\b/g, '1/4'],
  [/\b0[.,]5\b/g, '1/2'],
  [/\b0[.,]75\b/g, '3/4'],
  [/\blarge eggs\b/gi, 'gros œufs'],
  [/\blarge egg\b/gi, 'gros œuf'],
  [/\beggs\b/gi, 'œufs'],
  [/\begg\b/gi, 'œuf'],
];

/** « 2 tbsp (32 g) » -> « 2 c. à soupe » ; « 30 g » -> null (simple poids, sans mesure). */
export function portionDepuisEtiquette(texte) {
  if (typeof texte !== 'string') return null;
  let t = texte.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || /^[\d.,\s/]+\s*(g|gr|grammes?|ml|l|kg|oz|mg)\.?$/i.test(t)) return null;
  for (const [motif, francais] of TRADUCTIONS) t = t.replace(motif, francais);
  return t.slice(0, 60) || null;
}

const nombre = (n, d = 0) => Number(n).toLocaleString('fr-CA', { maximumFractionDigits: d });

/** Texte de la portion : « 2 c. à soupe », sinon son poids (« 30 g »), sinon null. */
export function libellePortion(a) {
  if (!a) return null;
  if (a.portion_texte) return a.portion_texte;
  if (a.portion_g) return `${nombre(a.portion_g)} ${a.unite || 'g'}`;
  return null;
}

/** Calories d'une portion, ou null si inconnues. */
export function kcalParPortion(a) {
  if (!a || a.kcal_100g == null || !a.portion_g) return null;
  return (a.kcal_100g * a.portion_g) / 100;
}

/** Résumé court pour les listes : « 190 kcal / 2 c. à soupe » ou « 539 kcal / 100 g ». */
export function resumeCalories(a) {
  if (!a || a.kcal_100g == null) return null;
  const parPortion = kcalParPortion(a);
  if (parPortion != null) return `${nombre(parPortion)} kcal / ${libellePortion(a)}`;
  return `${nombre(a.kcal_100g)} kcal / 100 ${a.unite || 'g'}`;
}

/** « 2 » portions de « 2 c. à soupe » -> « 2 x 2 c. à soupe » ; 1 portion -> « 2 c. à soupe ». */
export function quantiteEnPortions(nbPortions, a) {
  const libelle = libellePortion(a);
  if (!libelle) return null;
  return nbPortions === 1 ? libelle : `${nombre(nbPortions, 2)} x ${libelle}`;
}
