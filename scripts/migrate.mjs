// Applique sql/schema.sql sur la base Neon définie dans DATABASE_URL.
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'], quiet: true });
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url && process.argv.includes('--si-possible')) {
  // Build sans base de données (ex. : poste local) : on construit quand même.
  console.log('DATABASE_URL absent : schéma non appliqué.');
  process.exit(0);
}
if (!url) {
  console.error('DATABASE_URL est manquant (fichier .env ou variable d\'environnement).');
  process.exit(1);
}

const sql = neon(url);
const contenu = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
const instructions = contenu
  .split('\n')
  .filter((ligne) => !ligne.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const instruction of instructions) {
  await sql.query(instruction);
}
console.log(`Schéma appliqué (${instructions.length} instructions).`);
