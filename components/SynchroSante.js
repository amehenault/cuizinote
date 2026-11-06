'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

function Copiable({ libelle, valeur }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="champ">
      <span className="champ__libelle">{libelle}</span>
      <div className="champ__groupe">
        <input className="champ__saisie" readOnly value={valeur} onFocus={(e) => e.target.select()} aria-label={libelle} />
        <button
          type="button"
          className="bouton bouton--secondaire"
          onClick={() => navigator.clipboard.writeText(valeur).then(() => setCopie(true)).catch(() => {})}
        >
          <Copy size={16} aria-hidden="true" />
          {copie ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  );
}

/** Connexion d'une application passerelle Android (Samsung Health / Health Connect) à Cuizinote. */
export default function SynchroSante() {
  const [etat, setEtat] = useState(null);
  const [cle, setCle] = useState('');
  const [erreur, setErreur] = useState('');
  const [adresse, setAdresse] = useState('');

  const charger = () => api('/api/sante/cle').then(setEtat).catch((e) => setErreur(e.message));
  useEffect(() => {
    setAdresse(`${window.location.origin}/api/sante/reception`);
    charger();
  }, []);

  async function generer() {
    if (etat?.active && !window.confirm('Générer une nouvelle clé ? L\'ancienne cessera de fonctionner.')) return;
    try {
      const r = await api('/api/sante/cle', { methode: 'POST' });
      setCle(r.cle);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function revoquer() {
    if (!window.confirm('Révoquer la clé ? La synchronisation s\'arrêtera.')) return;
    await api('/api/sante/cle', { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    setCle('');
    charger();
  }

  return (
    <section className="carte">
      <div className="carte__entete">
        <h2 className="carte__titre"><Smartphone size={18} aria-hidden="true" />Synchronisation automatique</h2>
        {etat?.active && <span className="etiquette">Active</span>}
      </div>
      <div className="carte__corps">
        <p className="champ__aide">
          Samsung Health ne peut pas envoyer ses données directement à un site Web. Une petite application gratuite
          installée sur votre téléphone Android (Life Dashboard Companion) lit vos pas et votre poids, puis les envoie
          à Cuizinote plusieurs fois par jour, sans que vous ayez rien à faire.
        </p>
        {adresse.includes('localhost') && (
          <Message type="alerte">
            Vous êtes sur la version locale : votre téléphone ne pourra pas joindre cette adresse. Faites cette étape
            sur le site en ligne (cuizinote.vercel.app).
          </Message>
        )}
        {etat?.active && (
          <p className="champ__aide">
            {etat.derniere_synchro
              ? `Dernière réception : ${new Date(etat.derniere_synchro).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'Aucune donnée reçue pour le moment.'}
          </p>
        )}

        {cle && (
          <div className="pile">
            <Message type="alerte">Copiez la clé maintenant : elle ne sera plus jamais affichée.</Message>
            <Copiable libelle="Adresse (Webhook URL)" valeur={adresse} />
            <Copiable libelle="En-tête : nom" valeur="Authorization" />
            <Copiable libelle="En-tête : valeur" valeur={`Bearer ${cle}`} />
          </div>
        )}

        <div className="rangee">
          <button type="button" className="bouton bouton--principal" onClick={generer}>
            {etat?.active ? <RefreshCw size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
            {etat?.active ? 'Générer une nouvelle clé' : 'Activer la synchronisation'}
          </button>
          {etat?.active && (
            <button type="button" className="bouton bouton--fantome" onClick={revoquer}>
              <XCircle size={16} aria-hidden="true" />
              Révoquer
            </button>
          )}
        </div>
        <Message type="erreur">{erreur}</Message>

        <details open={!etat?.derniere_synchro}>
          <summary className="liste__titre">Marche à suivre (une seule fois, environ 10 minutes)</summary>
          <ol className="assistant__liste synchro__etapes">
            <li>
              <strong>Ici, dans Cuizinote :</strong> cliquez sur « Activer la synchronisation ». Copiez l&apos;adresse et la
              valeur de l&apos;en-tête, puis envoyez-les-vous (courriel ou notes) pour les avoir sur votre téléphone.
            </li>
            <li>
              <strong>Dans Samsung Health :</strong> menu, Paramètres, Health Connect. Autorisez le partage des pas et du
              poids. Sur Android 14 et plus, Health Connect se trouve aussi dans les paramètres du téléphone.
            </li>
            <li>
              <strong>Installez l&apos;application :</strong> elle n&apos;est pas sur le Play Store. Installez d&apos;abord
              F-Droid (f-droid.org), puis cherchez « Life Dashboard Companion » et installez-la.
            </li>
            <li>
              <strong>Dans Life Dashboard Companion :</strong> onglet Santé, autorisez la lecture des pas et du poids. Ajoutez
              un webhook avec l&apos;adresse copiée. Dans « Headers » (en-têtes), ajoutez le nom <strong>Authorization</strong> et
              la valeur qui commence par <strong>Bearer czs_</strong>.
            </li>
            <li>
              <strong>Testez :</strong> appuyez sur « Send test » (Envoyer un test). En rechargeant cette page, la ligne
              « Dernière réception » doit afficher l&apos;heure du test. C&apos;est terminé : vos pas et votre poids
              arriveront ensuite automatiquement.
            </li>
          </ol>
          <p className="champ__aide">
            Les pesées de votre balance VeSync arrivent aussi, si l&apos;application VeSync est reliée à Samsung Health ou
            Health Connect. Clé perdue ? Générez-en une nouvelle et remplacez-la dans l&apos;application.
          </p>
        </details>
      </div>
    </section>
  );
}
