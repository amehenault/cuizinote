'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound, RefreshCw, XCircle } from 'lucide-react';
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

/** Samsung Health -> Health Connect -> Life Dashboard Companion -> Cuizinote (pas et poids). */
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
    if (etat?.active && !window.confirm('Créer une nouvelle clé ? L\'ancienne cessera de fonctionner.')) return;
    try {
      setCle((await api('/api/sante/cle', { methode: 'POST' })).cle);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function revoquer() {
    if (!window.confirm('Arrêter la réception des données de Samsung Health ?')) return;
    await api('/api/sante/cle', { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    setCle('');
    charger();
  }

  return (
    <div className="pile">
      <p className="champ__aide">
        Vos pas et votre poids arrivent tout seuls dans Cuizinote. Samsung Health ne parle pas directement aux sites Web :
        une petite application gratuite fait le pont. <strong>Faites ces étapes sur le téléphone</strong> (environ 10
        minutes, une seule fois).
      </p>
      {adresse.includes('localhost') && (
        <Message type="alerte">Version locale : faites cette étape sur le site en ligne (cuizinote.vercel.app).</Message>
      )}
      {etat?.active && (
        <Message type={etat.derniere_synchro ? 'succes' : 'alerte'}>
          {etat.derniere_synchro
            ? `Connecté. Dernière réception : ${new Date(etat.derniere_synchro).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}.`
            : 'Clé créée, mais aucune donnée reçue pour l\'instant. Terminez les étapes 4 et 5.'}
        </Message>
      )}

      <ol className="etapes">
        <li className="etapes__element">
          <p className="etapes__titre">Autorisez Samsung Health à partager</p>
          <p className="champ__aide">
            Samsung Health, menu <strong>≡</strong> (ou <strong>⋮</strong>), Paramètres, <strong>Health Connect</strong>.
            Activez le partage des <strong>Pas</strong> et du <strong>Poids</strong>.
          </p>
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Installez « Life Dashboard Companion »</p>
          <p className="champ__aide">
            Elle n&apos;est pas sur le Play Store : installez d&apos;abord F-Droid, puis cherchez « Life Dashboard
            Companion » dans F-Droid et installez-la.
          </p>
          <a className="bouton bouton--secondaire" href="https://f-droid.org/fr/" target="_blank" rel="noopener noreferrer">
            <Download size={16} aria-hidden="true" />
            Télécharger F-Droid
          </a>
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Créez votre clé</p>
          {cle ? (
            <div className="pile">
              <Message type="alerte">Gardez cette page ouverte : la clé ne sera plus affichée.</Message>
              <Copiable libelle="Adresse (Webhook URL)" valeur={adresse} />
              <Copiable libelle="Nom de l'en-tête (Header name)" valeur="Authorization" />
              <Copiable libelle="Valeur de l'en-tête (Header value)" valeur={`Bearer ${cle}`} />
            </div>
          ) : (
            <div className="rangee">
              <button type="button" className="bouton bouton--principal" onClick={generer}>
                {etat?.active ? <RefreshCw size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
                {etat?.active ? 'Créer une nouvelle clé' : 'Créer ma clé'}
              </button>
              {etat?.active && (
                <button type="button" className="bouton bouton--fantome" onClick={revoquer}>
                  <XCircle size={16} aria-hidden="true" />
                  Arrêter
                </button>
              )}
            </div>
          )}
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Collez-la dans Life Dashboard Companion</p>
          <p className="champ__aide">
            Onglet Santé : autorisez la lecture des pas et du poids. Ajoutez un <strong>webhook</strong> : collez
            l&apos;adresse. Dans <strong>Headers</strong>, ajoutez le nom <strong>Authorization</strong> et la valeur qui
            commence par <strong>Bearer czs_</strong>.
          </p>
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Testez</p>
          <p className="champ__aide">
            Touchez « Send test ». Rechargez cette page : le message vert « Connecté » doit apparaître. C&apos;est fini.
          </p>
        </li>
      </ol>
      <p className="champ__aide">
        Balance VeSync : reliez l&apos;application VeSync à Samsung Health ou Health Connect, et vos pesées suivront.
      </p>
      {etat?.dernier_envoi && <DernierEnvoi envoi={etat.dernier_envoi} />}
      <Message type="erreur">{erreur}</Message>
    </div>
  );
}

/** Diagnostic : ce que la passerelle a réellement envoyé la dernière fois. */
function DernierEnvoi({ envoi }) {
  const { retenu = {} } = envoi;
  const jours = { ...(retenu.intervalles_par_jour || {}), ...(retenu.totaux_quotidiens || {}) };
  const texte = JSON.stringify(envoi, null, 2);
  return (
    <details className="pile pile--serre">
      <summary className="liste__titre">Détails du dernier envoi (diagnostic)</summary>
      <p className="champ__aide">
        Reçu le {new Date(envoi.recu_le).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}
        {envoi.test ? ' (envoi de test)' : ''}.
        {Object.keys(jours).length
          ? ` Pas retenus : ${Object.entries(jours).sort().map(([j, n]) => `${j} = ${n}`).join(', ')}.`
          : ' Aucun pas retenu dans cet envoi.'}
      </p>
      <pre className="champ__aide" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '20rem', overflow: 'auto' }}>{texte}</pre>
      <div>
        <button type="button" className="bouton bouton--secondaire" onClick={() => navigator.clipboard.writeText(texte).catch(() => {})}>
          <Copy size={16} aria-hidden="true" />
          Copier les détails
        </button>
      </div>
    </details>
  );
}
