import { q, q1 } from '@/lib/db';
import { estAdmin } from '@/lib/admin';
import { detruireSession, verifierMotDePasse } from '@/lib/auth';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { schemaCompte, schemaSuppressionCompte } from '@/lib/schemas';

export const GET = route(async ({ utilisateur }) => {
  const { premier_compte, ...profil } = utilisateur;
  return ok({ ...profil, admin: estAdmin(utilisateur) });
});

// Liste fermée : seuls ces noms de colonnes peuvent entrer dans la requête.
const CHAMPS = ['nom', 'objectif_mode', 'objectif_kcal', 'sexe', 'date_naissance', 'taille_cm', 'activite', 'but'];

export const PATCH = route(async ({ requete, utilisateur }) => {
  const d = await lireCorps(requete, schemaCompte);
  const champs = CHAMPS.filter((c) => d[c] !== undefined);
  if (champs.length) {
    await q(
      `UPDATE utilisateurs SET ${champs.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
      [utilisateur.id, ...champs.map((c) => d[c])]
    );
  }
  return ok({ ok: true });
});

/**
 * Suppression définitive du compte et de toutes ses données (recettes, journal, inventaire, santé...).
 * Les aliments ajoutés restent dans la banque commune, sans auteur.
 */
export const DELETE = route(async ({ requete, utilisateur }) => {
  await limiter(`suppression:${utilisateur.id}`, 5, 3600);
  const { motDePasse } = await lireCorps(requete, schemaSuppressionCompte);
  const ligne = await q1('SELECT mot_de_passe FROM utilisateurs WHERE id = $1', [utilisateur.id]);
  if (!(await verifierMotDePasse(motDePasse, ligne?.mot_de_passe))) throw new ErreurHttp(400, 'Mot de passe incorrect');
  await q('DELETE FROM utilisateurs WHERE id = $1', [utilisateur.id]);
  await detruireSession();
  return ok({ ok: true });
});
