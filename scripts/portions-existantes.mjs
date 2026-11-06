// Complète la portion « comme sur l'étiquette » des aliments déjà enregistrés,
// à partir d'Open Food Facts (code-barres). Ne modifie ni les calories ni les valeurs déjà remplies.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { portionDepuisEtiquette } from '../lib/portion.js';

config({ path: ['.env.local', '.env'], quiet: true });
const sql = neon(process.env.DATABASE_URL);

const aliments = await sql.query(
  `SELECT id, nom, code_barre, portion_g::float, unite FROM aliments
    WHERE code_barre IS NOT NULL AND portion_texte IS NULL`
);
console.log(`${aliments.length} aliment(s) à compléter`);

let completes = 0;
for (const a of aliments) {
  try {
    const reponse = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${a.code_barre}.json?fields=serving_size,serving_quantity,serving_quantity_unit`,
      { headers: { 'User-Agent': 'Cuizinote/1.0 (application personnelle de recettes)' } }
    );
    const donnees = await reponse.json();
    const p = donnees.product || {};
    const texte = portionDepuisEtiquette(p.serving_size);
    const poids = Number(p.serving_quantity) || null;
    if (!texte && (a.portion_g || !poids)) {
      console.log(`  ${a.nom} : aucune portion sur l'étiquette`);
      continue;
    }
    await sql.query(
      `UPDATE aliments SET portion_texte = coalesce(portion_texte, $1),
              portion_g = coalesce(portion_g, $2),
              unite = CASE WHEN portion_g IS NULL AND $3 = 'ml' THEN 'ml' ELSE unite END
        WHERE id = $4`,
      [texte, poids, p.serving_quantity_unit === 'ml' ? 'ml' : 'g', a.id]
    );
    completes += 1;
    console.log(`  ${a.nom} : ${texte || '(poids seulement)'}${poids ? ` = ${poids} ${p.serving_quantity_unit || 'g'}` : ''}`);
  } catch (e) {
    console.log(`  ${a.nom} : erreur (${e.message})`);
  }
  await new Promise((r) => setTimeout(r, 2500)); // respect des limites d'Open Food Facts
}
console.log(`${completes} aliment(s) complété(s).`);
