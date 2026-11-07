'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Flame, Footprints, Scale } from 'lucide-react';
import { api } from '@/lib/client';
import { EMPLACEMENTS, ajouterJours, debutSemaine, enLb, formaterJour, joursRestants, nombreFr, versIso } from '@/lib/dates';
import { Chargement, Message } from '@/components/Elements';
import JournalJour from '@/components/JournalJour';
import MenuSemaine from '@/components/MenuSemaine';
import CommunauteAccueil from '@/components/CommunauteAccueil';

const SOURCES = {
  samsung: 'Samsung Health',
  'health-connect': 'Samsung Health',
  vesync: 'VeSync',
  manuel: 'saisie manuelle',
};

function Sante({ poids, pas, jour }) {
  const pasDuJour = pas.find((p) => p.jour === jour);
  const moyenne = pas.length ? pas.reduce((s, p) => s + p.nombre, 0) / pas.length : null;
  const dernier = poids[0];
  const ecart = dernier && poids[1] ? dernier.poids_kg - poids[1].poids_kg : null;
  // Chaque note est découpée en lignes courtes qui tiennent dans une tuile étroite (2 colonnes sur téléphone).
  const notePas = [
    pasDuJour ? SOURCES[pasDuJour.source] || pasDuJour.source : 'Aucune donnée',
    moyenne != null ? `moyenne : ${nombreFr(moyenne)}` : null,
  ];
  const notePoids = dernier
    ? [
        SOURCES[dernier.source] || dernier.source,
        [
          new Date(dernier.mesure_le).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }),
          ecart != null ? `${ecart > 0 ? '+' : ''}${nombreFr(enLb(ecart), 1)} lb` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ]
    : ['Aucune pesée'];
  const lignes = (note) =>
    note.filter(Boolean).map((t) => (
      <span key={t} className="stat__note">{t}</span>
    ));
  return (
    <div className="grille grille--stats">
      <Link href="/sante" className="stat">
        <span className="stat__libelle"><Footprints size={16} aria-hidden="true" />Pas</span>
        <span className="stat__valeur">{pasDuJour ? nombreFr(pasDuJour.nombre) : '-'}</span>
        {lignes(notePas)}
      </Link>
      <Link href="/sante" className="stat">
        <span className="stat__libelle"><Scale size={16} aria-hidden="true" />Poids</span>
        <span className="stat__valeur">{dernier ? `${nombreFr(enLb(dernier.poids_kg), 1)} lb` : '-'}</span>
        {lignes(notePoids)}
      </Link>
    </div>
  );
}

export default function PageAccueil() {
  const aujourdhui = versIso();
  const [onglet, setOnglet] = useState('jour');
  const [jour, setJour] = useState(aujourdhui);
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api(`/api/tableau-de-bord?jour=${jour}`).then(setDonnees).catch((e) => setErreur(e.message));
  }, [jour]);

  if (erreur) return <Message type="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;

  const { utilisateur, poids, pas, expirent } = donnees;
  const libelleEmplacement = (v) => EMPLACEMENTS.find((e) => e.valeur === v)?.libelle;
  const semaineProchaine = ajouterJours(debutSemaine(), 7);

  return (
    <div className="pile pile--large">
      <Sante poids={poids} pas={pas} jour={jour} />

      <CommunauteAccueil />

      <div className="onglets onglets--principal" role="tablist">
        <button type="button" role="tab" aria-selected={onglet === 'jour'} className={`onglets__bouton${onglet === 'jour' ? ' onglets__bouton--actif' : ''}`} onClick={() => setOnglet('jour')}>
          <Flame size={16} aria-hidden="true" />
          Mes calories
        </button>
        <button type="button" role="tab" aria-selected={onglet === 'menu'} className={`onglets__bouton${onglet === 'menu' ? ' onglets__bouton--actif' : ''}`} onClick={() => setOnglet('menu')}>
          <CalendarDays size={16} aria-hidden="true" />
          Menu de la semaine
        </button>
      </div>

      {onglet === 'jour' && (
        <div className="pile pile--large">
          <div className="rangee rangee--espacee">
            <h2 className="journal__jour">{jour === aujourdhui ? "Aujourd'hui" : formaterJour(jour)}</h2>
            <div className="rangee">
              <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => setJour(ajouterJours(jour, -1))} aria-label="Jour précédent">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              {jour !== aujourdhui && (
                <button type="button" className="bouton bouton--secondaire" onClick={() => setJour(aujourdhui)}>Aujourd&apos;hui</button>
              )}
              <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => setJour(ajouterJours(jour, 1))} aria-label="Jour suivant">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <JournalJour key={jour} jour={jour} objectif={utilisateur.objectif_kcal} />

          {expirent.length > 0 && (
            <section className="carte">
              <div className="carte__entete">
                <h2 className="carte__titre"><AlertTriangle size={18} aria-hidden="true" />À consommer bientôt</h2>
                <Link href="/inventaire" className="bouton bouton--fantome bouton--petit">Inventaire</Link>
              </div>
              <ul className="liste">
                {expirent.map((a) => {
                  const j = joursRestants(a.expire_le);
                  return (
                    <li key={a.id} className="liste__element">
                      <div className="liste__principal">
                        <p className="liste__titre">{a.nom}</p>
                        <p className="liste__detail">{libelleEmplacement(a.emplacement)}</p>
                      </div>
                      <span className={`etiquette ${j <= 0 ? 'etiquette--danger' : 'etiquette--alerte'}`}>
                        {j < 0 ? 'Expiré' : j === 0 ? 'Aujourd\'hui' : `${j} j`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {onglet === 'menu' && (
        <div className="pile">
          <div>
            <Link href={`/planificateur?semaine=${semaineProchaine}`} className="bouton bouton--principal">
              <CalendarRange size={16} aria-hidden="true" />
              Planifier les repas
            </Link>
          </div>
          <MenuSemaine />
        </div>
      )}
    </div>
  );
}
