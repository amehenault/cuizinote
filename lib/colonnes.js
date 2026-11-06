export const COLONNES_ALIMENT = `id, nom, marque, code_barre, kcal_100g::float, proteines_100g::float, glucides_100g::float,
  lipides_100g::float, fibres_100g::float, sucres_100g::float, sel_100g::float, portion_g::float, image_url, unite`;

export const COLONNES_INVENTAIRE = `id, emplacement, nom, aliment_id, quantite::float, unite,
  to_char(expire_le, 'YYYY-MM-DD') AS expire_le, to_char(ajoute_le, 'YYYY-MM-DD') AS ajoute_le`;
