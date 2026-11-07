'use client';

import { useState } from 'react';
import { Archive, ArrowRight, Check, Refrigerator, Snowflake, X } from 'lucide-react';
import { api } from '@/lib/client';
import { EMPLACEMENTS } from '@/lib/dates';
import { Message, Modale } from './Elements';

const ICONES = { frigo: Refrigerator, congelateur: Snowflake, 'garde-manger': Archive };
const libelle = (v) => EMPLACEMENTS.find((e) => e.valeur === v)?.libelle || v;

function Pastille({ emplacement, actif = false }) {
  const Icone = ICONES[emplacement];
  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        gap: 'var(--espace-2)',
        padding: 'var(--espace-3) var(--espace-4)',
        borderRadius: 'var(--rayon-l, 16px)',
        minWidth: 110,
        background: actif ? 'var(--couleur-primaire-pale)' : 'var(--couleur-surface)',
        border: `2px solid ${actif ? 'var(--couleur-primaire)' : 'var(--couleur-bordure)'}`,
        color: actif ? 'var(--couleur-primaire-fonce)' : 'var(--couleur-texte-attenue)',
        opacity: actif ? 1 : 0.8,
      }}
    >
      <Icone size={30} aria-hidden="true" />
      <span style={{ fontWeight: 700 }}>{libelle(emplacement)}</span>
    </div>
  );
}

/**
 * Après avoir rangé un produit ailleurs que d'habitude : « Veux-tu enregistrer ce mode de stockage par défaut ? »
 * question : { nom, aliment_id, avant, apres } ou null.
 */
export default function QuestionRangement({ question, onFin }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  if (!question) return null;

  async function oui() {
    setEnvoi(true);
    try {
      await api('/api/inventaire/rangements', {
        methode: 'PUT',
        corps: { aliment_id: question.aliment_id || null, nom: question.nom, emplacement: question.apres },
      });
      onFin(true);
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <Modale titre="Nouveau rangement" ouverte onFermer={() => onFin(false)}>
      <div className="pile" style={{ textAlign: 'center' }}>
        <div className="rangee" style={{ justifyContent: 'center', flexWrap: 'nowrap', gap: 'var(--espace-3)' }}>
          <Pastille emplacement={question.avant} />
          <ArrowRight size={24} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--couleur-texte-attenue)' }} />
          <Pastille emplacement={question.apres} actif />
        </div>
        <p style={{ fontSize: 'var(--taille-l, 1.125rem)', fontWeight: 700, margin: 0 }}>
          Veux-tu enregistrer ce mode de stockage par défaut pour ce produit ?
        </p>
        <p className="champ__aide" style={{ margin: 0 }}>
          « {question.nom} » sera proposé au <strong>{libelle(question.apres).toLowerCase()}</strong> les prochaines fois.
        </p>
        <Message type="erreur">{erreur}</Message>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--espace-2)' }}>
          <button type="button" className="bouton bouton--secondaire" disabled={envoi} onClick={() => onFin(false)}>
            <X size={16} aria-hidden="true" />
            Juste cette fois
          </button>
          <button type="button" className="bouton bouton--principal" disabled={envoi} onClick={oui}>
            <Check size={16} aria-hidden="true" />
            Oui, par défaut
          </button>
        </div>
      </div>
    </Modale>
  );
}
