import 'server-only';
import { q } from './db';

/** Calories par portion d'une recette (calculées depuis les ingrédients, sinon valeur saisie). */
export const KCAL_RECETTE = `
  CASE WHEN r.nutrition_manuelle THEN r.kcal_portion ELSE coalesce(
    (SELECT sum(CASE WHEN a.id IS NOT NULL AND ri.grammes IS NOT NULL THEN a.kcal_100g * ri.grammes / 100
                     WHEN ri.aliment_id IS NULL THEN ri.kcal END)
       FROM recette_ingredients ri LEFT JOIN aliments a ON a.id = ri.aliment_id
      WHERE ri.recette_id = r.id) / nullif(r.portions, 0),
    r.kcal_portion) END`;

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
      ORDER BY p.jour, array_position(ARRAY['dejeuner','diner','souper','dessert','collation','autre'], p.moment), p.cree_le`,
    [utilisateurId, debut, fin]
  );
}

export async function listerJournal(utilisateurId, jour) {
  return q(
    `SELECT j.id, to_char(j.jour, 'YYYY-MM-DD') AS jour, j.moment, j.libelle, j.recette_id, j.aliment_id, j.planification_id,
            j.portions::float, j.grammes::float, round(j.kcal)::float AS kcal, coalesce(a.unite, 'g') AS unite,
            a.portion_texte, a.portion_g::float
       FROM journal j LEFT JOIN aliments a ON a.id = j.aliment_id
      WHERE j.utilisateur_id = $1 AND j.jour = $2 ORDER BY j.cree_le`,
    [utilisateurId, jour]
  );
}

/**
 * Ajoute au journal le repas planifié (calories calculées maintenant et figées).
 * jour : date où le repas est réellement mangé.
 */
export function requeteJournalDepuisPlan(planificationId, utilisateurId, jour) {
  return [
    `INSERT INTO journal (utilisateur_id, jour, moment, libelle, recette_id, aliment_id, planification_id, portions, grammes, kcal)
     SELECT p.utilisateur_id, coalesce($3::date, p.jour), p.moment, coalesce(r.titre, a.nom, p.libelle, 'Repas'),
            p.recette_id, p.aliment_id, p.id, p.portions, p.grammes,
            CASE
              WHEN p.recette_id IS NOT NULL THEN ${KCAL_RECETTE} * p.portions
              WHEN p.aliment_id IS NOT NULL THEN a.kcal_100g * coalesce(p.grammes, a.portion_g, 100) / 100 * p.portions
            END
       FROM planification p
       LEFT JOIN recettes r ON r.id = p.recette_id
       LEFT JOIN aliments a ON a.id = p.aliment_id
      WHERE p.id = $1 AND p.utilisateur_id = $2`,
    [planificationId, utilisateurId, jour],
  ];
}

/**
 * Recalcule les calories du journal après un changement de valeurs nutritives :
 * entrées de l'aliment modifié, et des recettes qui l'utilisent (ou de la recette modifiée).
 * Les calories corrigées à la main (kcal_manuel) ne bougent pas.
 */
export async function recalculerJournal({ alimentId = null, recetteId = null }) {
  if (alimentId) {
    await q(
      `UPDATE journal j
          SET kcal = a.kcal_100g * coalesce(j.grammes, a.portion_g, 100) / 100 * j.portions
         FROM aliments a
        WHERE a.id = j.aliment_id AND a.id = $1 AND j.recette_id IS NULL
          AND NOT j.kcal_manuel AND a.kcal_100g IS NOT NULL`,
      [alimentId]
    );
  }
  await q(
    `UPDATE journal j
        SET kcal = coalesce((${KCAL_RECETTE}) * j.portions, j.kcal)
       FROM recettes r
      WHERE r.id = j.recette_id AND NOT j.kcal_manuel
        AND (r.id = $2::uuid OR EXISTS (SELECT 1 FROM recette_ingredients ri WHERE ri.recette_id = r.id AND ri.aliment_id = $1::uuid))`,
    [alimentId, recetteId]
  );
}
