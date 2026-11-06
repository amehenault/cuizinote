import { createHash, randomBytes } from 'node:crypto';
import { q, q1 } from '@/lib/db';
import { ok, route } from '@/lib/http';

/** État de la clé du widget Android. */
export const GET = route(async ({ utilisateur }) =>
  ok(
    await q1(
      `SELECT jeton_widget IS NOT NULL AS active, jeton_widget_cree_le AS cree_le, widget_vu_le AS dernier_acces
         FROM utilisateurs WHERE id = $1`,
      [utilisateur.id]
    )
  )
);

/** Nouvelle clé (lecture seule des calories du jour). Affichée une seule fois. */
export const POST = route(async ({ utilisateur }) => {
  const cle = `czw_${randomBytes(32).toString('base64url')}`;
  await q('UPDATE utilisateurs SET jeton_widget = $1, jeton_widget_cree_le = now(), widget_vu_le = NULL WHERE id = $2', [
    createHash('sha256').update(cle).digest('hex'),
    utilisateur.id,
  ]);
  return ok({ cle }, 201);
});

export const DELETE = route(async ({ utilisateur }) => {
  await q('UPDATE utilisateurs SET jeton_widget = NULL, jeton_widget_cree_le = NULL WHERE id = $1', [utilisateur.id]);
  return ok({ ok: true });
});
