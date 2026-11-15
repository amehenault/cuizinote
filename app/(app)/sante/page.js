'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Smartphone, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import { enLb, nombreFr } from '@/lib/dates';
import { EntetePage, Message, versNombre } from '@/components/Elements';
import { GraphiqueLigne } from '@/components/Graphiques';
import RecapCalories from '@/components/RecapCalories';

const PERIODES = [
  [30, '30 jours'],
  [90, '3 mois'],
  [365, '1 an'],
];

function maintenantLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Lit un fichier CSV dans le navigateur (en mémoire seulement) et l'envoie au serveur. */
function BoutonImport({ libelle, route, onTermine, onErreur }) {
  const [envoi, setEnvoi] = useState(false);
  async function choisir(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (fichier.size > 5_000_000) return onErreur('Fichier trop volumineux (5 Mo maximum).');
    setEnvoi(true);
    try {
      const csv = await fichier.text();
      const { importes } = await api(route, { methode: 'POST', corps: { csv } });
      onTermine(importes);
    } catch (err) {
      onErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <label className="bouton bouton--secondaire">
      <Upload size={16} aria-hidden="true" />
      {envoi ? 'Importation...' : libelle}
      <input type="file" accept=".csv,text/csv" className="visuellement-cache" onChange={choisir} disabled={envoi} />
    </label>
  );
}

export default function PageSante() {
  const [jours, setJours] = useState(90);
  const [poids, setPoids] = useState([]);
  const [message, setMessage] = useState({ type: 'info', texte: '' });
  const [saisiePoids, setSaisiePoids] = useState({ mesure_le: maintenantLocal(), valeur: '', unite: 'lb' });

  const erreur = (texte) => setMessage({ type: 'erreur', texte });

  const charger = useCallback(() => {
    api(`/api/sante/poids?jours=${jours}`).then(setPoids).catch((e) => erreur(e.message));
  }, [jours]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function ajouterPoids(e) {
    e.preventDefault();
    let kg = versNombre(saisiePoids.valeur);
    if (!kg) return;
    if (saisiePoids.unite === 'lb') kg *= 0.45359237;
    try {
      await api('/api/sante/poids', {
        methode: 'POST',
        corps: { mesure_le: new Date(saisiePoids.mesure_le).toISOString(), poids_kg: Math.round(kg * 100) / 100 },
      });
      setSaisiePoids({ ...saisiePoids, valeur: '' });
      charger();
    } catch (err) {
      erreur(err.message);
    }
  }

  async function supprimer(type, id) {
    await api(`/api/sante/${type}/${id}`, { methode: 'DELETE' }).catch((e) => erreur(e.message));
    charger();
  }

  const ongletPoids = (
    <div className="pile">
      <div className="rangee rangee--espacee">
        <div className="onglets" role="tablist" aria-label="Période du graphique">
          {PERIODES.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={jours === v} className={`onglets__bouton${jours === v ? ' onglets__bouton--actif' : ''}`} onClick={() => setJours(v)}>
              {l}
            </button>
          ))}
        </div>
        <BoutonImport
          libelle="Importer VeSync"
          route="/api/sante/poids/import"
          onTermine={(n) => { setMessage({ type: 'succes', texte: `${n} pesée(s) importée(s) depuis VeSync.` }); charger(); }}
          onErreur={erreur}
        />
      </div>
      {poids.length > 0 ? (
        <GraphiqueLigne points={poids.map((p) => ({ x: p.mesure_le, y: Math.round(enLb(p.poids_kg) * 10) / 10 }))} unite="lb" libelle="Évolution du poids" />
      ) : (
        <p className="champ__aide">Aucune pesée sur la période.</p>
      )}
      <form className="rangee" onSubmit={ajouterPoids}>
        <input className="champ__saisie champ__saisie--court" type="datetime-local" value={saisiePoids.mesure_le} onChange={(e) => setSaisiePoids({ ...saisiePoids, mesure_le: e.target.value })} aria-label="Date de la pesée" required />
        <input className="champ__saisie champ__saisie--court" inputMode="decimal" placeholder="Poids" value={saisiePoids.valeur} onChange={(e) => setSaisiePoids({ ...saisiePoids, valeur: e.target.value })} aria-label="Poids" required />
        <select className="champ__saisie champ__saisie--court" value={saisiePoids.unite} onChange={(e) => setSaisiePoids({ ...saisiePoids, unite: e.target.value })} aria-label="Unité">
          <option value="lb">lb</option>
          <option value="kg">kg</option>
        </select>
        <button type="submit" className="bouton bouton--principal">Ajouter</button>
      </form>
      {poids.length > 0 && (
        <ul className="liste">
          {[...poids].reverse().slice(0, 5).map((p) => (
            <li key={p.id} className="liste__element">
              <div className="liste__principal">
                <p className="liste__titre">{nombreFr(enLb(p.poids_kg), 1)} lb</p>
                <p className="liste__detail">
                  {new Date(p.mesure_le).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })} · {p.source}
                </p>
              </div>
              <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer('poids', p.id)} aria-label="Supprimer la pesée">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="champ__aide">Comment exporter mes pesées depuis VeSync ?</summary>
        <p className="champ__aide">
          Pour un import ponctuel : dans l&apos;application VeSync, ouvrez votre balance, allez dans
          l&apos;historique des mesures puis utilisez l&apos;option d&apos;exportation des données (fichier CSV). Importez ce
          fichier ici : les doublons sont mis à jour, jamais dupliqués. Les livres sont converties en kilogrammes.
        </p>
      </details>
    </div>
  );

  return (
    <>
      <EntetePage titre="Santé" sousTitre="Calories, protéines et poids, jour par jour et par semaine" />

      <div className="pile pile--large">
        <Message type={message.type}>{message.texte}</Message>

        <RecapCalories ongletPoids={ongletPoids} versionPoids={poids.length ? poids[poids.length - 1].id : 0} />

        <Link href="/parametres" className="carte carte--accent carte--lien">
          <div className="carte__corps">
            <h2 className="carte__titre"><Smartphone size={18} aria-hidden="true" />Connecter Samsung Health</h2>
            <p className="champ__aide">
              Recevez votre poids automatiquement depuis votre téléphone. La connexion se configure dans
              Paramètres (icône <Settings size={12} aria-hidden="true" className="icone-en-ligne" />).
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}
