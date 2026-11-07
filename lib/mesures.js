/**
 * Mesures de cuisine (système canadien) pour les ingrédients des recettes.
 * Une mesure est notée « unite:quantite », par exemple « tasse:1/3 » ou « the:1 1/2 ».
 * Conversion en grammes grâce à la portion de l'étiquette (« 1 c. à thé = 3 g ») ou directement en ml pour les liquides.
 */

// Spray : un jet de vaporisateur d'huile rechargeable, environ 0,25 ml (≈ 2 kcal d'huile).
export const ML_PAR_UNITE = { the: 5, soupe: 15, tasse: 250, ml: 1, spray: 0.25 };
const NOMS = {
  the: ['c. à thé', 'c. à thé'],
  soupe: ['c. à soupe', 'c. à soupe'],
  tasse: ['tasse', 'tasses'],
  ml: ['ml', 'ml'],
  spray: ['spray', 'sprays'],
};

const QUANTITES = {
  spray: ['1', '2', '3', '4', '5', '6', '8', '10', '12', '15', '20'],
  the: ['1/8', '1/4', '1/3', '1/2', '2/3', '3/4', '1', '1 1/4', '1 1/2', '2', '2 1/2', '3'],
  soupe: ['1/2', '1', '1 1/2', '2', '2 1/2', '3', '4', '5', '6', '8'],
  tasse: ['1/8', '1/4', '1/3', '1/2', '2/3', '3/4', '1', '1 1/4', '1 1/3', '1 1/2', '1 2/3', '1 3/4', '2', '2 1/4', '2 1/2', '2 3/4', '3', '3 1/2', '4', '5', '6'],
};

const FRACTIONS_UNICODE = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };

function remplacerFractions(texte) {
  let t = String(texte ?? '');
  for (const [u, f] of Object.entries(FRACTIONS_UNICODE)) t = t.split(u).join(` ${f}`);
  return t.replace(/\s+/g, ' ').trim();
}

/** « 1 1/2 », « 1/3 », « 1,5 », « ½ » -> nombre, ou null. */
export function lireQuantiteMesure(texte) {
  const t = remplacerFractions(texte).replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)?(?:\s*(\d+)\/(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const entier = m[1] ? Number(m[1]) : 0;
  const fraction = m[2] ? Number(m[2]) / Number(m[3]) : 0;
  const total = entier + fraction;
  return Number.isFinite(total) && total > 0 ? total : null;
}

const nombreFr = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Millilitres d'une mesure « unite:quantite », ou null. */
export function mlDeMesure(cle) {
  const [unite, qte] = String(cle || '').split(':');
  const q = lireQuantiteMesure(qte);
  return ML_PAR_UNITE[unite] && q ? q * ML_PAR_UNITE[unite] : null;
}

/** « tasse:1/3 » -> « 1/3 tasse (83 ml) ». */
export function libelleMesure(cle, { avecMl = true } = {}) {
  const [unite, qte] = String(cle || '').split(':');
  const q = lireQuantiteMesure(qte);
  if (!NOMS[unite] || !q) return '';
  if (unite === 'ml') return `${nombreFr(q)} ml`;
  const nom = NOMS[unite][(unite === 'tasse' || unite === 'spray') && q > 1 ? 1 : 0];
  const base = `${qte.includes('.') ? nombreFr(q) : qte} ${nom}`;
  const ml = q * ML_PAR_UNITE[unite];
  return avecMl ? `${base} (${ml < 1 ? String(Math.round(ml * 100) / 100).replace('.', ',') : nombreFr(ml)} ml)` : base;
}

/** Huile (« huile », « huiles », « oil ») : on la mesure au spray. */
export const estHuile = (nom) => /(^|[^a-zà-ÿ])(huiles?|oils?)(?![a-zà-ÿ])/i.test(String(nom || ''));

const GROUPE_SPRAY = { titre: 'Spray (vaporisateur)', options: QUANTITES.spray.map((q) => `spray:${q}`) };

/** Groupes du menu pour un aliment : le spray en premier pour les huiles. */
export const groupesPour = (aliment) =>
  estHuile(aliment?.nom ?? aliment?.aliment_nom) ? [GROUPE_SPRAY, ...GROUPES_MESURES] : GROUPES_MESURES;

/** Groupes du menu déroulant : cuillère à thé, cuillère à soupe, tasse. */
export const GROUPES_MESURES = [
  ['the', 'Cuillère à thé'],
  ['soupe', 'Cuillère à soupe'],
  ['tasse', 'Tasse'],
].map(([unite, titre]) => ({ titre, options: QUANTITES[unite].map((q) => `${unite}:${q}`) }));

// Fin de mot qui accepte les lettres accentuées (\b ne les reconnaît pas).
const FIN = '(?![a-zà-ÿ])';
const MOTIFS_UNITES = [
  ['the', new RegExp(`^(?:c\\.?\\s*(?:à|a)\\s*(?:thé|the|café|cafe|t\\.?)|c\\.?à\\.?t\\.?|cuill[eè]res?\\s*(?:à|a)\\s*(?:thé|the|café|cafe)|tsps?|teaspoons?)${FIN}`, 'i')],
  ['soupe', new RegExp(`^(?:c\\.?\\s*(?:à|a)\\s*(?:soupe|table|s\\.?)|c\\.?à\\.?s\\.?|cuill[eè]res?\\s*(?:à|a)\\s*(?:soupe|table)|tbsps?|tablespoons?)${FIN}`, 'i')],
  ['tasse', new RegExp(`^(?:tasses?|cups?)${FIN}`, 'i')],
  ['spray', new RegExp(`^(?:sprays?|vaporisations?|jets?|pschitts?|pulvérisations?)${FIN}`, 'i')],
  ['ml', new RegExp(`^(?:ml|millilitres?)${FIN}`, 'i')],
];

/**
 * Mesure au début d'un texte d'ingrédient : « 1 1/2 tasse de farine » -> « tasse:1 1/2 » ; sinon null.
 * Les ml deviennent une tasse ou une cuillère quand ça tombe juste (250 ml -> 1 tasse).
 */
export function mesureDepuisTexte(texte) {
  const t = remplacerFractions(texte);
  const m = t.match(/^(\d+ \d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  const q = lireQuantiteMesure(m[1]);
  if (!q) return null;
  const reste = m[2].trim();
  for (const [unite, motif] of MOTIFS_UNITES) {
    if (!motif.test(reste)) continue;
    if (unite !== 'ml') {
      // Écriture du menu quand elle existe (1,5 -> « 1 1/2 »)
      const connue = QUANTITES[unite].find((x) => Math.abs(lireQuantiteMesure(x) - q) < 0.01);
      return `${unite}:${connue || String(q)}`;
    }
    // ml : une mesure de cuisine équivalente si elle existe, sinon les ml.
    for (const u of ['tasse', 'soupe', 'the']) {
      const trouve = QUANTITES[u].find((x) => Math.abs(lireQuantiteMesure(x) * ML_PAR_UNITE[u] - q) < 0.01);
      if (trouve) return `${u}:${trouve}`;
    }
    return `ml:${q}`;
  }
  return null;
}

/**
 * Grammes par millilitre pour un aliment : 1 pour un liquide (valeurs pour 100 ml),
 * sinon d'après sa portion d'étiquette exprimée en volume (« 1 c. à thé » = 3 g). null si impossible.
 */
export function grammesParMl(aliment) {
  if (!aliment) return null;
  if (aliment.unite === 'ml') return 1;
  const ml = mlDeMesure(mesureDepuisTexte(aliment.portion_texte));
  if (ml && aliment.portion_g) return aliment.portion_g / ml;
  // Huile sans portion en volume : densité de l'huile (≈ 0,92 g par ml).
  return estHuile(aliment.nom ?? aliment.aliment_nom) ? 0.92 : null;
}

/** Grammes (ou ml pour un liquide) correspondant à une mesure pour cet aliment, ou null. */
export function grammesDeMesure(cle, aliment) {
  const ml = mlDeMesure(cle);
  const parMl = grammesParMl(aliment);
  return ml && parMl ? Math.round(ml * parMl * 100) / 100 : null;
}
