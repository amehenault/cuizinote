/** Nom d'étiquette normalisé : première lettre en majuscule, le reste en minuscules (« Haut en calories »). */
export function formaterEtiquette(brut) {
  const t = String(brut ?? '').trim().replace(/\s+/g, ' ').slice(0, 40).toLocaleLowerCase('fr-CA');
  return t ? t[0].toLocaleUpperCase('fr-CA') + t.slice(1) : '';
}

/** Étiquettes proposées par défaut (et utilisées par l'étiquetage automatique). */
export const ETIQUETTES_DE_BASE = [
  'Déjeuner', 'Dîner', 'Souper', 'Collation', 'Dessert', 'Lunch',
  'Bœuf', 'Poulet', 'Porc', 'Poisson', 'Fruits de mer', 'Végétarien',
  'Légumes', 'Fromage', 'Pâtes', 'Soupe', 'Salade',
  'Léger', 'Gras', 'Santé', 'Nourrissant', 'Riche en protéines', 'Rapide', 'Congelable',
];
