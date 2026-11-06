'use client';

/**
 * Appel à l'API de l'application. Aucune donnée n'est conservée dans le navigateur :
 * la session repose uniquement sur un cookie httpOnly géré par le serveur.
 */
export async function api(chemin, { methode = 'GET', corps, formulaire } = {}) {
  const options = { method: methode, credentials: 'same-origin', headers: {} };
  if (formulaire) options.body = formulaire;
  else if (corps !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(corps);
  }
  const reponse = await fetch(chemin, options);
  if (reponse.status === 401 && !chemin.startsWith('/api/auth/')) {
    window.location.assign('/connexion');
    throw new Error('Session expirée');
  }
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(donnees.erreur || `Erreur ${reponse.status}`);
  return donnees;
}

export const urlImage = (id) => (id ? `/api/images/${id}` : null);
