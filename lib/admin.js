import 'server-only';

/**
 * Administratrice de Cuizinote (seule à voir la jauge de l'IA).
 * ADMIN_COURRIELS (liste séparée par des virgules) si défini ; sinon, le premier compte créé.
 */
export function estAdmin(utilisateur) {
  if (!utilisateur) return false;
  const liste = (process.env.ADMIN_COURRIELS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return liste.length ? liste.includes(String(utilisateur.courriel).toLowerCase()) : utilisateur.premier_compte === true;
}
