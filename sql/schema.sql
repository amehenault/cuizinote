-- Cuizinote - schéma PostgreSQL (Neon)
-- Idempotent : peut être exécuté plusieurs fois.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courriel      text NOT NULL UNIQUE,
  nom           text NOT NULL,
  mot_de_passe  text NOT NULL,
  objectif_kcal integer,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

-- Le jeton de session n'est jamais stocké en clair : seulement son empreinte SHA-256.
CREATE TABLE IF NOT EXISTS sessions (
  empreinte      text PRIMARY KEY,
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  expire_le      timestamptz NOT NULL,
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_utilisateur_idx ON sessions(utilisateur_id);

CREATE TABLE IF NOT EXISTS limites_requetes (
  id      bigserial PRIMARY KEY,
  cle     text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS limites_requetes_cle_idx ON limites_requetes(cle, cree_le);

CREATE TABLE IF NOT EXISTS images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type_mime      text NOT NULL,
  donnees        text NOT NULL, -- base64
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS images_utilisateur_idx ON images(utilisateur_id);

CREATE TABLE IF NOT EXISTS etiquettes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  UNIQUE (utilisateur_id, nom)
);

CREATE TABLE IF NOT EXISTS aliments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  marque         text,
  code_barre     text,
  kcal_100g      numeric(8,2),
  proteines_100g numeric(8,2),
  glucides_100g  numeric(8,2),
  lipides_100g   numeric(8,2),
  fibres_100g    numeric(8,2),
  sucres_100g    numeric(8,2),
  sel_100g       numeric(8,2),
  portion_g      numeric(8,2),
  image_url      text,
  cree_le        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, code_barre)
);
CREATE INDEX IF NOT EXISTS aliments_utilisateur_idx ON aliments(utilisateur_id, nom);

CREATE TABLE IF NOT EXISTS recettes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id     uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre              text NOT NULL,
  description        text,
  portions           numeric(6,2) NOT NULL DEFAULT 1,
  temps_preparation  integer,
  temps_cuisson      integer,
  etapes             jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url         text,
  image_id           uuid REFERENCES images(id) ON DELETE SET NULL,
  note               smallint CHECK (note BETWEEN 0 AND 5),
  commentaires       text,
  -- Valeurs nutritives par portion (saisies ou importées)
  kcal_portion       numeric(8,2),
  proteines_portion  numeric(8,2),
  glucides_portion   numeric(8,2),
  lipides_portion    numeric(8,2),
  cree_le            timestamptz NOT NULL DEFAULT now(),
  modifie_le         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recettes_utilisateur_idx ON recettes(utilisateur_id, titre);

CREATE TABLE IF NOT EXISTS recette_ingredients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recette_id uuid NOT NULL REFERENCES recettes(id) ON DELETE CASCADE,
  position   integer NOT NULL,
  texte      text NOT NULL,
  aliment_id uuid REFERENCES aliments(id) ON DELETE SET NULL,
  grammes    numeric(8,2)
);
CREATE INDEX IF NOT EXISTS recette_ingredients_recette_idx ON recette_ingredients(recette_id, position);

CREATE TABLE IF NOT EXISTS recette_etiquettes (
  recette_id   uuid NOT NULL REFERENCES recettes(id) ON DELETE CASCADE,
  etiquette_id uuid NOT NULL REFERENCES etiquettes(id) ON DELETE CASCADE,
  PRIMARY KEY (recette_id, etiquette_id)
);

CREATE TABLE IF NOT EXISTS inventaire (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  emplacement    text NOT NULL CHECK (emplacement IN ('frigo', 'congelateur', 'garde-manger')),
  nom            text NOT NULL,
  aliment_id     uuid REFERENCES aliments(id) ON DELETE SET NULL,
  quantite       numeric(10,2),
  unite          text,
  expire_le      date,
  ajoute_le      date NOT NULL DEFAULT current_date
);
CREATE INDEX IF NOT EXISTS inventaire_utilisateur_idx ON inventaire(utilisateur_id, emplacement);

CREATE TABLE IF NOT EXISTS planification (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jour           date NOT NULL,
  moment         text NOT NULL CHECK (moment IN ('dejeuner', 'diner', 'souper', 'collation')),
  recette_id     uuid REFERENCES recettes(id) ON DELETE CASCADE,
  aliment_id     uuid REFERENCES aliments(id) ON DELETE CASCADE,
  libelle        text,
  portions       numeric(6,2) NOT NULL DEFAULT 1,
  grammes        numeric(8,2),
  mange          boolean NOT NULL DEFAULT false,
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planification_utilisateur_idx ON planification(utilisateur_id, jour);

CREATE TABLE IF NOT EXISTS epicerie (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  quantite       text,
  rayon          text,
  coche          boolean NOT NULL DEFAULT false,
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS epicerie_utilisateur_idx ON epicerie(utilisateur_id);

CREATE TABLE IF NOT EXISTS poids (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  mesure_le      timestamptz NOT NULL,
  poids_kg       numeric(6,2) NOT NULL,
  gras_pct       numeric(5,2),
  source         text NOT NULL DEFAULT 'manuel',
  UNIQUE (utilisateur_id, mesure_le)
);

CREATE TABLE IF NOT EXISTS pas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jour           date NOT NULL,
  nombre         integer NOT NULL CHECK (nombre >= 0),
  source         text NOT NULL DEFAULT 'manuel',
  UNIQUE (utilisateur_id, jour)
);

-- Synchronisation automatique (application passerelle Android -> Cuizinote).
-- Seule l'empreinte SHA-256 de la clé personnelle est conservée.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS jeton_sante text UNIQUE;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS jeton_sante_cree_le timestamptz;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS synchro_sante_le timestamptz;

-- Intervalles de pas bruts (HC Webhook) : dédoublonnés, puis additionnés par jour.
CREATE TABLE IF NOT EXISTS pas_intervalles (
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  debut          timestamptz NOT NULL,
  fin            timestamptz NOT NULL,
  jour           date NOT NULL,
  nombre         integer NOT NULL CHECK (nombre >= 0),
  PRIMARY KEY (utilisateur_id, debut, fin)
);

-- Six moments de repas (ajout de dessert et autre)
ALTER TABLE planification DROP CONSTRAINT IF EXISTS planification_moment_check;
ALTER TABLE planification ADD CONSTRAINT planification_moment_check
  CHECK (moment IN ('dejeuner', 'diner', 'souper', 'dessert', 'collation', 'autre'));

-- Journal : ce qui a réellement été mangé (calories figées au moment de l'ajout, modifiables)
CREATE TABLE IF NOT EXISTS journal (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id   uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jour             date NOT NULL,
  moment           text NOT NULL CHECK (moment IN ('dejeuner', 'diner', 'souper', 'dessert', 'collation', 'autre')),
  libelle          text NOT NULL,
  recette_id       uuid REFERENCES recettes(id) ON DELETE SET NULL,
  aliment_id       uuid REFERENCES aliments(id) ON DELETE SET NULL,
  planification_id uuid REFERENCES planification(id) ON DELETE SET NULL,
  portions         numeric(6,2) NOT NULL DEFAULT 1,
  grammes          numeric(8,2),
  kcal             numeric(8,2),
  cree_le          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_utilisateur_idx ON journal(utilisateur_id, jour);

-- Unité de base d'un aliment : valeurs pour 100 g ou pour 100 ml, portion dans la même unité
ALTER TABLE aliments ADD COLUMN IF NOT EXISTS unite text NOT NULL DEFAULT 'g';
ALTER TABLE aliments DROP CONSTRAINT IF EXISTS aliments_unite_check;
ALTER TABLE aliments ADD CONSTRAINT aliments_unite_check CHECK (unite IN ('g', 'ml'));

-- Widget Android : clé à lecture seule (calories du jour), empreinte SHA-256 seulement
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS jeton_widget text UNIQUE;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS jeton_widget_cree_le timestamptz;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS widget_vu_le timestamptz;

-- Portion telle qu'écrite sur l'étiquette (ex. : « 2 c. à soupe », « 15 croustilles ») ; portion_g = son poids
ALTER TABLE aliments ADD COLUMN IF NOT EXISTS portion_texte text;

-- Valeurs nutritives d'une recette : calcul automatique (défaut) ou saisie manuelle prioritaire
ALTER TABLE recettes ADD COLUMN IF NOT EXISTS nutrition_manuelle boolean NOT NULL DEFAULT false;

-- Calories d'un ingrédient libre (non lié à un produit), pour la quantité de la recette
ALTER TABLE recette_ingredients ADD COLUMN IF NOT EXISTS kcal numeric(8,2);
