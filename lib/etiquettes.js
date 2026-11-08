/** Nom d'étiquette normalisé : première lettre en majuscule, le reste en minuscules (« Haut en calories »). */
export function formaterEtiquette(brut) {
  const t = String(brut ?? '').trim().replace(/\s+/g, ' ').slice(0, 40).toLocaleLowerCase('fr-CA');
  return t ? t[0].toLocaleUpperCase('fr-CA') + t.slice(1) : '';
}

/** Sans accents ni ligatures, en minuscules : « Bœuf » et « Boeuf » donnent « boeuf ». */
const normaliser = (t) =>
  String(t ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Catégories d'étiquettes, dans l'ordre d'affichage. Une étiquette est classée selon son nom :
 * d'abord la liste « base » (nom exact), puis les mots-clés « motifs » (début de mot, sans accents).
 * La première catégorie qui reconnaît l'étiquette l'emporte ; sinon « Autres ».
 */
export const CATEGORIES_ETIQUETTES = [
  {
    id: 'repas',
    titre: 'Type de repas',
    base: ['Déjeuner', 'Brunch', 'Dîner', 'Souper', 'Lunch', 'Entrée', 'Plat', 'Accompagnement', 'Dessert', 'Collation', 'Apéro', 'Boisson'],
    motifs: ['dejeuner', 'brunch', 'diner', 'souper', 'lunch', 'boite a lunch', 'entree', 'plat principal', 'plat', 'accompagnement',
      'dessert', 'collation', 'grignotine', 'apero', 'aperitif', 'boisson', 'cocktail', 'bouchee'],
  },
  {
    id: 'proteines',
    titre: 'Viandes et protéines',
    base: ['Bœuf', 'Poulet', 'Porc', 'Dinde', 'Autre viande', 'Poisson', 'Fruits de mer', 'Végétarien', 'Végane', 'Légumineuses', 'Tofu'],
    motifs: ['boeuf', 'poulet', 'porc', 'dinde', 'veau', 'agneau', 'canard', 'jambon', 'bacon', 'saucisse', 'viande', 'gibier', 'cerf', 'orignal',
      'poisson', 'saumon', 'thon', 'morue', 'tilapia', 'truite', 'aiglefin', 'fruits de mer', 'crevette', 'petoncle', 'homard', 'crabe', 'moule',
      'oeuf', 'vegetarien', 'vegan', 'vegetalien', 'legumineuse', 'lentille', 'pois chiche', 'haricot', 'feve', 'tofu', 'tempeh', 'seitan'],
  },
  {
    id: 'sante',
    titre: 'Santé et nutrition',
    base: ['Léger', 'Santé', 'Nourrissant', 'Riche en protéines', 'Riche en fibres', 'Faible en calories', 'Haut en calories', 'Gras',
      'Sans lactose', 'Sans gluten', 'Sans sucre ajouté', 'Réconfortant'],
    motifs: ['leger', 'sante', 'sain', 'nourrissant', 'rassasiant', 'riche en', 'faible en', 'haut en', 'bas en', 'pauvre en', 'calori',
      'gras', 'proteine', 'fibre', 'sans lactose', 'sans gluten', 'sans sucre', 'sans noix', 'keto', 'ceto', 'reconfort', 'equilibre', 'minceur'],
  },
  {
    id: 'plat',
    titre: 'Type de plat',
    base: ['Pâtes', 'Soupe', 'Salade', 'Riz', 'Sandwich', 'Pizza', 'Mijoté', 'Casserole et gratin', 'Sauté', 'Bol', 'Pain', 'Sauce et vinaigrette', 'Smoothie', 'Pâtisserie'],
    motifs: ['pates', 'spaghetti', 'lasagne', 'macaroni', 'soupe', 'potage', 'creme de', 'veloute', 'salade', 'riz', 'risotto', 'sandwich', 'wrap',
      'burger', 'hamburger', 'pizza', 'taco', 'burrito', 'quesadilla', 'mijote', 'ragout', 'chili', 'casserole', 'gratin', 'pate chinois', 'saute',
      'bol', 'poke', 'pain', 'sauce', 'vinaigrette', 'trempette', 'smoothie', 'gruau', 'crepe', 'gaufre', 'muffin', 'gateau', 'biscuit', 'galette',
      'tarte', 'patisserie', 'brownie', 'carre', 'quiche', 'omelette', 'cremeu', 'brochette', 'grillade', 'tartinade'],
  },
  {
    id: 'pratique',
    titre: 'Pratique',
    base: ['Rapide', 'Facile', 'Sans cuisson', 'Congelable', 'Mijoteuse', 'Autocuiseur', 'Friteuse à air', 'Une seule casserole',
      'Préparer d’avance', 'Économique', 'Pour recevoir'],
    motifs: ['rapide', 'express', 'facile', 'simple', 'sans cuisson', 'congel', 'mijoteuse', 'autocuiseur', 'instant pot', 'friteuse', 'air fryer',
      'une seule', 'one pot', 'avance', 'meal prep', 'restes', 'economique', 'pas cher', 'budget', 'recevoir', 'invites', 'idee ia'],
  },
  {
    id: 'occasions',
    titre: 'Occasions et saisons',
    base: ['Fêtes', 'BBQ', 'Été', 'Hiver', 'Automne', 'Temps des sucres'],
    motifs: ['noel', 'fete', 'reveillon', 'jour de l', 'paques', 'halloween', 'action de grace', 'saint-valentin', 'st-valentin', 'bbq', 'barbecue',
      'ete', 'estival', 'hiver', 'automne', 'printemps', 'saison', 'sucres', 'erable', 'pique-nique', 'camping'],
  },
  {
    id: 'ingredients',
    titre: 'Ingrédients',
    base: ['Légumes', 'Fromage', 'Patate', 'Fruits', 'Chocolat', 'Champignons'],
    motifs: ['legume', 'fromage', 'patate', 'pomme de terre', 'chou', 'brocoli', 'carotte', 'courge', 'courgette', 'epinard', 'tomate', 'oignon',
      'champignon', 'poivron', 'mais', 'fruit', 'banane', 'fraise', 'framboise', 'bleuet', 'pomme', 'citron', 'orange', 'mangue', 'ananas', 'avocat',
      'chocolat', 'cafe', 'vanille', 'cannelle', 'noix', 'arachide', 'amande', 'avoine', 'yogourt', 'yogurt', 'lait', 'creme', 'beurre', 'miel'],
  },
];

export const AUTRES_ETIQUETTES = { id: 'autres', titre: 'Autres', base: [], motifs: [] };

const PAR_NOM = new Map(CATEGORIES_ETIQUETTES.flatMap((c) => c.base.map((n) => [normaliser(n), c])));
// Mot-clé au début d'un mot (« sain » reconnaît « Sain » mais pas « Mais »).
const MOTIFS = CATEGORIES_ETIQUETTES.map((c) => [c, new RegExp(`(^|[^a-z])(${c.motifs.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)]);

/** Catégorie d'une étiquette (objet de CATEGORIES_ETIQUETTES, ou AUTRES_ETIQUETTES). */
export function categorieEtiquette(nom) {
  const n = normaliser(nom);
  return PAR_NOM.get(n) || MOTIFS.find(([, re]) => re.test(n))?.[0] || AUTRES_ETIQUETTES;
}

/**
 * Regroupe des étiquettes par catégorie, dans l'ordre des catégories puis par nom.
 * nomDe : comment lire le nom d'un élément (chaîne par défaut, ou objet { nom }).
 * Retourne [{ categorie, elements }] sans les catégories vides.
 */
export function grouperEtiquettes(elements, nomDe = (e) => (typeof e === 'string' ? e : e.nom)) {
  const groupes = new Map([...CATEGORIES_ETIQUETTES, AUTRES_ETIQUETTES].map((c) => [c.id, { categorie: c, elements: [] }]));
  for (const e of elements) groupes.get(categorieEtiquette(nomDe(e)).id).elements.push(e);
  return [...groupes.values()]
    .filter((g) => g.elements.length)
    .map((g) => ({ ...g, elements: g.elements.sort((a, b) => nomDe(a).localeCompare(nomDe(b), 'fr-CA')) }));
}

/** Étiquettes proposées par défaut (et utilisées par l'étiquetage automatique). */
export const ETIQUETTES_DE_BASE = CATEGORIES_ETIQUETTES.flatMap((c) => c.base);
