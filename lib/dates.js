const deux = (n) => String(n).padStart(2, '0');

/** Date locale au format AAAA-MM-JJ. */
export function versIso(date = new Date()) {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

export function depuisIso(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function ajouterJours(iso, jours) {
  const d = depuisIso(iso);
  d.setDate(d.getDate() + jours);
  return versIso(d);
}

/** Lundi de la semaine contenant la date. */
export function debutSemaine(iso = versIso()) {
  const d = depuisIso(iso);
  const decalage = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decalage);
  return versIso(d);
}

export function formaterJour(iso, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return depuisIso(iso).toLocaleDateString('fr-CA', options);
}

export function joursRestants(iso) {
  return Math.round((depuisIso(iso) - depuisIso(versIso())) / 86400000);
}

export const MOMENTS = [
  { valeur: 'dejeuner', libelle: 'Déjeuner' },
  { valeur: 'diner', libelle: 'Dîner' },
  { valeur: 'souper', libelle: 'Souper' },
  { valeur: 'dessert', libelle: 'Dessert' },
  { valeur: 'collation', libelle: 'Collation' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const EMPLACEMENTS = [
  { valeur: 'frigo', libelle: 'Frigo' },
  { valeur: 'congelateur', libelle: 'Congélateur' },
  { valeur: 'garde-manger', libelle: 'Garde-manger' },
];

export const nombreFr = (n, decimales = 0) =>
  n == null || Number.isNaN(n) ? '-' : Number(n).toLocaleString('fr-CA', { maximumFractionDigits: decimales });
