'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChefHat, LogIn, UserPlus } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

export default function FormulaireAuth({ mode }) {
  const inscription = mode === 'inscription';
  const [valeurs, setValeurs] = useState({ nom: '', courriel: '', motDePasse: '', codeInvitation: '' });
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await api(`/api/auth/${mode}`, {
        methode: 'POST',
        corps: inscription ? valeurs : { courriel: valeurs.courriel, motDePasse: valeurs.motDePasse },
      });
      window.location.assign('/');
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  const champ = (cle) => ({ value: valeurs[cle], onChange: (e) => setValeurs((v) => ({ ...v, [cle]: e.target.value })) });

  return (
    <main className="auth">
      <div className="auth__boite">
        <div className="auth__marque">
          <ChefHat size={32} aria-hidden="true" />
          Cuizinote
        </div>
        <div className="pile pile--serre">
          <h1>{inscription ? 'Créer mon compte' : 'Connexion'}</h1>
          <p className="auth__texte">
            {inscription ? 'Vos données sont protégées et stockées de façon sécurisée.' : 'Heureux de vous revoir.'}
          </p>
        </div>
        <form className="formulaire" onSubmit={soumettre}>
          {inscription && (
            <label className="champ">
              <span className="champ__libelle">Prénom</span>
              <input className="champ__saisie" autoComplete="given-name" required maxLength={80} {...champ('nom')} />
            </label>
          )}
          <label className="champ">
            <span className="champ__libelle">Courriel</span>
            <input className="champ__saisie" type="email" autoComplete="email" required maxLength={200} {...champ('courriel')} />
          </label>
          <label className="champ">
            <span className="champ__libelle">Mot de passe</span>
            <input
              className="champ__saisie"
              type="password"
              autoComplete={inscription ? 'new-password' : 'current-password'}
              required
              minLength={inscription ? 12 : 1}
              maxLength={200}
              {...champ('motDePasse')}
            />
            {inscription ? (
              <span className="champ__aide">12 caractères minimum.</span>
            ) : (
              <Link href="/mot-de-passe-oublie" className="champ__aide auth__oubli">Mot de passe oublié ?</Link>
            )}
          </label>
          {inscription && (
            <label className="champ">
              <span className="champ__libelle">Code d&apos;invitation</span>
              <input className="champ__saisie" autoComplete="off" maxLength={100} {...champ('codeInvitation')} />
              <span className="champ__aide">Fourni par la personne qui vous invite.</span>
            </label>
          )}
          <Message type="erreur">{erreur}</Message>
          <button type="submit" className="bouton bouton--principal bouton--bloc" disabled={envoi}>
            {inscription ? <UserPlus size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
            {envoi ? 'Un instant...' : inscription ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
        <p className="auth__texte">
          {inscription ? (
            <>Déjà un compte ? <Link href="/connexion">Se connecter</Link></>
          ) : (
            <>Première visite ? <Link href="/inscription">Créer un compte</Link></>
          )}
        </p>
      </div>
    </main>
  );
}
