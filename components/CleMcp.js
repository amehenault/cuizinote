'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, XCircle } from 'lucide-react';
import { api } from '@/lib/client';
import { Message } from './Elements';

/** URL secrète du connecteur Claude (serveur MCP personnel). */
export default function CleMcp() {
  const [etat, setEtat] = useState(null);
  const [url, setUrl] = useState('');
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = () => api('/api/mcp/cle').then(setEtat).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
  }, []);

  async function generer() {
    if (etat?.active && !window.confirm("Créer une nouvelle URL ? L'ancienne cessera de fonctionner dans Claude.")) return;
    try {
      const { cle } = await api('/api/mcp/cle', { methode: 'POST' });
      setUrl(`${window.location.origin}/api/mcp/${cle}`);
      setCopie(false);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function revoquer() {
    if (!window.confirm('Déconnecter Claude ? Le connecteur cessera de fonctionner.')) return;
    await api('/api/mcp/cle', { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    setUrl('');
    charger();
  }

  return (
    <div className="pile">
      <p className="champ__aide">
        Claude peut lire votre inventaire, vos recettes et votre planificateur, planifier des repas et remplir la liste
        d&apos;épicerie. Ajoutez l&apos;URL comme connecteur personnalisé dans Claude (Paramètres, Connecteurs).
      </p>
      {etat?.active && (
        <Message type="succes">
          Connecteur actif.
          {etat.dernier_acces
            ? ` Dernière utilisation : ${new Date(etat.dernier_acces).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}.`
            : " Claude ne s'est pas encore connecté."}
        </Message>
      )}
      {url ? (
        <div className="pile pile--serre">
          <div className="champ__groupe">
            <input className="champ__saisie" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="URL du connecteur" />
            <button type="button" className="bouton bouton--principal" onClick={() => navigator.clipboard.writeText(url).then(() => setCopie(true)).catch(() => {})}>
              <Copy size={16} aria-hidden="true" />
              {copie ? 'Copiée' : 'Copier'}
            </button>
          </div>
          <p className="champ__aide">Elle ne sera plus affichée et donne accès à vos données : gardez-la secrète.</p>
        </div>
      ) : (
        <div className="rangee">
          <button type="button" className="bouton bouton--principal" onClick={generer}>
            {etat?.active ? <RefreshCw size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
            {etat?.active ? 'Créer une nouvelle URL' : 'Créer mon URL'}
          </button>
          {etat?.active && (
            <button type="button" className="bouton bouton--fantome" onClick={revoquer}>
              <XCircle size={16} aria-hidden="true" />
              Déconnecter
            </button>
          )}
        </div>
      )}
      <Message type="erreur">{erreur}</Message>
    </div>
  );
}
