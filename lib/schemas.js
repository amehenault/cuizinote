import { z } from 'zod';

const texte = (max) => z.string().trim().max(max);
const texteOpt = (max) => texte(max).nullish().transform((v) => (v ? v : null));
const nombreOpt = (max = 100000) => z.number().min(0).max(max).nullish().transform((v) => v ?? null);
const entierOpt = (max = 100000) => z.number().int().min(0).max(max).nullish().transform((v) => v ?? null);
const uuidOpt = z.uuid().nullish().transform((v) => v ?? null);
const urlOpt = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\//i.test(v), 'URL invalide');

export const schemaInscription = z.object({
  nom: texte(80).min(1),
  courriel: z.email().max(200).transform((v) => v.toLowerCase()),
  motDePasse: z.string().min(12).max(200),
  codeInvitation: z.string().trim().max(100).optional().default(''),
});

export const schemaConnexion = z.object({
  courriel: z.email().max(200).transform((v) => v.toLowerCase()),
  motDePasse: z.string().min(1).max(200),
});

export const schemaRecette = z.object({
  titre: texte(200).min(1),
  description: texteOpt(5000),
  portions: z.number().positive().max(200).default(1),
  temps_preparation: entierOpt(10000),
  temps_cuisson: entierOpt(10000),
  etapes: z.array(texte(5000).min(1)).max(100).default([]),
  source_url: urlOpt,
  image_id: uuidOpt,
  note: z.number().int().min(0).max(5).nullish().transform((v) => v ?? null),
  commentaires: texteOpt(10000),
  kcal_portion: nombreOpt(20000),
  proteines_portion: nombreOpt(2000),
  glucides_portion: nombreOpt(2000),
  lipides_portion: nombreOpt(2000),
  nutrition_manuelle: z.boolean().default(false),
  publiee: z.boolean().default(true),
  ingredients: z
    .array(
      z.object({
        texte: texte(300).min(1),
        aliment_id: uuidOpt,
        grammes: nombreOpt(50000),
        kcal: nombreOpt(50000),
        mesure: z.string().trim().max(30).regex(/^(the|soupe|tasse|ml):[0-9./ ]+$/).nullish().transform((v) => v || null),
      })
    )
    .max(150)
    .default([]),
  etiquettes: z.array(texte(40).min(1)).max(30).default([]),
});

export const schemaAliment = z.object({
  nom: texte(200).min(1),
  marque: texteOpt(200),
  code_barre: z
    .string()
    .trim()
    .regex(/^[0-9]{6,14}$/, 'Code-barres invalide')
    .nullish()
    .transform((v) => v || null),
  kcal_100g: nombreOpt(1000),
  proteines_100g: nombreOpt(100),
  glucides_100g: nombreOpt(100),
  lipides_100g: nombreOpt(100),
  fibres_100g: nombreOpt(100),
  sucres_100g: nombreOpt(100),
  sel_100g: nombreOpt(100),
  sodium_100g: nombreOpt(100),
  portion_g: nombreOpt(5000),
  unite: z.enum(['g', 'ml']).default('g'),
  portion_texte: texteOpt(60),
  contenant_qte: nombreOpt(100000),
  contenant_unite: z.enum(['g', 'kg', 'ml', 'L', 'lb']).nullish().transform((v) => v || null),
  image_id: uuidOpt,
  image_url: urlOpt.refine((v) => v === null || v.startsWith('https://images.openfoodfacts.org/'), 'Image non autorisée'),
});

export const EMPLACEMENTS = ['frigo', 'congelateur', 'garde-manger'];

export const schemaInventaire = z.object({
  emplacement: z.enum(EMPLACEMENTS),
  nom: texte(200).min(1),
  aliment_id: uuidOpt,
  quantite: nombreOpt(100000),
  unite: texteOpt(30),
  expire_le: z.iso.date().nullish().transform((v) => v ?? null),
});

export const MOMENTS = ['dejeuner', 'diner', 'souper', 'dessert', 'collation', 'autre'];

export const schemaPlanification = z
  .object({
    jour: z.iso.date(),
    moment: z.enum(MOMENTS),
    recette_id: uuidOpt,
    aliment_id: uuidOpt,
    libelle: texteOpt(200),
    portions: z.number().positive().max(100).default(1),
    grammes: nombreOpt(10000),
  })
  .refine((v) => v.recette_id || v.aliment_id || v.libelle, 'Choisissez une recette, un aliment ou un libellé');

export const schemaEpicerie = z.object({
  nom: texte(200).min(1),
  quantite: texteOpt(60),
  rayon: texteOpt(60),
});

export const schemaPoids = z.object({
  mesure_le: z.iso.datetime({ offset: true, local: true }).or(z.iso.date()),
  poids_kg: z.number().min(20).max(400),
  gras_pct: nombreOpt(80),
});

export const schemaPas = z.object({
  jour: z.iso.date(),
  nombre: z.number().int().min(0).max(200000),
});

export const schemaJournal = z
  .object({
    jour: z.iso.date(),
    moment: z.enum(MOMENTS),
    recette_id: uuidOpt,
    aliment_id: uuidOpt,
    libelle: texteOpt(200),
    portions: z.number().positive().max(100).default(1),
    grammes: nombreOpt(10000),
    kcal: nombreOpt(20000),
  })
  .refine((v) => v.recette_id || v.aliment_id || v.libelle, 'Choisissez une recette, un aliment ou une description');

const courriel = z.email().max(200).transform((v) => v.toLowerCase());

export const schemaMotDePasseOublie = z.object({ courriel });

export const schemaReinitialisation = z.object({
  jeton: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),
  motDePasse: z.string().min(12).max(200),
});

export const schemaChangementMotDePasse = z.object({
  actuel: z.string().min(1).max(200),
  nouveau: z.string().min(12).max(200),
});

export const schemaSuppressionCompte = z.object({
  motDePasse: z.string().min(1).max(200),
  confirmation: z.literal('SUPPRIMER'),
});

export const schemaCompte = z.object({
  nom: texte(80).min(1).optional(),
  objectif_mode: z.enum(['auto', 'manuel']).optional(),
  objectif_kcal: z.number().int().min(500).max(10000).nullable().optional(),
  sexe: z.enum(['femme', 'homme']).nullable().optional(),
  date_naissance: z.iso.date().nullable().optional(),
  taille_cm: z.number().min(100).max(250).nullable().optional(),
  activite: z.enum(['sedentaire', 'leger', 'modere', 'actif', 'tres-actif']).nullable().optional(),
  but: z.enum(['perte', 'perte-douce', 'maintien', 'prise']).nullable().optional(),
});

export const schemaVerre = z.object({
  nom: texte(80).min(1, 'Donnez un nom au verre'),
  ml: z.number().positive().max(5000),
});
