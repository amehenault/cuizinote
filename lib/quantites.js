/**
 * Ajustement des quantités d'un ingrédient (texte libre) quand on change le nombre de portions.
 * On ajuste la quantité du début (« 1 1/2 tasse », « ½ c. à thé », « 2,5 ml ») et celle qui ouvre
 * une parenthèse (« 110 g (1/2 tasse) »). Le reste ne bouge pas (« 1 boîte de 354 ml » : seul le 1 change).
 */
const FRACTIONS_UNICODE = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const JOLIES = [
  [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'],
];

// Nombre : entier ou décimal, suivi d'une fraction facultative (« 1 1/2 », « 1 ½ »), ou fraction seule
const NOMBRE = String.raw`(?:\d+(?:[.,]\d+)?(?:\s+\d+\/\d+|\s*[¼½¾⅓⅔⅛])?|\d+\/\d+|[¼½¾⅓⅔⅛])`;

export function lireQuantite(texte) {
  let total = 0;
  for (const morceau of texte.trim().split(/\s+|(?=[¼½¾⅓⅔⅛])/)) {
    if (!morceau) continue;
    if (FRACTIONS_UNICODE[morceau] != null) total += FRACTIONS_UNICODE[morceau];
    else if (morceau.includes('/')) {
      const [a, b] = morceau.split('/').map(Number);
      if (!b) return null;
      total += a / b;
    } else total += Number(morceau.replace(',', '.'));
  }
  return Number.isFinite(total) ? total : null;
}

/** Écrit une quantité lisible en cuisine : fractions courantes sous 10, entiers au-dessus. */
export function ecrireQuantite(x) {
  if (x >= 10) return String(Math.round(x));
  const entier = Math.floor(x);
  const reste = x - entier;
  if (reste < 0.04) return String(entier || x.toLocaleString('fr-CA', { maximumFractionDigits: 2 }));
  if (reste > 0.96) return String(entier + 1);
  const proche = JOLIES.find(([v]) => Math.abs(v - reste) < 0.04);
  if (proche) return entier ? `${entier} ${proche[1]}` : proche[1];
  return x.toLocaleString('fr-CA', { maximumFractionDigits: 1 });
}

export function ajusterIngredient(texte, facteur) {
  if (!texte || facteur === 1) return texte;
  const remplacer = () => (tout, avant, nombre) => {
    const n = lireQuantite(nombre);
    return n == null ? tout : `${avant}${ecrireQuantite(n * facteur)}`;
  };
  return texte
    .replace(new RegExp(`^(\\s*)(${NOMBRE})(?=\\s|$|[a-zA-ZÀ-ÿ])`), remplacer())
    .replace(new RegExp(`(\\(\\s*)(${NOMBRE})(?=\\s|\\))`, 'g'), remplacer());
}

/** 1 tasse = 250 ml (tasse métrique canadienne). */
export const ML_PAR_TASSE = 250;

/** Contenance lisible : « 1 ½ tasse (375 ml) ». */
export function libelleContenance(ml) {
  const tasses = ml / ML_PAR_TASSE;
  const t = ecrireQuantite(tasses);
  return `${t} tasse${tasses >= 2 ? 's' : ''} (${Math.round(ml)} ml)`;
}
