// Remplit le sodium des aliments à code-barres à partir d'Open Food Facts,
// seulement s'il est vide. Ne modifie aucune autre valeur.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: ['.env.local', '.env'], quiet: true });
const sql = neon(process.env.DATABASE_URL);

const aliments = await sql.query('SELECT id, nom, code_barre FROM aliments WHERE code_barre IS NOT NULL AND sodium_100g IS NULL');
console.log(`${aliments.length} aliment(s) sans sodium`);
for (const a of aliments) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${a.code_barre}.json?fields=nutriments`, {
      headers: { 'User-Agent': 'Cuizinote/1.0 (application personnelle de recettes)' },
    });
    const sodium = (await r.json()).product?.nutriments?.sodium_100g;
    if (sodium == null) {
      console.log(`  ${a.nom} : pas de sodium sur Open Food Facts`);
    } else {
      await sql.query('UPDATE aliments SET sodium_100g = $1 WHERE id = $2 AND sodium_100g IS NULL', [Number(sodium), a.id]);
      console.log(`  ${a.nom} : ${Math.round(Number(sodium) * 1000)} mg / 100 g`);
    }
  } catch (e) {
    console.log(`  ${a.nom} : erreur (${e.message})`);
  }
  await new Promise((r) => setTimeout(r, 2500));
}
