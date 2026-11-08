import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { estAdmin } from '@/lib/admin';
import { COLONNES_PROFIL } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { ErreurHttp } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { traiterMessage } from '@/lib/mcp';

/**
 * Serveur MCP personnel : https://<site>/api/mcp/czm_... (URL secrète, aucun cookie).
 * Transport HTTP « streamable » sans état : chaque POST reçoit une réponse JSON.
 */
const json = (corps, status = 200) => NextResponse.json(corps, { status });

async function authentifier(cle) {
  const ip = await adresseIp();
  const refus = async () => {
    await limiter(`mcp-ip:${ip}`, 30, 3600);
    return null;
  };
  if (!/^czm_[A-Za-z0-9_-]{40,60}$/.test(cle)) return refus();
  const u = await q1(`SELECT ${COLONNES_PROFIL} FROM utilisateurs u WHERE u.jeton_mcp = $1`, [
    createHash('sha256').update(cle).digest('hex'),
  ]);
  // Réservé au compte administrateur, même si une clé existe ailleurs.
  if (!u || !estAdmin(u)) return refus();
  await limiter(`mcp:${u.id}`, 600, 3600);
  return u;
}

export async function POST(requete, { params }) {
  try {
    const { cle } = await params;
    const utilisateur = await authentifier(cle);
    if (!utilisateur) return json({ erreur: 'Introuvable' }, 404);

    const texte = await requete.text();
    if (texte.length > 200_000) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Requête trop volumineuse' } }, 413);
    let corps;
    try {
      corps = JSON.parse(texte);
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } }, 400);
    }

    const lot = Array.isArray(corps);
    const reponses = (await Promise.all((lot ? corps : [corps]).slice(0, 20).map((m) => traiterMessage(utilisateur, m)))).filter(Boolean);
    await q('UPDATE utilisateurs SET mcp_vu_le = now() WHERE id = $1', [utilisateur.id]).catch(() => {});
    // Seulement des notifications : 202 sans contenu.
    if (!reponses.length) return new NextResponse(null, { status: 202 });
    return json(lot ? reponses : reponses[0]);
  } catch (e) {
    if (e instanceof ErreurHttp) return json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: e.message } }, e.statut);
    console.error(e);
    return json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Erreur interne' } }, 500);
  }
}

// Pas de flux SSE ni de session : le client se contente des réponses JSON.
export const GET = () => new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
export const DELETE = GET;
