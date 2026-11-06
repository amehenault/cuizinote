'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Footprints, Scale, Settings, Smartphone, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import { nombreFr, versIso } from '@/lib/dates';
import { EntetePage, Message, versNombre } from '@/components/Elements';
import { GraphiqueBarres, GraphiqueLigne } from '@/components/Graphiques';

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
  const [pas, setPas] = useState([]);
  const [message, setMessage] = useState({ type: 'info', texte: '' });
  const [saisiePoids, setSaisiePoids] = useState({ mesure_le: maintenantLocal(), valeur: '', unite: 'kg' });
  const [saisiePas, setSaisiePas] = useState({ jour: versIso(), nombre: '' });

  const erreur = (texte) => setMessage({ type: 'erreur', texte });

  const charger = useCallback(() => {
    api(`/api/sante/poids?jours=${jours}`).then(setPoids).catch((e) => erreur(e.message));
    api(`/api/sante/pas?jours=${Math.min(jours, 90)}`).then(setPas).catch((e) => erreur(e.message));
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

  async function ajouterPas(e) {
    e.preventDefault();
    const n = versNombre(saisiePas.nombre);
    if (n == null) return;
    try {
      await api('/api/sante/pas', { methode: 'POST', corps: { jour: saisiePas.jour, nombre: Math.round(n) } });
      setSaisiePas({ ...saisiePas, nombre: '' });
      charger();
    } catch (err) {
      erreur(err.message);
    }
  }

  async function supprimer(type, id) {
    await api(`/api/sante/${type}/${id}`, { methode: 'DELETE' }).catch((e) => erreur(e.message));
    charger();
  }

  const dernier = poids[poids.length - 1];
  const variation = poids.length > 1 ? dernier.poids_kg - poids[0].poids_kg : null;
  const moyennePas = pas.length ? Math.round(pas.reduce((s, p) => s + p.nombre, 0) / pas.length) : null;

  return (
    <>
      <EntetePage titre="Santé" sousTitre="Poids (balance VeSync) et pas (Samsung Health)">
        <div className="onglets" role="tablist">
          {PERIODES.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={jours === v} className={`onglets__bouton${jours === v ? ' onglets__bouton--actif' : ''}`} onClick={() => setJours(v)}>
              {l}
            </button>
          ))}
        </div>
      </EntetePage>

      <div className="pile pile--large">
        <Message type={message.type}>{message.texte}</Message>

        <div className="grille grille--stats">
          <div className="stat">
            <span className="stat__libelle"><Scale size={16} aria-hidden="true" />Dernier poids</span>
            <span className="stat__valeur">{dernier ? `${nombreFr(dernier.poids_kg, 1)} kg` : '-'}</span>
            {variation != null && (
              <span className="stat__note">{variation > 0 ? '+' : ''}{nombreFr(variation, 1)} kg sur la période</span>
            )}
          </div>
          <div className="stat">
            <span className="stat__libelle"><Footprints size={16} aria-hidden="true" />Moyenne de pas</span>
            <span className="stat__valeur">{moyennePas != null ? nombreFr(moyennePas) : '-'}</span>
            <span className="stat__note">par jour</span>
          </div>
        </div>

        <Link href="/parametres" className="carte carte--accent carte--lien">
          <div className="carte__corps">
            <h2 className="carte__titre"><Smartphone size={18} aria-hidden="true" />Connecter Samsung Health</h2>
            <p className="champ__aide">
              Recevez vos pas et votre poids automatiquement depuis votre téléphone. La connexion se configure dans
              Paramètres (icône <Settings size={12} aria-hidden="true" className="icone-en-ligne" />).
            </p>
          </div>
        </Link>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre"><Scale size={18} aria-hidden="true" />Poids (kg)</h2>
            <BoutonImport
              libelle="Importer VeSync"
              route="/api/sante/poids/import"
              onTermine={(n) => { setMessage({ type: 'succes', texte: `${n} pesée(s) importée(s) depuis VeSync.` }); charger(); }}
              onErreur={erreur}
            />
          </div>
          <div className="carte__corps">
            {poids.length > 0 ? (
              <GraphiqueLigne points={poids.map((p) => ({ x: p.mesure_le, y: p.poids_kg }))} unite="kg" libelle="Évolution du poids" />
            ) : (
              <p className="champ__aide">Aucune pesée sur la période.</p>
            )}
            <form className="rangee" onSubmit={ajouterPoids}>
              <input className="champ__saisie champ__saisie--court" type="datetime-local" value={saisiePoids.mesure_le} onChange={(e) => setSaisiePoids({ ...saisiePoids, mesure_le: e.target.value })} aria-label="Date de la pesée" required />
              <input className="champ__saisie champ__saisie--court" inputMode="decimal" placeholder="Poids" value={saisiePoids.valeur} onChange={(e) => setSaisiePoids({ ...saisiePoids, valeur: e.target.value })} aria-label="Poids" required />
              <select className="champ__saisie champ__saisie--court" value={saisiePoids.unite} onChange={(e) => setSaisiePoids({ ...saisiePoids, unite: e.target.value })} aria-label="Unité">
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
              <button type="submit" className="bouton bouton--principal">Ajouter</button>
            </form>
            {poids.length > 0 && (
              <ul className="liste">
                {[...poids].reverse().slice(0, 5).map((p) => (
                  <li key={p.id} className="liste__element">
                    <div className="liste__principal">
                      <p className="liste__titre">{nombreFr(p.poids_kg, 1)} kg</p>
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
        </section>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre"><Footprints size={18} aria-hidden="true" />Pas quotidiens</h2>
            <BoutonImport
              libelle="Importer Samsung Health"
              route="/api/sante/pas/import"
              onTermine={(n) => { setMessage({ type: 'succes', texte: `${n} journée(s) de pas importée(s) depuis Samsung Health.` }); charger(); }}
              onErreur={erreur}
            />
          </div>
          <div className="carte__corps">
            {pas.length > 0 ? (
              <GraphiqueBarres points={pas.map((p) => ({ x: p.jour, y: p.nombre }))} unite="pas" libelle="Pas par jour" objectif={10000} />
            ) : (
              <p className="champ__aide">Aucune donnée de pas sur la période.</p>
            )}
            {pas.length > 0 && <p className="champ__aide">Ligne pointillée : repère de 10 000 pas.</p>}
            <form className="rangee" onSubmit={ajouterPas}>
              <input className="champ__saisie champ__saisie--court" type="date" value={saisiePas.jour} onChange={(e) => setSaisiePas({ ...saisiePas, jour: e.target.value })} aria-label="Jour" required />
              <input className="champ__saisie champ__saisie--court" inputMode="numeric" placeholder="Nombre de pas" value={saisiePas.nombre} onChange={(e) => setSaisiePas({ ...saisiePas, nombre: e.target.value })} aria-label="Nombre de pas" required />
              <button type="submit" className="bouton bouton--principal">Ajouter</button>
            </form>
            {pas.length > 0 && (
              <ul className="liste">
                {[...pas].reverse().slice(0, 5).map((p) => (
                  <li key={p.id} className="liste__element">
                    <div className="liste__principal">
                      <p className="liste__titre">{nombreFr(p.nombre)} pas</p>
                      <p className="liste__detail">{p.jour} · {p.source}</p>
                    </div>
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer('pas', p.id)} aria-label="Supprimer">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="champ__aide">Comment exporter mes pas depuis Samsung Health ?</summary>
              <p className="champ__aide">
                Pour un import ponctuel sans application passerelle : dans Samsung Health, ouvrez Menu, Paramètres,
                puis « Télécharger les données personnelles ». Dans le dossier créé sur le téléphone, choisissez le fichier
                dont le nom contient <strong>step_daily_trend</strong> et importez-le ici.
              </p>
            </details>
          </div>
        </section>
      </div>
    </>
  );
}
