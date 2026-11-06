import 'server-only';
import { randomUUID } from 'node:crypto';
import { q, q1, transaction } from './db';
import { ErreurHttp } from './http';

/**
 * Calcul nutritionnel : somme des ingrédients liés à un aliment (avec grammes),
 * divisée par le nombre de portions. Si aucun ingrédient n'est lié,
 * on retombe sur les valeurs saisies ou importées.
 */
const JOINTURE_NUTRITION = `
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS lies,
           sum(a.kcal_100g * ri.grammes / 100) AS kcal,
           sum(a.proteines_100g * ri.grammes / 100) AS proteines,
           sum(a.glucides_100g * ri.grammes / 100) AS glucides,
           sum(a.lipides_100g * ri.grammes / 100) AS lipides
      FROM recette_ingredients ri
      JOIN aliments a ON a.id = ri.aliment_id
     WHERE ri.recette_id = r.id AND ri.grammes IS NOT NULL
  ) calc ON true`;

const COLONNES_NUTRITION = `
  calc.lies AS ingredients_lies,
  round(calc.kcal / r.portions)::float AS kcal_calcule,
  round(calc.proteines / r.portions, 1)::float AS proteines_calcule,
  round(calc.glucides / r.portions, 1)::float AS glucides_calcule,
  round(calc.lipides / r.portions, 1)::float AS lipides_calcule,
  coalesce(round(calc.kcal / r.portions), r.kcal_portion)::float AS kcal,
  coalesce(round(calc.proteines / r.portions, 1), r.proteines_portion)::float AS proteines,
  coalesce(round(calc.glucides / r.portions, 1), r.glucides_portion)::float AS glucides,
  coalesce(round(calc.lipides / r.portions, 1), r.lipides_portion)::float AS lipides`;

const COLONNES_ETIQUETTES = `
  coalesce((SELECT array_agg(e.nom ORDER BY e.nom)
              FROM recette_etiquettes re JOIN etiquettes e ON e.id = re.etiquette_id
             WHERE re.recette_id = r.id), '{}') AS etiquettes`;

export async function listerRecettes(utilisateurId, { recherche = '', etiquette = '' } = {}) {
  return q(
    `SELECT r.id, r.titre, r.description, r.portions::float, r.temps_preparation, r.temps_cuisson,
            r.image_id, r.note, r.modifie_le, ${COLONNES_NUTRITION}, ${COLONNES_ETIQUETTES}
       FROM recettes r ${JOINTURE_NUTRITION}
      WHERE r.utilisateur_id = $1
        AND ($2 = '' OR r.titre ILIKE '%' || $2 || '%' OR r.description ILIKE '%' || $2 || '%')
        AND ($3 = '' OR EXISTS (
              SELECT 1 FROM recette_etiquettes re JOIN etiquettes e ON e.id = re.etiquette_id
               WHERE re.recette_id = r.id AND e.nom = $3))
      ORDER BY r.modifie_le DESC
      LIMIT 500`,
    [utilisateurId, recherche.replace(/[%_\\]/g, '\\$&'), etiquette]
  );
}

export async function obtenirRecette(utilisateurId, id) {
  const recette = await q1(
    `SELECT r.*, r.portions::float, r.kcal_portion::float, r.proteines_portion::float,
            r.glucides_portion::float, r.lipides_portion::float,
            ${COLONNES_NUTRITION}, ${COLONNES_ETIQUETTES}
       FROM recettes r ${JOINTURE_NUTRITION}
      WHERE r.id = $1 AND r.utilisateur_id = $2`,
    [id, utilisateurId]
  );
  if (!recette) throw new ErreurHttp(404, 'Recette introuvable');
  delete recette.utilisateur_id;
  recette.ingredients = await q(
    `SELECT ri.texte, ri.aliment_id, ri.grammes::float, a.nom AS aliment_nom, a.kcal_100g::float,
            round(a.kcal_100g * ri.grammes / 100)::float AS kcal
       FROM recette_ingredients ri LEFT JOIN aliments a ON a.id = ri.aliment_id
      WHERE ri.recette_id = $1 ORDER BY ri.position`,
    [id]
  );
  return recette;
}

/** Crée (id absent) ou met à jour une recette avec ingrédients et étiquettes, en une transaction. */
export async function enregistrerRecette(utilisateurId, donnees, id = null) {
  if (id) {
    const existe = await q1('SELECT 1 FROM recettes WHERE id = $1 AND utilisateur_id = $2', [id, utilisateurId]);
    if (!existe) throw new ErreurHttp(404, 'Recette introuvable');
  }
  if (donnees.image_id) {
    const image = await q1('SELECT 1 FROM images WHERE id = $1 AND utilisateur_id = $2', [donnees.image_id, utilisateurId]);
    if (!image) throw new ErreurHttp(400, 'Image invalide');
  }

  const recetteId = id || randomUUID();
  const etiquettes = [...new Set(donnees.etiquettes.map((e) => e.toLowerCase()))];
  const ing = donnees.ingredients;
  const valeurs = [
    donnees.titre, donnees.description, donnees.portions, donnees.temps_preparation,
    donnees.temps_cuisson, JSON.stringify(donnees.etapes), donnees.source_url, donnees.image_id,
    donnees.note, donnees.commentaires, donnees.kcal_portion, donnees.proteines_portion,
    donnees.glucides_portion, donnees.lipides_portion, recetteId, utilisateurId,
  ];

  const requetes = [];
  if (id) {
    requetes.push([
      `UPDATE recettes SET titre=$1, description=$2, portions=$3, temps_preparation=$4, temps_cuisson=$5,
              etapes=$6::jsonb, source_url=$7, image_id=$8, note=$9, commentaires=$10, kcal_portion=$11,
              proteines_portion=$12, glucides_portion=$13, lipides_portion=$14, modifie_le=now()
        WHERE id=$15 AND utilisateur_id=$16`,
      valeurs,
    ]);
  } else {
    requetes.push([
      `INSERT INTO recettes (titre, description, portions, temps_preparation, temps_cuisson, etapes, source_url,
              image_id, note, commentaires, kcal_portion, proteines_portion, glucides_portion, lipides_portion,
              id, utilisateur_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      valeurs,
    ]);
  }
  requetes.push(['DELETE FROM recette_ingredients WHERE recette_id = $1', [recetteId]]);
  if (ing.length) {
    requetes.push([
      `INSERT INTO recette_ingredients (recette_id, position, texte, aliment_id, grammes)
       SELECT $1, t.pos, t.texte,
              CASE WHEN EXISTS (SELECT 1 FROM aliments a WHERE a.id = t.aliment_id AND a.utilisateur_id = $6)
                   THEN t.aliment_id END,
              t.grammes
         FROM unnest($2::int[], $3::text[], $4::uuid[], $5::numeric[]) AS t(pos, texte, aliment_id, grammes)`,
      [recetteId, ing.map((_, i) => i), ing.map((i) => i.texte), ing.map((i) => i.aliment_id), ing.map((i) => i.grammes), utilisateurId],
    ]);
  }
  requetes.push(['DELETE FROM recette_etiquettes WHERE recette_id = $1', [recetteId]]);
  if (etiquettes.length) {
    requetes.push([
      `INSERT INTO etiquettes (utilisateur_id, nom) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
      [utilisateurId, etiquettes],
    ]);
    requetes.push([
      `INSERT INTO recette_etiquettes (recette_id, etiquette_id)
       SELECT $1, id FROM etiquettes WHERE utilisateur_id = $2 AND nom = ANY($3::text[])`,
      [recetteId, utilisateurId, etiquettes],
    ]);
  }
  await transaction(requetes);
  return recetteId;
}
