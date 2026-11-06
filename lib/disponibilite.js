// Correspondance entre un ingrédient (ou un aliment) et l'inventaire.

const normaliser = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/s\b/g, '') // pluriels simples : tomates -> tomate
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Retourne l'article d'inventaire correspondant, ou null.
 * 1. même aliment de la banque ; 2. nom de l'article contenu dans le texte de l'ingrédient ;
 * 3. nom de l'aliment lié contenu dans le nom de l'article.
 */
export function trouverEnInventaire({ texte, aliment_id, aliment_nom, nom }, inventaire) {
  if (aliment_id) {
    const meme = inventaire.find((i) => i.aliment_id === aliment_id);
    if (meme) return meme;
  }
  const cible = normaliser(texte || nom);
  const lie = normaliser(aliment_nom || nom);
  return (
    inventaire.find((i) => {
      const n = normaliser(i.nom);
      if (n.length < 3) return false;
      return cible.includes(n) || (lie.length >= 3 && n.includes(lie));
    }) || null
  );
}

export const LIBELLES_EMPLACEMENT = { frigo: 'frigo', congelateur: 'congélateur', 'garde-manger': 'garde-manger' };
