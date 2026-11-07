'use client';

import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

/** Prénom, courriel et changement du mot de passe. */
export default function GestionCompte({ compte, onChange }) {
  const [nom, setNom] = useState(compte.nom);
  const [mdp, setMdp] = useState({ actuel: '', nouveau: '', confirmation: '' });
  const [messageNom, setMessageNom] = useState({ type: 'info', texte: '' });
  const [messageMdp, setMessageMdp] = useState({ type: 'info', texte: '' });
  const [envoi, setEnvoi] = useState(false);

  async function enregistrerNom(e) {
    e.preventDefault();
    try {
      await api('/api/compte', { methode: 'PATCH', corps: { nom } });
      setMessageNom({ type: 'succes', texte: 'Prénom enregistré.' });
      onChange?.();
    } catch (err) {
      setMessageNom({ type: 'erreur', texte: err.message });
    }
  }

  async function changerMotDePasse(e) {
    e.preventDefault();
    if (mdp.nouveau !== mdp.confirmation) {
      setMessageMdp({ type: 'erreur', texte: 'Les deux nouveaux mots de passe ne sont pas identiques.' });
      return;
    }
    setEnvoi(true);
    try {
      await api('/api/compte/mot-de-passe', { methode: 'POST', corps: { actuel: mdp.actuel, nouveau: mdp.nouveau } });
      setMdp({ actuel: '', nouveau: '', confirmation: '' });
      setMessageMdp({ type: 'succes', texte: 'Mot de passe changé. Vos autres appareils ont été déconnectés.' });
    } catch (err) {
      setMessageMdp({ type: 'erreur', texte: err.message });
    }
    setEnvoi(false);
  }

  const champMdp = (cle) => ({ value: mdp[cle], onChange: (e) => setMdp((m) => ({ ...m, [cle]: e.target.value })) });

  return (
    <div className="pile pile--large">
      <form className="formulaire" onSubmit={enregistrerNom}>
        <div className="formulaire__ligne">
          <label className="champ">
            <span className="champ__libelle">Prénom</span>
            <input className="champ__saisie" required maxLength={80} value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <div className="champ">
            <span className="champ__libelle">Courriel</span>
            <input className="champ__saisie" readOnly value={compte.courriel} aria-readonly="true" />
          </div>
        </div>
        <div>
          <button type="submit" className="bouton bouton--secondaire" disabled={nom.trim() === compte.nom}>
            <Save size={16} aria-hidden="true" />
            Enregistrer le prénom
          </button>
        </div>
        <Message type={messageNom.type}>{messageNom.texte}</Message>
      </form>

      <form className="formulaire" onSubmit={changerMotDePasse}>
        <p className="liste__titre">Changer mon mot de passe</p>
        <label className="champ">
          <span className="champ__libelle">Mot de passe actuel</span>
          <input className="champ__saisie" type="password" autoComplete="current-password" required maxLength={200} {...champMdp('actuel')} />
        </label>
        <div className="formulaire__ligne">
          <label className="champ">
            <span className="champ__libelle">Nouveau mot de passe</span>
            <input className="champ__saisie" type="password" autoComplete="new-password" required minLength={12} maxLength={200} {...champMdp('nouveau')} />
            <span className="champ__aide">12 caractères minimum.</span>
          </label>
          <label className="champ">
            <span className="champ__libelle">Confirmer</span>
            <input className="champ__saisie" type="password" autoComplete="new-password" required minLength={12} maxLength={200} {...champMdp('confirmation')} />
          </label>
        </div>
        <div>
          <button type="submit" className="bouton bouton--principal" disabled={envoi}>
            <KeyRound size={16} aria-hidden="true" />
            {envoi ? 'Un instant...' : 'Changer le mot de passe'}
          </button>
        </div>
        <Message type={messageMdp.type}>{messageMdp.texte}</Message>
      </form>
    </div>
  );
}
