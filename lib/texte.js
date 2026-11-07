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
