import 'server-only';
import { neon } from '@neondatabase/serverless';

let client;

function getClient() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

/** Requête paramétrée ($1, $2...). Retourne les lignes. */
export function q(texte, params = []) {
  return getClient().query(texte, params);
}

/** Première ligne ou null. */
export async function q1(texte, params = []) {
  const lignes = await q(texte, params);
  return lignes[0] ?? null;
}

/** Transaction : reçoit une liste de [texte, params]. */
export function transaction(requetes) {
  const sql = getClient();
  return sql.transaction(requetes.map(([texte, params = []]) => sql.query(texte, params)));
}
