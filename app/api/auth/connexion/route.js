import { q1 } from '@/lib/db';
import { creerSession, verifierMotDePasse } from '@/lib/auth';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { schemaConnexion } from '@/lib/schemas';

export const POST = route(async ({ requete }) => {
  const ip = await adresseIp();
  await limiter(`connexion-ip:${ip}`, 20, 900);
  const { courriel, motDePasse } = await lireCorps(requete, schemaConnexion);
  await limiter(`connexion-courriel:${courriel}`, 8, 900);

  const utilisateur = await q1('SELECT id, mot_de_passe FROM utilisateurs WHERE courriel = $1', [courriel]);
  const valide = await verifierMotDePasse(motDePasse, utilisateur?.mot_de_passe);
  if (!utilisateur || !valide) throw new ErreurHttp(401, 'Courriel ou mot de passe incorrect');

  await creerSession(utilisateur.id);
  return ok({ ok: true });
}, { public: true });
