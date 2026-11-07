import { q1, transaction } from '@/lib/db';
import { creerSession, empreinte, hacherMotDePasse } from '@/lib/auth';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { schemaReinitialisation } from '@/lib/schemas';

/** Nouveau mot de passe à partir d'un lien reçu par courriel (usage unique, 1 heure). */
export const POST = route(async ({ requete }) => {
  await limiter(`reinit-ip:${await adresseIp()}`, 20, 3600);
  const { jeton, motDePasse } = await lireCorps(requete, schemaReinitialisation);

  const demande = await q1(
    'SELECT utilisateur_id FROM reinitialisations WHERE empreinte = $1 AND expire_le > now()',
    [empreinte(jeton)]
  );
  if (!demande) throw new ErreurHttp(400, 'Ce lien est expiré ou a déjà servi. Faites une nouvelle demande.');

  const hache = await hacherMotDePasse(motDePasse);
  // Mot de passe changé, lien consommé et toutes les sessions ouvertes fermées.
  await transaction([
    ['UPDATE utilisateurs SET mot_de_passe = $1 WHERE id = $2', [hache, demande.utilisateur_id]],
    ['DELETE FROM reinitialisations WHERE utilisateur_id = $1', [demande.utilisateur_id]],
    ['DELETE FROM sessions WHERE utilisateur_id = $1', [demande.utilisateur_id]],
  ]);
  await creerSession(demande.utilisateur_id);
  return ok({ ok: true });
}, { public: true });
