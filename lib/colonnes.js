export const COLONNES_ALIMENT = `id, nom, marque, code_barre, kcal_100g::float, proteines_100g::float, glucides_100g::float,
  lipides_100g::float, fibres_100g::float, sucres_100g::float, sel_100g::float, sodium_100g::float, portion_g::float, portion_texte, image_url, image_id, unite,
  contenant_qte::float, contenant_unite`;

export const COLONNES_INVENTAIRE = `id, emplacement, nom, aliment_id, quantite::float, unite,
  to_char(expire_le, 'YYYY-MM-DD') AS expire_le, to_char(ajoute_le, 'YYYY-MM-DD') AS ajoute_le`;

/** Texte « × 893 ml » / « × 1,89 L » / « × 2 kg » calculé en SQL à partir d'un aliment « a ». */
export const LIBELLE_CONTENANT_SQL = `'× ' || CASE
    WHEN a.contenant_qte >= 1000 AND coalesce(a.contenant_unite, a.unite) IN ('g', 'ml') THEN
      replace(trim(trailing '.' FROM trim(trailing '0' FROM round(a.contenant_qte / 1000, 2)::text)), '.', ',')
      || CASE WHEN coalesce(a.contenant_unite, a.unite) = 'ml' THEN ' L' ELSE ' kg' END
    ELSE
      replace(trim(trailing '.' FROM trim(trailing '0' FROM round(a.contenant_qte, 2)::text)), '.', ',')
      || ' ' || coalesce(a.contenant_unite, a.unite)
  END`;
