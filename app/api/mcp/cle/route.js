import { createHash, randomBytes } from 'node:crypto';
import { estAdmin } from '@/lib/admin';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';

// Connecteur Claude (MCP) : réservé au compte administrateur.
const verifier = (utilisateur) => {
  if (!estAdmin(utilisateur)) throw new ErreurHttp(403, 'Accès refusé');
};

export const GET = route(async ({ utilisateur }) => {
  verifier(utilisateur);
  return ok(
    await q1(
      `SELECT jeton_mcp IS NOT NULL AS active, jeton_mcp_cree_le AS cree_le, mcp_vu_le AS dernier_acces
         FROM utilisateurs WHERE id = $1`,
      [utilisateur.id]
    )
  );
});

/** Nouvelle clé : l'URL complète du connecteur est affichée une seule fois. */
export const POST = route(async ({ utilisateur }) => {
  verifier(utilisateur);
  const cle = `czm_${randomBytes(32).toString('base64url')}`;
  await q('UPDATE utilisateurs SET jeton_mcp = $1, jeton_mcp_cree_le = now(), mcp_vu_le = NULL WHERE id = $2', [
    createHash('sha256').update(cle).digest('hex'),
    utilisateur.id,
  ]);
  return ok({ cle }, 201);
});

export const DELETE = route(async ({ utilisateur }) => {
  verifier(utilisateur);
  await q('UPDATE utilisateurs SET jeton_mcp = NULL, jeton_mcp_cree_le = NULL WHERE id = $1', [utilisateur.id]);
  return ok({ ok: true });
});
