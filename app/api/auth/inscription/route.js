import { q, q1 } from '@/lib/db';
import { creerSession, hacherMotDePasse } from '@/lib/auth';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { schemaInscription } from '@/lib/schemas';

export const POST = route(async ({ requete }) => {
  await limiter(`inscription:${await adresseIp()}`, 5, 3600);
  const { nom, courriel, motDePasse } = await lireCorps(requete, schemaInscription);

  // Application personnelle : seuls les courriels listés peuvent créer un compte.
  const autorises = (process.env.INSCRIPTIONS_AUTORISEES || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (!autorises.includes(courriel)) throw new ErreurHttp(403, 'Les inscriptions sont fermées pour ce courriel');

  const existe = await q1('SELECT 1 FROM utilisateurs WHERE courriel = $1', [courriel]);
  if (existe) throw new ErreurHttp(409, 'Un compte existe déjà avec ce courriel');

  const [utilisateur] = await q(
    'INSERT INTO utilisateurs (nom, courriel, mot_de_passe) VALUES ($1, $2, $3) RETURNING id',
    [nom, courriel, await hacherMotDePasse(motDePasse)]
  );
  await creerSession(utilisateur.id);
  return ok({ ok: true }, 201);
}, { public: true });
