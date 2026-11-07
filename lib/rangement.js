/** Clés du rangement par défaut d'un produit (sans dépendance serveur : utilisable partout). */
export function clesRangement({ aliment_id, nom }) {
  const cles = [];
  if (aliment_id) cles.push(`a:${aliment_id}`);
  const n = String(nom || '').trim().toLowerCase().slice(0, 200);
  if (n) cles.push(`n:${n}`);
  return cles;
}

/** Rangement par défaut connu pour ce produit, ou null. `carte` : { cle: emplacement }. */
export function rangementPour(carte, produit) {
  for (const c of clesRangement(produit)) if (carte?.[c]) return carte[c];
  return null;
}
