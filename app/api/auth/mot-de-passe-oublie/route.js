import { randomBytes } from 'node:crypto';
import { q, q1 } from '@/lib/db';
import { empreinte } from '@/lib/auth';
import { courrielReinitialisation, envoyerCourriel } from '@/lib/courriel';
import { lireCorps, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { schemaMotDePasseOublie } from '@/lib/schemas';

const DUREE_MINUTES = 60;

/**
 * Envoie un lien de réinitialisation. La réponse est toujours la même, que le compte existe ou non,
 * pour ne pas révéler quels courriels sont inscrits.
 */
export const POST = route(async ({ requete }) => {
  await limiter(`oubli-ip:${await adresseIp()}`, 10, 3600);
  const { courriel } = await lireCorps(requete, schemaMotDePasseOublie);
  await limiter(`oubli-courriel:${courriel}`, 3, 3600);

  const utilisateur = await q1('SELECT id, nom FROM utilisateurs WHERE courriel = $1', [courriel]);
  if (utilisateur) {
    const jeton = randomBytes(32).toString('base64url');
    await q('DELETE FROM reinitialisations WHERE utilisateur_id = $1 OR expire_le < now()', [utilisateur.id]);
    await q(
      `INSERT INTO reinitialisations (empreinte, utilisateur_id, expire_le)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [empreinte(jeton), utilisateur.id, DUREE_MINUTES]
    );
    const base = (process.env.APP_URL || requete.nextUrl.origin).replace(/\/$/, '');
    const lien = `${base}/reinitialiser?jeton=${jeton}`;
    await envoyerCourriel({ a: courriel, ...courrielReinitialisation(utilisateur.nom, lien) });
  }
  return ok({ ok: true });
}, { public: true });
