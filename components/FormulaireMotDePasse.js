'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChefHat, KeyRound, Mail } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

/** mode « oubli » : demande du lien par courriel ; mode « nouveau » : choix du nouveau mot de passe. */
export default function FormulaireMotDePasse({ mode, jeton = '' }) {
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState({ type: 'info', texte: '' });
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setMessage({ type: 'info', texte: '' });
    if (mode === 'nouveau' && motDePasse !== confirmation) {
      setMessage({ type: 'erreur', texte: 'Les deux mots de passe ne sont pas identiques.' });
      return;
    }
    setEnvoi(true);
    try {
      if (mode === 'oubli') {
        await api('/api/auth/mot-de-passe-oublie', { methode: 'POST', corps: { courriel } });
        setEnvoye(true);
      } else {
        await api('/api/auth/reinitialiser', { methode: 'POST', corps: { jeton, motDePasse } });
        window.location.assign('/');
        return;
      }
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
    setEnvoi(false);
  }

  const lienInvalide = mode === 'nouveau' && !jeton;

  return (
    <main className="auth">
      <div className="auth__boite">
        <div className="auth__marque">
          <ChefHat size={32} aria-hidden="true" />
          Cuizinote
        </div>
        <div className="pile pile--serre">
          <h1>{mode === 'oubli' ? 'Mot de passe oublié' : 'Nouveau mot de passe'}</h1>
          <p className="auth__texte">
            {mode === 'oubli'
              ? 'Entrez votre courriel : vous recevrez un lien pour choisir un nouveau mot de passe.'
              : 'Choisissez votre nouveau mot de passe (12 caractères minimum).'}
          </p>
        </div>

        {envoye ? (
          <Message type="succes">
            Si un compte existe avec ce courriel, un lien vient d&apos;être envoyé. Il est valide 1 heure. Pensez à
            regarder dans vos courriels indésirables.
          </Message>
        ) : lienInvalide ? (
          <Message type="erreur">Ce lien est incomplet. Faites une nouvelle demande.</Message>
        ) : (
          <form className="formulaire" onSubmit={soumettre}>
            {mode === 'oubli' ? (
              <label className="champ">
                <span className="champ__libelle">Courriel</span>
                <input className="champ__saisie" type="email" autoComplete="email" required maxLength={200} value={courriel} onChange={(e) => setCourriel(e.target.value)} />
              </label>
            ) : (
              <>
                <label className="champ">
                  <span className="champ__libelle">Nouveau mot de passe</span>
                  <input className="champ__saisie" type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                  <span className="champ__aide">12 caractères minimum.</span>
                </label>
                <label className="champ">
                  <span className="champ__libelle">Confirmer le mot de passe</span>
                  <input className="champ__saisie" type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
                </label>
              </>
            )}
            <Message type={message.type}>{message.texte}</Message>
            <button type="submit" className="bouton bouton--principal bouton--bloc" disabled={envoi}>
              {mode === 'oubli' ? <Mail size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
              {envoi ? 'Un instant...' : mode === 'oubli' ? 'Recevoir le lien' : 'Enregistrer et me connecter'}
            </button>
          </form>
        )}
        <p className="auth__texte">
          {mode === 'nouveau' && lienInvalide ? <><Link href="/mot-de-passe-oublie">Nouvelle demande</Link> · </> : null}
          <Link href="/connexion">Retour à la connexion</Link>
        </p>
      </div>
    </main>
  );
}
