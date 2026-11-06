import 'server-only';
import { q } from './db';

/** Calories par portion d'une recette (calculées depuis les ingrédients, sinon valeur saisie). */
const KCAL_RECETTE = `
  coalesce(
    (SELECT sum(a.kcal_100g * ri.grammes / 100) FROM recette_ingredients ri
       JOIN aliments a ON a.id = ri.aliment_id
      WHERE ri.recette_id = r.id AND ri.grammes IS NOT NULL) / nullif(r.portions, 0),
    r.kcal_portion)`;

export async function listerPlanification(utilisateurId, debut, fin) {
  return q(
    `SELECT p.id, to_char(p.jour, 'YYYY-MM-DD') AS jour, p.moment, p.recette_id, p.aliment_id, p.libelle,
            p.portions::float, p.grammes::float, p.mange,
            r.titre AS recette_titre, r.image_id AS recette_image_id,
            a.nom AS aliment_nom,
            round(CASE
              WHEN p.recette_id IS NOT NULL THEN ${KCAL_RECETTE} * p.portions
              WHEN p.aliment_id IS NOT NULL THEN a.kcal_100g * coalesce(p.grammes, a.portion_g, 100) / 100 * p.portions
            END)::float AS kcal
       FROM planification p
       LEFT JOIN recettes r ON r.id = p.recette_id
       LEFT JOIN aliments a ON a.id = p.aliment_id
      WHERE p.utilisateur_id = $1 AND p.jour BETWEEN $2 AND $3
      ORDER BY p.jour, array_position(ARRAY['dejeuner','diner','souper','collation'], p.moment), p.cree_le`,
    [utilisateurId, debut, fin]
  );
}
