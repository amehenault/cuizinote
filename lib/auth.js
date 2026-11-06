import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { q, q1 } from './db';

const DUREE_SESSION_JOURS = 30;
const enProduction = process.env.NODE_ENV === 'production';
// Le préfixe __Host- impose Secure + Path=/ + aucun domaine : protège contre l'injection de cookie.
export const NOM_COOKIE = enProduction ? '__Host-cuizinote_session' : 'cuizinote_session';

const empreinte = (jeton) => createHash('sha256').update(jeton).digest('hex');

export async function hacherMotDePasse(motDePasse) {
  return bcrypt.hash(motDePasse, 12);
}

// Empreinte factice pour garder un temps de réponse constant si le compte n'existe pas.
const EMPREINTE_FACTICE = '$2b$12$ayO8R9mcQop/k/GawhKMv.QWjWKOKjdJw6lxh/mfYaaGfxlIw/S.i';

export async function verifierMotDePasse(motDePasse, hache) {
  return bcrypt.compare(motDePasse, hache || EMPREINTE_FACTICE);
}

export async function creerSession(utilisateurId) {
  const jeton = randomBytes(32).toString('base64url');
  const expire = new Date(Date.now() + DUREE_SESSION_JOURS * 86400000);
  await q('INSERT INTO sessions (empreinte, utilisateur_id, expire_le) VALUES ($1, $2, $3)', [
    empreinte(jeton),
    utilisateurId,
    expire,
  ]);
  // Ménage des sessions expirées
  await q('DELETE FROM sessions WHERE expire_le < now()');
  const magasin = await cookies();
  magasin.set(NOM_COOKIE, jeton, {
    httpOnly: true,
    secure: enProduction,
    sameSite: 'lax',
    path: '/',
    expires: expire,
  });
}

export async function detruireSession() {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE)?.value;
  if (jeton) await q('DELETE FROM sessions WHERE empreinte = $1', [empreinte(jeton)]);
  magasin.delete(NOM_COOKIE);
}

/** Retourne l'utilisateur connecté ou null. */
export async function utilisateurCourant() {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE)?.value;
  if (!jeton || jeton.length > 100) return null;
  return q1(
    `SELECT u.id, u.courriel, u.nom, u.objectif_kcal
       FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
      WHERE s.empreinte = $1 AND s.expire_le > now()`,
    [empreinte(jeton)]
  );
}
