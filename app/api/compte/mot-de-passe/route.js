import { q, q1 } from '@/lib/db';
import { empreinteSessionCourante, hacherMotDePasse, verifierMotDePasse } from '@/lib/auth';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { schemaChangementMotDePasse } from '@/lib/schemas';

/** Changement du mot de passe : l'actuel est exigé ; les autres appareils sont déconnectés. */
export const POST = route(async ({ requete, utilisateur }) => {
  await limiter(`mdp:${utilisateur.id}`, 10, 3600);
  const { actuel, nouveau } = await lireCorps(requete, schemaChangementMotDePasse);
  const ligne = await q1('SELECT mot_de_passe FROM utilisateurs WHERE id = $1', [utilisateur.id]);
  if (!(await verifierMotDePasse(actuel, ligne?.mot_de_passe))) throw new ErreurHttp(400, 'Mot de passe actuel incorrect');
  await q('UPDATE utilisateurs SET mot_de_passe = $1 WHERE id = $2', [await hacherMotDePasse(nouveau), utilisateur.id]);
  await q('DELETE FROM sessions WHERE utilisateur_id = $1 AND empreinte <> $2', [
    utilisateur.id,
    (await empreinteSessionCourante()) || '',
  ]);
  return ok({ ok: true });
});
