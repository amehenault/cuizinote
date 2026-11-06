'use client';

import { useEffect, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { api } from '@/lib/client';

const SUGGESTIONS_DE_BASE = ['déjeuner', 'dîner', 'souper', 'collation', 'dessert', 'poulet', 'bœuf', 'porc', 'poisson', 'végétarien', 'viandes', 'haut en calories', 'faible en calories', 'rapide', 'congelable', 'lunch'];

export default function SaisieEtiquettes({ valeur, onChange, id = 'etiquettes' }) {
  const [texte, setTexte] = useState('');
  const [existantes, setExistantes] = useState([]);

  useEffect(() => {
    api('/api/etiquettes').then((l) => setExistantes(l.map((e) => e.nom))).catch(() => {});
  }, []);

  function ajouter(brut) {
    const nom = brut.trim().toLowerCase().slice(0, 40);
    if (nom && !valeur.includes(nom) && valeur.length < 30) onChange([...valeur, nom]);
    setTexte('');
  }

  const suggestions = [...new Set([...existantes, ...SUGGESTIONS_DE_BASE])]
    .filter((s) => !valeur.includes(s) && (!texte || s.includes(texte.toLowerCase())))
    .slice(0, 14);

  return (
    <div>
      <div className="saisie-etiquettes">
        <Tag size={16} aria-hidden="true" />
        {valeur.map((e) => (
          <span key={e} className="etiquette">
            {e}
            <button type="button" className="etiquette__retirer" onClick={() => onChange(valeur.filter((x) => x !== e))} aria-label={`Retirer ${e}`}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="saisie-etiquettes__champ"
          value={texte}
          placeholder="Ajouter une étiquette puis Entrée"
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              ajouter(texte);
            } else if (e.key === 'Backspace' && !texte && valeur.length) {
              onChange(valeur.slice(0, -1));
            }
          }}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="saisie-etiquettes__suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" className="etiquette etiquette--neutre etiquette--bouton" onClick={() => ajouter(s)}>
              <Plus size={12} aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
