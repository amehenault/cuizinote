'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Apple, Bot, ChevronDown, CupSoda, HeartPulse, LogOut, Smartphone, Tags, Target, Trash2, Upload, UserRound } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, Message } from '@/components/Elements';
import CleWidget from '@/components/CleWidget';
import GestionCompte from '@/components/GestionCompte';
import GestionEtiquettes from '@/components/GestionEtiquettes';
import GestionVerres from '@/components/GestionVerres';
import ImportCookmate from '@/components/ImportCookmate';
import ObjectifCalorique from '@/components/ObjectifCalorique';
import SuppressionCompte from '@/components/SuppressionCompte';
import SynchroSante from '@/components/SynchroSante';
import UtilisationIA from '@/components/UtilisationIA';

const SECTIONS = [
  { id: 'compte', titre: 'Gestion du compte', Icone: UserRound },
  { id: 'objectif', titre: 'Objectif calorique', Icone: Target },
  { id: 'ia', titre: 'Utilisation de l’IA', Icone: Bot },
  { id: 'verres', titre: 'Mes verres et tasses', Icone: CupSoda },
  { id: 'etiquettes', titre: 'Étiquettes de recettes', Icone: Tags },
  { id: 'samsung', titre: 'Samsung Health', Icone: HeartPulse },
  { id: 'widget', titre: 'Widget Android', Icone: Smartphone },
  { id: 'importation', titre: 'Importation', Icone: Upload },
  { id: 'deconnexion', titre: 'Déconnexion', Icone: LogOut },
  { id: 'suppression', titre: 'Suppression du compte', Icone: Trash2 },
];

function Section({ id, children, danger = false, aide, repliable = false }) {
  const { titre, Icone } = SECTIONS.find((s) => s.id === id);
  if (repliable) {
    return (
      <details id={id} className="carte parametres__section">
        <summary className="carte__entete parametres__repli">
          <h2 className="carte__titre"><Icone size={18} aria-hidden="true" />{titre}</h2>
          <ChevronDown size={18} className="parametres__chevron" aria-hidden="true" />
        </summary>
        <div className="carte__corps">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className={`carte parametres__section${danger ? ' parametres__section--danger' : ''}`}>
      <div className="carte__entete">
        <h2 className="carte__titre"><Icone size={18} aria-hidden="true" />{titre}</h2>
        {aide}
      </div>
      <div className="carte__corps">{children}</div>
    </section>
  );
}

export default function PageParametres() {
  const [compte, setCompte] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => api('/api/compte').then(setCompte).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
    const ouvrir = () => {
      const cible = window.location.hash && document.getElementById(window.location.hash.slice(1));
      if (cible?.tagName === 'DETAILS') cible.open = true;
    };
    ouvrir();
    window.addEventListener('hashchange', ouvrir);
    return () => window.removeEventListener('hashchange', ouvrir);
  }, []);

  async function deconnecter() {
    await api('/api/auth/deconnexion', { methode: 'POST' }).catch(() => {});
    window.location.assign('/connexion');
  }

  return (
    <div className="pile pile--large">
      <EntetePage titre="Paramètres" sousTitre="Votre compte, votre objectif et vos appareils" />

      <nav className="parametres__sommaire" aria-label="Sections des paramètres">
        {SECTIONS.filter((s) => s.id !== 'ia' || compte?.admin).map(({ id, titre, Icone }) => (
          <a key={id} href={`#${id}`} className="etiquette etiquette--bouton etiquette--neutre">
            <Icone size={14} aria-hidden="true" />
            {titre}
          </a>
        ))}
      </nav>

      <Message type="erreur">{erreur}</Message>
      {!compte && !erreur && <Chargement />}

      {compte && (
        <>
          <Section id="compte">
            <GestionCompte compte={compte} onChange={charger} />
          </Section>

          <Section
            id="objectif"
            aide={compte.objectif_kcal ? <span className="etiquette">{compte.objectif_kcal} kcal / jour</span> : null}
          >
            <ObjectifCalorique key={`${compte.objectif_mode}-${compte.objectif_manuel}`} compte={compte} onChange={charger} />
          </Section>
        </>
      )}

      {compte?.admin && (
        <Section id="ia">
          <UtilisationIA />
        </Section>
      )}

      <Section id="verres">
        <GestionVerres />
      </Section>

      <Section id="etiquettes">
        <GestionEtiquettes />
      </Section>

      <Section id="samsung" repliable>
        <SynchroSante />
      </Section>

      <Section id="widget" repliable>
        <CleWidget />
      </Section>

      <Section id="importation">
        <ImportCookmate />
        <div className="pile pile--serre">
          <p className="liste__titre">Pas et poids (fichiers CSV)</p>
          <p className="champ__aide">
            Export Samsung Health ou VeSync : importez le fichier dans la page Santé.
          </p>
          <div className="rangee">
            <Link href="/sante" className="bouton bouton--secondaire">
              <HeartPulse size={16} aria-hidden="true" />
              Aller à Santé
            </Link>
          </div>
        </div>
      </Section>

      <section className="carte">
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

      <Section id="deconnexion">
        <p className="champ__aide">Seul cet appareil est déconnecté ; vos autres appareils restent connectés.</p>
        <div>
          <button type="button" className="bouton bouton--secondaire" onClick={deconnecter}>
            <LogOut size={16} aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      </Section>

      <Section id="suppression" danger>
        <SuppressionCompte />
      </Section>
    </div>
  );
}
