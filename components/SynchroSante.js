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
          Une application passerelle sur votre téléphone Android lit Samsung Health (via Health Connect) et envoie
          automatiquement vos pas et votre poids à Cuizinote.
        </p>
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

        <details>
          <summary className="champ__aide">Comment configurer mon téléphone ?</summary>
          <ol className="assistant__liste">
            <li>Dans Samsung Health : Paramètres, Health Connect, autorisez le partage des pas et du poids.</li>
            <li>
              Installez <strong>Life Dashboard Companion</strong> (F-Droid, gratuit) : il envoie les pas et le poids.
              Autre choix : <strong>HC Webhook</strong> (pas seulement, activez l&apos;agrégation des pas).
            </li>
            <li>Dans l&apos;application, ajoutez un webhook avec l&apos;adresse ci-dessus.</li>
            <li>Ajoutez l&apos;en-tête <strong>Authorization</strong> avec la valeur <strong>Bearer</strong> suivie de votre clé.</li>
            <li>Activez les types Pas et Poids, puis utilisez « Envoyer un test » : la date de dernière réception doit apparaître ici.</li>
          </ol>
          <p className="champ__aide">Si votre balance VeSync est reliée à Samsung Health ou Health Connect, les pesées arriveront aussi automatiquement.</p>
        </details>
      </div>
    </section>
  );
}
