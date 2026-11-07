'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { Message, Modale } from './Elements';

/** Suppression définitive du compte, après double confirmation (mot de passe + mot SUPPRIMER). */
export default function SuppressionCompte() {
  const [ouverte, setOuverte] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function supprimer(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await api('/api/compte', { methode: 'DELETE', corps: { motDePasse, confirmation } });
      window.location.assign('/connexion');
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  function fermer() {
    setOuverte(false);
    setMotDePasse('');
    setConfirmation('');
    setErreur('');
  }

  return (
    <div className="pile">
      <div>
        <button type="button" className="bouton bouton--danger" onClick={() => setOuverte(true)}>
          <Trash2 size={16} aria-hidden="true" />
          Supprimer mon compte
        </button>
      </div>

      <Modale titre="Supprimer mon compte ?" ouverte={ouverte} onFermer={fermer}>
        <form className="formulaire" onSubmit={supprimer}>
          <Message type="alerte">Cette action est définitive : rien ne pourra être récupéré.</Message>
          <label className="champ">
            <span className="champ__libelle">Mot de passe</span>
            <input className="champ__saisie" type="password" autoComplete="current-password" required maxLength={200} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
          </label>
          <label className="champ">
            <span className="champ__libelle">Écrivez SUPPRIMER pour confirmer</span>
            <input className="champ__saisie" autoComplete="off" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          <Message type="erreur">{erreur}</Message>
          <div className="formulaire__actions">
            <button type="button" className="bouton bouton--secondaire" onClick={fermer}>Annuler</button>
            <button type="submit" className="bouton bouton--danger" disabled={envoi || confirmation !== 'SUPPRIMER' || !motDePasse}>
              <Trash2 size={16} aria-hidden="true" />
              {envoi ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </div>
        </form>
      </Modale>
    </div>
  );
}
