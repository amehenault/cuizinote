/**
 * Texte pour la recherche : minuscules, sans accents ni liaisons.
 * « Œufs », « oeufs » et « OEUFS » donnent tous « oeufs » ; « crème » et « creme » donnent « creme ».
 */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

/** Vrai si `texte` contient `recherche`, sans tenir compte des accents ni des liaisons. */
export const contient = (texte, recherche) => normaliser(texte).includes(normaliser(recherche));

// Liquides qui ne se boivent pas : condiments, sirops, huiles, sauces...
const NON_BOISSONS = /\b(ketchup|moutarde|mayo|mayonnaise|sirop|miel|melasse|sauce|vinaigr|vinaigrette|huile|marinade|tartinade|beurre|extrait|essence|vanille|sriracha|tabasco|salsa|relish|caramel|bouillon|fond|creme (a cuisson|a fouetter|sure|15|35)|cuisson|soupe|potage|creton|trempette|dressing|syrup|oil)\b/;

/** Vrai si l'aliment (valeurs pour 100 ml) est une boisson, faux pour un ketchup, un sirop d'érable, une huile... */
export function estBoisson(aliment) {
  if (aliment?.unite !== 'ml') return false;
  return !NON_BOISSONS.test(normaliser(aliment.nom));
}
