'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Apple, Bot, LogOut, Target, UserRound } from 'lucide-react';
import { api } from '@/lib/client';
import { EntetePage, Message, versNombre } from '@/components/Elements';
import CleWidget from '@/components/CleWidget';
import ImportCookmate from '@/components/ImportCookmate';
import SynchroSante from '@/components/SynchroSante';

export default function PageParametres() {
  const [compte, setCompte] = useState(null);
  const [objectif, setObjectif] = useState('');
  const [message, setMessage] = useState({ type: 'info', texte: '' });

  useEffect(() => {
    api('/api/compte')
      .then((u) => {
        setCompte(u);
        setObjectif(u.objectif_kcal ? String(u.objectif_kcal) : '');
      })
      .catch((e) => setMessage({ type: 'erreur', texte: e.message }));
  }, []);

  async function enregistrerObjectif(e) {
    e.preventDefault();
    const n = versNombre(objectif);
    try {
      await api('/api/compte', { methode: 'PATCH', corps: { objectif_kcal: n ? Math.round(n) : null } });
      setMessage({ type: 'succes', texte: 'Objectif calorique enregistré.' });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
  }

  async function deconnecter() {
    await api('/api/auth/deconnexion', { methode: 'POST' }).catch(() => {});
    window.location.assign('/connexion');
  }

  return (
    <div className="pile pile--large">
      <EntetePage titre="Paramètres" sousTitre="Votre compte, vos objectifs et vos appareils connectés" />
      <Message type={message.type}>{message.texte}</Message>

      <section className="carte">
        <div className="carte__entete">
          <h2 className="carte__titre"><UserRound size={18} aria-hidden="true" />Mon compte</h2>
        </div>
        <div className="carte__corps">
          {compte && (
            <div>
              <p className="liste__titre">{compte.nom}</p>
              <p className="liste__detail">{compte.courriel}</p>
            </div>
          )}
          <div>
            <button type="button" className="bouton bouton--secondaire" onClick={deconnecter}>
              <LogOut size={16} aria-hidden="true" />
              Se déconnecter
            </button>
          </div>
        </div>
      </section>

      <section className="carte">
        <div className="carte__entete">
          <h2 className="carte__titre"><Target size={18} aria-hidden="true" />Objectif calorique quotidien</h2>
        </div>
        <form className="carte__corps" onSubmit={enregistrerObjectif}>
          <p className="champ__aide">Utilisé dans le planificateur et l&apos;accueil pour comparer vos repas à votre objectif.</p>
          <div className="rangee">
            <input
              className="champ__saisie champ__saisie--court"
              inputMode="numeric"
              placeholder="Ex. : 1800"
              value={objectif}
              onChange={(e) => setObjectif(e.target.value)}
              aria-label="Objectif en kcal"
            />
            <span className="champ__aide">kcal par jour</span>
            <button type="submit" className="bouton bouton--principal">Enregistrer</button>
          </div>
        </form>
      </section>

      <SynchroSante />

      <CleWidget />

      <ImportCookmate />

      <section className="carte">
        <div className="carte__entete">
          <h2 className="carte__titre">Autres outils</h2>
        </div>
        <div className="carte__corps">
          <div className="rangee">
            <Link href="/aliments" className="bouton bouton--secondaire">
              <Apple size={16} aria-hidden="true" />
              Banque d&apos;aliments
            </Link>
            <Link href="/assistant" className="bouton bouton--secondaire">
              <Bot size={16} aria-hidden="true" />
              Assistant culinaire
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
