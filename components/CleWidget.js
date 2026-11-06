'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

/** Clé à coller dans l'application Android « Widget Cuizinote ». */
export default function CleWidget() {
  const [etat, setEtat] = useState(null);
  const [cle, setCle] = useState('');
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = () => api('/api/widget/cle').then(setEtat).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
  }, []);

  async function generer() {
    if (etat?.active && !window.confirm('Générer une nouvelle clé ? Le widget devra recevoir la nouvelle.')) return;
    try {
      setCle((await api('/api/widget/cle', { methode: 'POST' })).cle);
      setCopie(false);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function revoquer() {
    if (!window.confirm('Révoquer la clé ? Le widget cessera de s\'afficher.')) return;
    await api('/api/widget/cle', { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    setCle('');
    charger();
  }

  return (
    <section className="carte">
      <div className="carte__entete">
        <h2 className="carte__titre"><Smartphone size={18} aria-hidden="true" />Widget Android</h2>
        {etat?.active && <span className="etiquette">Actif</span>}
      </div>
      <div className="carte__corps">
        <p className="champ__aide">
          Affichez vos calories mangées aujourd&apos;hui sur l&apos;écran d&apos;accueil de votre téléphone. Le widget ne peut
          que lire ce total : il ne modifie rien.
        </p>
        {etat?.dernier_acces && (
          <p className="champ__aide">
            Dernière mise à jour du widget : {new Date(etat.dernier_acces).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
        {cle && (
          <div className="pile pile--serre">
            <Message type="alerte">Copiez la clé maintenant : elle ne sera plus affichée.</Message>
            <div className="champ__groupe">
              <input className="champ__saisie" readOnly value={cle} onFocus={(e) => e.target.select()} aria-label="Clé du widget" />
              <button type="button" className="bouton bouton--secondaire" onClick={() => navigator.clipboard.writeText(cle).then(() => setCopie(true)).catch(() => {})}>
                <Copy size={16} aria-hidden="true" />
                {copie ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        )}
        <div className="rangee">
          <button type="button" className="bouton bouton--principal" onClick={generer}>
            {etat?.active ? <RefreshCw size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
            {etat?.active ? 'Nouvelle clé' : 'Créer la clé du widget'}
          </button>
          {etat?.active && (
            <button type="button" className="bouton bouton--fantome" onClick={revoquer}>
              <XCircle size={16} aria-hidden="true" />
              Révoquer
            </button>
          )}
        </div>
        <details>
          <summary className="champ__aide">Comment installer le widget ?</summary>
          <ol className="assistant__liste synchro__etapes">
            <li>Sur votre téléphone, installez l&apos;application « Widget Cuizinote » (fichier APK fourni).</li>
            <li>Ici, touchez « Créer la clé du widget » et copiez la clé.</li>
            <li>Ouvrez l&apos;application Widget Cuizinote, collez la clé et touchez « Enregistrer ».</li>
            <li>Sur l&apos;écran d&apos;accueil : appui long, Widgets, Cuizinote, puis glissez le widget où vous voulez.</li>
          </ol>
        </details>
        <Message type="erreur">{erreur}</Message>
      </div>
    </section>
  );
}
