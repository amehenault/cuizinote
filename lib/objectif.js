// Objectif calorique automatique : formule de Mifflin-St Jeor x niveau d'activité, ajusté selon le but.
// Utilisable côté serveur et navigateur (aperçu en direct dans Paramètres).

export const ACTIVITES = [
  { valeur: 'sedentaire', libelle: 'Sédentaire (peu ou pas de sport, travail assis)', facteur: 1.2 },
  { valeur: 'leger', libelle: 'Activité légère (sport 1 à 3 fois par semaine)', facteur: 1.375 },
  { valeur: 'modere', libelle: 'Activité modérée (sport 3 à 5 fois par semaine)', facteur: 1.55 },
  { valeur: 'actif', libelle: 'Activité élevée (sport 6 à 7 fois par semaine)', facteur: 1.725 },
  { valeur: 'tres-actif', libelle: 'Activité très élevée (travail physique + sport)', facteur: 1.9 },
];

export const BUTS = [
  { valeur: 'perte', libelle: 'Perdre du poids (environ 0,5 kg / 1 lb par semaine)', ajustement: -500 },
  { valeur: 'perte-douce', libelle: 'Perdre doucement (environ 0,25 kg / 0,5 lb par semaine)', ajustement: -250 },
  { valeur: 'maintien', libelle: 'Maintenir mon poids', ajustement: 0 },
  { valeur: 'prise', libelle: 'Prendre du poids', ajustement: 300 },
];

export function age(dateNaissance, aujourdhui = new Date()) {
  if (!dateNaissance) return null;
  const n = new Date(`${String(dateNaissance).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(n.getTime())) return null;
  let a = aujourdhui.getFullYear() - n.getFullYear();
  const m = aujourdhui.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && aujourdhui.getDate() < n.getDate())) a -= 1;
  return a;
}

/**
 * Retourne { kcal, metabolisme, depense } ou null s'il manque une donnée.
 * profil : { sexe, date_naissance, taille_cm, activite, but }
 */
export function calculerObjectif(profil, poidsKg) {
  const a = age(profil?.date_naissance);
  const taille = Number(profil?.taille_cm);
  const poids = Number(poidsKg);
  const activite = ACTIVITES.find((x) => x.valeur === profil?.activite);
  const but = BUTS.find((x) => x.valeur === profil?.but);
  if (!profil?.sexe || !a || a < 14 || a > 110 || !taille || !poids || !activite || !but) return null;
  const metabolisme = 10 * poids + 6.25 * taille - 5 * a + (profil.sexe === 'homme' ? 5 : -161);
  const depense = metabolisme * activite.facteur;
  // Plancher de sécurité : jamais sous 1200 kcal (femme) ou 1500 kcal (homme)
  const plancher = profil.sexe === 'homme' ? 1500 : 1200;
  const kcal = Math.max(plancher, Math.round((depense + but.ajustement) / 10) * 10);
  return { kcal, metabolisme: Math.round(metabolisme), depense: Math.round(depense) };
}

/** Objectif à utiliser partout : calculé si le mode est automatique, sinon celui saisi. */
export function objectifEffectif(u) {
  if (u?.objectif_mode === 'auto') {
    return calculerObjectif(u, u.dernier_poids_kg)?.kcal ?? u.objectif_kcal ?? null;
  }
  return u?.objectif_kcal ?? null;
}

// Protéines : poids (kg) x coefficient selon l'âge (apports recommandés, en g par kg de poids).
export const COEFFICIENTS_PROTEINES = [
  { min: 14, max: 18, coefficient: 0.85, libelle: '14 à 18 ans' },
  { min: 19, max: 64, coefficient: 0.8, libelle: '19 à 64 ans' },
  { min: 65, max: 110, coefficient: 1.0, libelle: '65 ans et plus' },
];

/** Retourne { grammes, coefficient, age } ou null s'il manque la date de naissance ou le poids. */
export function calculerProteines(dateNaissance, poidsKg) {
  const a = age(dateNaissance);
  const poids = Number(poidsKg);
  const tranche = COEFFICIENTS_PROTEINES.find((t) => a >= t.min && a <= t.max);
  if (!tranche || !poids) return null;
  return { grammes: Math.round(poids * tranche.coefficient), coefficient: tranche.coefficient, age: a };
}

/** Objectif de protéines à utiliser partout : calculé en mode automatique, sinon celui saisi. */
export function objectifProteinesEffectif(u) {
  if (u?.proteines_mode === 'manuel') return u?.objectif_proteines ?? null;
  return calculerProteines(u?.date_naissance, u?.dernier_poids_kg)?.grammes ?? u?.objectif_proteines ?? null;
}
