import 'server-only';
import { headers } from 'next/headers';
import { q, q1 } from './db';
import { ErreurHttp } from './http';

/** Adresse IP du client (fournie par Vercel). */
export async function adresseIp() {
  const h = await headers();
  return (h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'inconnue').trim();
}

/**
 * Limite le nombre d'actions par clé sur une fenêtre de temps.
 * Lève une erreur 429 si la limite est dépassée.
 */
export async function limiter(cle, maximum, fenetreSecondes) {
  const ligne = await q1(
    `SELECT count(*)::int AS total FROM limites_requetes
      WHERE cle = $1 AND cree_le > now() - make_interval(secs => $2)`,
    [cle, fenetreSecondes]
  );
  if (ligne.total >= maximum) {
    throw new ErreurHttp(429, 'Trop de tentatives. Réessayez plus tard.');
  }
  await q('INSERT INTO limites_requetes (cle) VALUES ($1)', [cle]);
  if (Math.random() < 0.05) {
    await q("DELETE FROM limites_requetes WHERE cree_le < now() - interval '1 day'");
  }
}
