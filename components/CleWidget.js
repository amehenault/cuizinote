'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound, RefreshCw, XCircle } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

const APK = 'https://github.com/amehenault/widget-cuizinote/releases/latest/download/widget-cuizinote.apk';

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
    if (etat?.active && !window.confirm('Créer une nouvelle clé ? Il faudra la recoller dans le widget.')) return;
    try {
      setCle((await api('/api/widget/cle', { methode: 'POST' })).cle);
      setCopie(false);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function revoquer() {
    if (!window.confirm('Désactiver le widget ? Il cessera de se mettre à jour.')) return;
    await api('/api/widget/cle', { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    setCle('');
    charger();
  }

  return (
    <div className="pile">
      <p className="champ__aide">
        Vos calories du jour sur l&apos;écran d&apos;accueil de votre téléphone Android. <strong>Faites ces étapes sur le
        téléphone</strong>, dans Cuizinote ouvert dans le navigateur.
      </p>
      {etat?.active && (
        <Message type="succes">
          Widget actif.
          {etat.dernier_acces
            ? ` Dernière mise à jour : ${new Date(etat.dernier_acces).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}.`
            : ' Il ne s\'est pas encore connecté.'}
        </Message>
      )}

      <ol className="etapes">
        <li className="etapes__element">
          <p className="etapes__titre">Téléchargez l&apos;application</p>
          <a className="bouton bouton--secondaire" href={APK} rel="noopener noreferrer">
            <Download size={16} aria-hidden="true" />
            Télécharger le widget (APK)
          </a>
          <p className="champ__aide">
            Ouvrez le fichier téléchargé et touchez « Installer ». Si Android bloque : « Paramètres », puis autorisez
            l&apos;installation depuis ce navigateur.
          </p>
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Copiez votre clé</p>
          {cle ? (
            <div className="pile pile--serre">
              <div className="champ__groupe">
                <input className="champ__saisie" readOnly value={cle} onFocus={(e) => e.target.select()} aria-label="Clé du widget" />
                <button type="button" className="bouton bouton--principal" onClick={() => navigator.clipboard.writeText(cle).then(() => setCopie(true)).catch(() => {})}>
                  <Copy size={16} aria-hidden="true" />
                  {copie ? 'Copiée' : 'Copier'}
                </button>
              </div>
              <p className="champ__aide">Elle ne sera plus affichée : collez-la tout de suite (étape 3).</p>
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
                  Désactiver
                </button>
              )}
            </div>
          )}
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Collez la clé dans l&apos;application</p>
          <p className="champ__aide">Ouvrez « Widget Cuizinote », collez la clé, touchez « Enregistrer ».</p>
        </li>
        <li className="etapes__element">
          <p className="etapes__titre">Ajoutez le widget à l&apos;écran d&apos;accueil</p>
          <p className="champ__aide">
            Appui long sur un espace vide de l&apos;écran, « Widgets », « Widget Cuizinote », puis glissez-le. Touchez-le
            pour le mettre à jour.
          </p>
          <p className="champ__aide">
            Sur Samsung : Paramètres, Applications, Widget Cuizinote, Batterie, « Non restreinte », sinon il ne se met pas à
            jour tout seul.
          </p>
        </li>
      </ol>
      <Message type="erreur">{erreur}</Message>
    </div>
  );
}

