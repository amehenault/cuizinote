import { createHash } from 'node:crypto';
import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';

/**
 * Lecture seule pour le widget Android : calories mangées et objectif du jour.
 * Accès par clé personnelle (Authorization: Bearer czw_...), aucun cookie.
 */
export const GET = route(async ({ requete }) => {
  const auth = requete.headers.get('authorization') || '';
  const cle = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const ip = await adresseIp();
  if (!/^czw_[A-Za-z0-9_-]{40,60}$/.test(cle)) {
    await limiter(`widget-ip:${ip}`, 30, 3600);
    throw new ErreurHttp(401, 'Clé absente ou invalide');
  }
  const utilisateur = await q1('SELECT id, objectif_kcal FROM utilisateurs WHERE jeton_widget = $1', [
    createHash('sha256').update(cle).digest('hex'),
  ]);
  if (!utilisateur) {
    await limiter(`widget-ip:${ip}`, 30, 3600);
    throw new ErreurHttp(401, 'Clé absente ou invalide');
  }
  await limiter(`widget:${utilisateur.id}`, 240, 3600);

  // Le téléphone envoie sa date locale (fuseau de l'utilisateur).
  const jour = z.iso.date().safeParse(requete.nextUrl.searchParams.get('jour'));
  if (!jour.success) throw new ErreurHttp(400, 'Date invalide');

  const [total] = await q(
    'SELECT coalesce(round(sum(kcal)), 0)::int AS kcal FROM journal WHERE utilisateur_id = $1 AND jour = $2',
    [utilisateur.id, jour.data]
  );
  await q('UPDATE utilisateurs SET widget_vu_le = now() WHERE id = $1', [utilisateur.id]);
  return ok({ jour: jour.data, kcal: total.kcal, objectif: utilisateur.objectif_kcal });
}, { public: true });
