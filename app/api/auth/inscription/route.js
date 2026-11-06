import { createHash, timingSafeEqual } from 'node:crypto';
import { q, q1 } from '@/lib/db';
import { creerSession, hacherMotDePasse } from '@/lib/auth';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { schemaInscription } from '@/lib/schemas';

/** Comparaison à temps constant du code d'invitation (variable CODE_INVITATION). */
function codeValide(code) {
  const attendu = process.env.CODE_INVITATION || '';
  if (attendu.length < 8 || !code) return false;
  const h = (v) => createHash('sha256').update(v.trim().toLowerCase()).digest();
  return timingSafeEqual(h(code), h(attendu));
}

export const POST = route(async ({ requete }) => {
  await limiter(`inscription:${await adresseIp()}`, 5, 3600);
  const { nom, courriel, motDePasse, codeInvitation } = await lireCorps(requete, schemaInscription);

  // Inscription permise si le courriel est sur la liste OU si le code d'invitation est bon.
  const autorises = (process.env.INSCRIPTIONS_AUTORISEES || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (!autorises.includes(courriel) && !codeValide(codeInvitation)) {
    throw new ErreurHttp(403, "Code d'invitation requis ou invalide");
  }

  const existe = await q1('SELECT 1 FROM utilisateurs WHERE courriel = $1', [courriel]);
  if (existe) throw new ErreurHttp(409, 'Un compte existe déjà avec ce courriel');

  const [utilisateur] = await q(
    'INSERT INTO utilisateurs (nom, courriel, mot_de_passe) VALUES ($1, $2, $3) RETURNING id',
    [nom, courriel, await hacherMotDePasse(motDePasse)]
  );
  await creerSession(utilisateur.id);
  return ok({ ok: true }, 201);
}, { public: true });
