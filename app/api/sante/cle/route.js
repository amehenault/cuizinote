import { createHash, randomBytes } from 'node:crypto';
import { q, q1 } from '@/lib/db';
import { ok, route } from '@/lib/http';

/** État de la synchronisation automatique. */
export const GET = route(async ({ utilisateur }) =>
  ok(
    await q1(
      `SELECT jeton_sante IS NOT NULL AS active, jeton_sante_cree_le AS cree_le, synchro_sante_le AS derniere_synchro,
              dernier_envoi_sante AS dernier_envoi
         FROM utilisateurs WHERE id = $1`,
      [utilisateur.id]
    )
  )
);

/** Génère une nouvelle clé (l'ancienne cesse de fonctionner). Elle n'est affichée qu'une seule fois. */
export const POST = route(async ({ utilisateur }) => {
  const cle = `czs_${randomBytes(32).toString('base64url')}`;
  await q('UPDATE utilisateurs SET jeton_sante = $1, jeton_sante_cree_le = now(), synchro_sante_le = NULL WHERE id = $2', [
    createHash('sha256').update(cle).digest('hex'),
    utilisateur.id,
  ]);
  return ok({ cle }, 201);
});

/** Révoque la clé : la passerelle ne peut plus rien envoyer. */
export const DELETE = route(async ({ utilisateur }) => {
  await q('UPDATE utilisateurs SET jeton_sante = NULL, jeton_sante_cree_le = NULL WHERE id = $1', [utilisateur.id]);
  return ok({ ok: true });
});
