import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { q, q1, transaction } from './db';
import { ErreurHttp } from './http';
import { ETIQUETTES_DE_BASE, formaterEtiquette } from './etiquettes';
import { suggererEtiquettes } from './ia';
import { grammesDeMesure, mesureDepuisTexte } from './mesures';

/**
 * Calcul nutritionnel : ingrédients liés à un produit (valeurs x quantité)
 * + calories saisies pour les ingrédients libres, divisé par le nombre de portions.
 * Si rien n'est calculable, on retombe sur les valeurs saisies ou importées.
 */
const JOINTURE_NUTRITION = `
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE (a.id IS NOT NULL AND ri.grammes IS NOT NULL)
                               OR (ri.aliment_id IS NULL AND ri.kcal IS NOT NULL))::int AS lies,
           sum(CASE WHEN a.id IS NOT NULL AND ri.grammes IS NOT NULL THEN a.kcal_100g * ri.grammes / 100
                    WHEN ri.aliment_id IS NULL THEN ri.kcal END) AS kcal,
           sum(CASE WHEN a.id IS NOT NULL AND ri.grammes IS NOT NULL THEN a.proteines_100g * ri.grammes / 100 END) AS proteines,
           sum(CASE WHEN a.id IS NOT NULL AND ri.grammes IS NOT NULL THEN a.glucides_100g * ri.grammes / 100 END) AS glucides,
           sum(CASE WHEN a.id IS NOT NULL AND ri.grammes IS NOT NULL THEN a.lipides_100g * ri.grammes / 100 END) AS lipides
      FROM recette_ingredients ri
      LEFT JOIN aliments a ON a.id = ri.aliment_id
     WHERE ri.recette_id = r.id
  ) calc ON true`;

const COLONNES_NUTRITION = `
  calc.lies AS ingredients_lies,
  round(calc.kcal / r.portions)::float AS kcal_calcule,
  round(calc.proteines / r.portions, 1)::float AS proteines_calcule,
  round(calc.glucides / r.portions, 1)::float AS glucides_calcule,
  round(calc.lipides / r.portions, 1)::float AS lipides_calcule,
  CASE WHEN r.nutrition_manuelle THEN r.kcal_portion ELSE coalesce(round(calc.kcal / r.portions), r.kcal_portion) END::float AS kcal,
  CASE WHEN r.nutrition_manuelle THEN r.proteines_portion ELSE coalesce(round(calc.proteines / r.portions, 1), r.proteines_portion) END::float AS proteines,
  CASE WHEN r.nutrition_manuelle THEN r.glucides_portion ELSE coalesce(round(calc.glucides / r.portions, 1), r.glucides_portion) END::float AS glucides,
  CASE WHEN r.nutrition_manuelle THEN r.lipides_portion ELSE coalesce(round(calc.lipides / r.portions, 1), r.lipides_portion) END::float AS lipides`;

const COLONNES_ETIQUETTES = `
  coalesce((SELECT array_agg(e.nom ORDER BY e.nom)
              FROM recette_etiquettes re JOIN etiquettes e ON e.id = re.etiquette_id
             WHERE re.recette_id = r.id), '{}') AS etiquettes`;

export async function listerRecettes(utilisateurId, { recherche = '', etiquette = '' } = {}) {
  return q(
    `SELECT r.id, r.titre, r.description, r.portions::float, r.temps_preparation, r.temps_cuisson,
            r.image_id, r.note, r.publiee, r.modifie_le, ${COLONNES_NUTRITION}, ${COLONNES_ETIQUETTES}
       FROM recettes r ${JOINTURE_NUTRITION}
      WHERE r.utilisateur_id = $1
        AND ($2 = '' OR cz_norm(r.titre) LIKE '%' || cz_norm($2) || '%' OR cz_norm(r.description) LIKE '%' || cz_norm($2) || '%')
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
    `SELECT ri.texte, ri.aliment_id, ri.grammes::float, ri.kcal::float AS kcal_libre, ri.mesure, a.nom AS aliment_nom, a.kcal_100g::float, a.proteines_100g::float, a.glucides_100g::float, a.lipides_100g::float, a.unite, a.portion_g::float AS portion_g, a.portion_texte,
            round(coalesce(a.kcal_100g * ri.grammes / 100, ri.kcal))::float AS kcal
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
  const etiquettes = [...new Set(donnees.etiquettes.map(formaterEtiquette).filter(Boolean))];
  const ing = donnees.ingredients;
  const valeurs = [
    donnees.titre, donnees.description, donnees.portions, donnees.temps_preparation,
    donnees.temps_cuisson, JSON.stringify(donnees.etapes), donnees.source_url, donnees.image_id,
    donnees.note, donnees.commentaires, donnees.kcal_portion, donnees.proteines_portion,
    donnees.glucides_portion, donnees.lipides_portion, recetteId, utilisateurId, donnees.nutrition_manuelle, donnees.publiee,
  ];

  // Étiquettes automatiques encore présentes dans le formulaire : elles restent automatiques.
  const autos = id
    ? (await q(
        `SELECT e.nom FROM recette_etiquettes re JOIN etiquettes e ON e.id = re.etiquette_id
          WHERE re.recette_id = $1 AND re.auto`,
        [id]
      )).map((l) => l.nom)
    : [];

  const requetes = [];
  if (id) {
    requetes.push([
      `UPDATE recettes SET titre=$1, description=$2, portions=$3, temps_preparation=$4, temps_cuisson=$5,
              etapes=$6::jsonb, source_url=$7, image_id=$8, note=$9, commentaires=$10, kcal_portion=$11,
              proteines_portion=$12, glucides_portion=$13, lipides_portion=$14, nutrition_manuelle=$17, publiee=$18, modifie_le=now()
        WHERE id=$15 AND utilisateur_id=$16`,
      valeurs,
    ]);
  } else {
    requetes.push([
      `INSERT INTO recettes (titre, description, portions, temps_preparation, temps_cuisson, etapes, source_url,
              image_id, note, commentaires, kcal_portion, proteines_portion, glucides_portion, lipides_portion,
              id, utilisateur_id, nutrition_manuelle, publiee)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      valeurs,
    ]);
  }
  requetes.push(['DELETE FROM recette_ingredients WHERE recette_id = $1', [recetteId]]);
  if (ing.length) {
    requetes.push([
      `INSERT INTO recette_ingredients (recette_id, position, texte, aliment_id, grammes, kcal, mesure)
       SELECT $1, t.pos, t.texte,
              CASE WHEN EXISTS (SELECT 1 FROM aliments a WHERE a.id = t.aliment_id)
                   THEN t.aliment_id END,
              t.grammes, CASE WHEN t.aliment_id IS NULL THEN t.kcal END, CASE WHEN t.aliment_id IS NOT NULL THEN t.mesure END
         FROM unnest($2::int[], $3::text[], $4::uuid[], $5::numeric[], $6::numeric[], $7::text[]) AS t(pos, texte, aliment_id, grammes, kcal, mesure)`,
      [recetteId, ing.map((_, i) => i), ing.map((i) => i.texte), ing.map((i) => i.aliment_id), ing.map((i) => i.grammes),
        ing.map((i) => i.kcal), ing.map((i) => i.mesure || null)],
    ]);
  }
  requetes.push(['DELETE FROM recette_etiquettes WHERE recette_id = $1', [recetteId]]);
  const retirees = autos.filter((n) => !etiquettes.includes(n));
  if (retirees.length) {
    requetes.push([
      `INSERT INTO etiquettes_refusees (utilisateur_id, recette_id, nom) SELECT $1, $2, unnest($3::text[]) ON CONFLICT DO NOTHING`,
      [utilisateurId, recetteId, retirees],
    ]);
  }
  if (etiquettes.length) {
    requetes.push([
      `DELETE FROM etiquettes_refusees WHERE utilisateur_id = $1 AND nom = ANY($3::text[]) AND (recette_id = $2 OR recette_id IS NULL)`,
      [utilisateurId, recetteId, etiquettes],
    ]);
    requetes.push([
      `INSERT INTO etiquettes (utilisateur_id, nom) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
      [utilisateurId, etiquettes],
    ]);
    requetes.push([
      `INSERT INTO recette_etiquettes (recette_id, etiquette_id, auto)
       SELECT $1, id, nom = ANY($4::text[]) FROM etiquettes WHERE utilisateur_id = $2 AND nom = ANY($3::text[])`,
      [recetteId, utilisateurId, etiquettes, autos],
    ]);
  }
  await transaction(requetes);
  return recetteId;
}

/** Recettes publiées par les membres (les miennes comprises, signalées par « mienne »). */
export async function listerCommunaute(utilisateurId, { recherche = '', limite = 200 } = {}) {
  return q(
    `SELECT r.id, r.titre, r.description, r.portions::float, r.temps_preparation, r.temps_cuisson,
            r.image_id, r.note, r.modifie_le, u.nom AS auteur, (r.utilisateur_id = $1) AS mienne,
            ${COLONNES_NUTRITION}, ${COLONNES_ETIQUETTES}
       FROM recettes r JOIN utilisateurs u ON u.id = r.utilisateur_id ${JOINTURE_NUTRITION}
      WHERE r.publiee
        AND ($2 = '' OR cz_norm(r.titre) LIKE '%' || cz_norm($2) || '%' OR cz_norm(r.description) LIKE '%' || cz_norm($2) || '%')
      ORDER BY r.cree_le DESC
      LIMIT $3::int`,
    [utilisateurId, recherche.replace(/[%_\\]/g, '\\$&'), Math.min(Math.max(limite, 1), 500)]
  );
}

/** Fiche d'une recette publiée (lecture seule pour les autres membres). */
export async function obtenirRecetteCommunaute(utilisateurId, id) {
  const ligne = await q1(
    'SELECT r.utilisateur_id, u.nom AS auteur FROM recettes r JOIN utilisateurs u ON u.id = r.utilisateur_id WHERE r.id = $1 AND r.publiee',
    [id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Recette introuvable');
  const recette = await obtenirRecette(ligne.utilisateur_id, id);
  recette.auteur = ligne.auteur;
  recette.mienne = ligne.utilisateur_id === utilisateurId;
  return recette;
}

/** « Ajouter à mes recettes » : copie complète (ingrédients liés à la banque commune, étiquettes, photo). */
export async function copierRecette(utilisateurId, id) {
  const source = await obtenirRecetteCommunaute(utilisateurId, id);
  if (source.mienne) throw new ErreurHttp(400, 'Cette recette est déjà dans vos recettes');

  let image_id = null;
  if (source.image_id) {
    const copie = await q1(
      `INSERT INTO images (utilisateur_id, type_mime, donnees)
       SELECT $1, type_mime, donnees FROM images WHERE id = $2 RETURNING id`,
      [utilisateurId, source.image_id]
    );
    image_id = copie?.id ?? null;
  }
  const commentaire = `Recette de ${source.auteur}, ajoutée depuis la communauté.`;
  return enregistrerRecette(utilisateurId, {
    titre: source.titre,
    description: source.description,
    portions: source.portions,
    temps_preparation: source.temps_preparation,
    temps_cuisson: source.temps_cuisson,
    etapes: source.etapes || [],
    source_url: source.source_url,
    image_id,
    note: null,
    commentaires: source.commentaires ? `${source.commentaires}\n\n${commentaire}` : commentaire,
    kcal_portion: source.kcal_portion,
    proteines_portion: source.proteines_portion,
    glucides_portion: source.glucides_portion,
    lipides_portion: source.lipides_portion,
    nutrition_manuelle: source.nutrition_manuelle,
    // La copie reste privée : c'est la recette d'une autre personne.
    publiee: false,
    ingredients: source.ingredients.map((i) => ({
      texte: i.texte,
      aliment_id: i.aliment_id,
      grammes: i.grammes,
      mesure: i.mesure || null,
      kcal: i.aliment_id ? null : i.kcal_libre,
    })),
    etiquettes: source.etiquettes || [],
  });
}

// Version des règles d'étiquetage : la changer fait recalculer toutes les recettes automatiquement.
const VERSION_REGLES = 'v2';

/** Recettes à étiqueter automatiquement (par lots, triées par id ; `apres` = curseur). */
export async function recettesAEtiqueter(utilisateurId, { apres = null, limite = 10, aEtiqueter = true, seule = null } = {}) {
  return q(
    `SELECT r.id, r.titre, r.description, r.portions::float, r.temps_preparation, r.temps_cuisson,
            r.etiquettes_auto_empreinte, ${COLONNES_NUTRITION}, ${COLONNES_ETIQUETTES},
            coalesce((SELECT array_agg(ri.texte ORDER BY ri.position) FROM recette_ingredients ri WHERE ri.recette_id = r.id), '{}') AS ingredients
       FROM recettes r ${JOINTURE_NUTRITION}
      WHERE r.utilisateur_id = $1
        AND ($2::uuid IS NULL OR r.id > $2::uuid)
        AND (NOT $4::boolean OR r.etiquettes_auto_empreinte IS NULL OR r.etiquettes_auto_empreinte NOT LIKE $6 || ':%')
        AND ($5::uuid IS NULL OR r.id = $5::uuid)
      ORDER BY r.id
      LIMIT $3::int`,
    [utilisateurId, apres, limite, aEtiqueter, seule, VERSION_REGLES]
  );
}

/** Empreinte de ce qui détermine les étiquettes : titre + ingrédients. */
const empreinte = (r) =>
  `${VERSION_REGLES}:${createHash('sha256').update(JSON.stringify([r.titre, ...(r.ingredients || [])].map((t) => String(t).trim().toLowerCase()))).digest('hex')}`;

/**
 * Étiquetage automatique (IA) d'une liste de recettes : les étiquettes automatiques précédentes
 * sont remplacées ; celles ajoutées à la main sont gardées. `forcer` : même si rien n'a changé.
 * Retourne le nombre de recettes étiquetées.
 */
export async function etiqueterAutomatiquement(utilisateurId, recettes, { forcer = false } = {}) {
  const aFaire = recettes
    .map((r) => ({ ...r, empreinte: empreinte(r) }))
    .filter((r) => forcer || r.empreinte !== r.etiquettes_auto_empreinte);
  if (!aFaire.length) return 0;
  const noms = (await q('SELECT nom FROM etiquettes WHERE utilisateur_id = $1', [utilisateurId])).map((l) => l.nom);
  const refusees = await q('SELECT recette_id, nom FROM etiquettes_refusees WHERE utilisateur_id = $1', [utilisateurId]);
  const interdites = new Set(refusees.filter((r) => !r.recette_id).map((r) => r.nom));
  const refuseePour = (id, nom) => interdites.has(nom) || refusees.some((r) => r.recette_id === id && r.nom === nom);
  const proposees = [...new Set([...ETIQUETTES_DE_BASE, ...noms])].filter((n) => !interdites.has(n));
  const suggestions = await suggererEtiquettes(aFaire, proposees, [...interdites]);
  let total = 0;
  for (let i = 0; i < aFaire.length; i++) {
    if (!suggestions[i].length) continue; // échec de l'IA : on réessaiera plus tard
    const etiquettes = [...new Set(suggestions[i].map(formaterEtiquette).filter(Boolean))]
      .filter((n) => !refuseePour(aFaire[i].id, n))
      .slice(0, 8);
    await transaction([
      ['DELETE FROM recette_etiquettes WHERE recette_id = $1 AND auto', [aFaire[i].id]],
      [`INSERT INTO etiquettes (utilisateur_id, nom) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [utilisateurId, etiquettes]],
      [
        `INSERT INTO recette_etiquettes (recette_id, etiquette_id, auto)
         SELECT r.id, e.id, true FROM recettes r JOIN etiquettes e ON e.utilisateur_id = r.utilisateur_id
          WHERE r.id = $1 AND r.utilisateur_id = $2 AND e.nom = ANY($3::text[])
         ON CONFLICT DO NOTHING`,
        [aFaire[i].id, utilisateurId, etiquettes],
      ],
      ['UPDATE recettes SET etiquettes_auto_empreinte = $1 WHERE id = $2 AND utilisateur_id = $3', [aFaire[i].empreinte, aFaire[i].id, utilisateurId]],
    ]);
    total++;
  }
  return total;
}

/** Après l'enregistrement d'une recette : étiquetage si le titre ou les ingrédients ont changé. */
export async function etiqueterRecette(utilisateurId, recetteId) {
  const [recette] = await recettesAEtiqueter(utilisateurId, { seule: recetteId, limite: 1, aEtiqueter: false });
  return recette ? etiqueterAutomatiquement(utilisateurId, [recette]) : 0;
}

/**
 * Conversion unique des recettes existantes : un ingrédient lié dont le texte commence par une mesure
 * (« 1 tasse de farine ») reçoit cette mesure et ses grammes recalculés d'après la portion de l'étiquette.
 * Les ingrédients impossibles à convertir (pas de mesure, portion sans volume) ne sont pas touchés.
 */
export async function convertirMesures(utilisateurId) {
  const fait = await q1('SELECT mesures_converties_le FROM utilisateurs WHERE id = $1', [utilisateurId]);
  if (!fait || fait.mesures_converties_le) return 0;
  const lignes = await q(
    `SELECT ri.id, ri.texte, a.nom, a.unite, a.portion_g::float, a.portion_texte
       FROM recette_ingredients ri
       JOIN recettes r ON r.id = ri.recette_id
       JOIN aliments a ON a.id = ri.aliment_id
      WHERE r.utilisateur_id = $1 AND ri.mesure IS NULL`,
    [utilisateurId]
  );
  const conversions = [];
  for (const l of lignes) {
    const mesure = mesureDepuisTexte(l.texte);
    const grammes = mesure && grammesDeMesure(mesure, l);
    if (grammes) conversions.push({ id: l.id, mesure, grammes });
  }
  const requetes = [];
  if (conversions.length) {
    requetes.push([
      `UPDATE recette_ingredients ri SET mesure = t.mesure, grammes = t.grammes
         FROM unnest($1::uuid[], $2::text[], $3::numeric[]) AS t(id, mesure, grammes) WHERE ri.id = t.id`,
      [conversions.map((c) => c.id), conversions.map((c) => c.mesure), conversions.map((c) => c.grammes)],
    ]);
  }
  requetes.push(['UPDATE utilisateurs SET mesures_converties_le = now() WHERE id = $1', [utilisateurId]]);
  await transaction(requetes);
  return conversions.length;
}
