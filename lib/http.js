import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { utilisateurCourant } from './auth';

export class ErreurHttp extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

export const ok = (donnees, statut = 200) => NextResponse.json(donnees, { status: statut });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifierUuid(valeur) {
  if (typeof valeur !== 'string' || !UUID.test(valeur)) throw new ErreurHttp(404, 'Introuvable');
  return valeur;
}

/** Lit et valide un corps JSON (taille max par défaut : 200 Ko). */
export async function lireCorps(requete, schema, tailleMax = 200_000) {
  const texte = await requete.text();
  if (texte.length > tailleMax) throw new ErreurHttp(413, 'Requête trop volumineuse');
  let brut;
  try {
    brut = texte ? JSON.parse(texte) : {};
  } catch {
    throw new ErreurHttp(400, 'JSON invalide');
  }
  const resultat = schema.safeParse(brut);
  if (!resultat.success) {
    const premiere = resultat.error.issues[0];
    const champ = premiere?.path?.join('.') || 'donnée';
    throw new ErreurHttp(400, `Champ invalide : ${champ}`);
  }
  return resultat.data;
}

/**
 * Enveloppe un gestionnaire de route : authentification obligatoire
 * (sauf { public: true }) et gestion uniforme des erreurs.
 */
export function route(gestionnaire, options = {}) {
  return async (requete, contexte) => {
    try {
      let utilisateur = null;
      if (!options.public) {
        utilisateur = await utilisateurCourant();
        if (!utilisateur) return ok({ erreur: 'Non authentifié' }, 401);
      }
      const params = contexte?.params ? await contexte.params : {};
      return await gestionnaire({ requete, utilisateur, params });
    } catch (erreur) {
      if (erreur instanceof ErreurHttp) return ok({ erreur: erreur.message }, erreur.statut);
      if (erreur instanceof z.ZodError) return ok({ erreur: 'Données invalides' }, 400);
      console.error(erreur);
      return ok({ erreur: 'Erreur interne' }, 500);
    }
  };
}
