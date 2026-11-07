'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Message } from './Elements';

function delai(ms) {
  const minutes = Math.max(Math.round(ms / 60000), 0);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Paramètres : quota gratuit de l'IA (Google Gemini) restant aujourd'hui, pour toute l'application. */
export default function UtilisationIA() {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api('/api/ia/utilisation').then(setEtat).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Message type="erreur">{erreur}</Message>;
  if (!etat) return null;

  const restant = 100 - etat.pourcentage;
  const fin = new Date(etat.reinitialisation);
  const couleur = restant <= 10 ? 'var(--couleur-danger)' : restant <= 30 ? 'var(--couleur-alerte)' : 'var(--couleur-succes)';

  return (
    <div className="pile pile--serre">
      <div className="rangee" style={{ justifyContent: 'space-between' }}>
        <span className="liste__titre">{restant} % restant aujourd&apos;hui</span>
        <span className="liste__detail">{etat.pourcentage} % utilisé</span>
      </div>
      <div
        role="progressbar"
        aria-label="Quota d'IA utilisé aujourd'hui"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={etat.pourcentage}
        style={{ height: 12, borderRadius: 999, background: 'var(--couleur-bordure)', overflow: 'hidden' }}
      >
        <div style={{ width: `${etat.pourcentage}%`, height: '100%', background: couleur, transition: 'width .3s' }} />
      </div>
      <p className="champ__aide">
        {etat.epuise
          ? 'Quota épuisé : l’IA est indisponible jusqu’à la remise à zéro. '
          : `${etat.utilisees} demande${etat.utilisees > 1 ? 's' : ''} sur environ ${etat.limite} aujourd'hui. `}
        Remise à zéro le {fin.toLocaleString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}{' '}
        (dans {delai(fin.getTime() - Date.now())}).
      </p>
      <p className="champ__aide">
        Ce quota gratuit de Google (environ 20 demandes par jour pour chacun des 3 modèles) est partagé par tous les comptes
        Cuizinote : assistant, traduction des aliments et étiquetage des recettes. C&apos;est une estimation ; Google
        n&apos;affiche pas le restant du jour.
      </p>
    </div>
  );
}
