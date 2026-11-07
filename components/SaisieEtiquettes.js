'use client';

import { useEffect, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { api } from '@/lib/client';

const SUGGESTIONS_DE_BASE = ['déjeuner', 'dîner', 'souper', 'collation', 'dessert', 'poulet', 'bœuf', 'porc', 'poisson', 'végétarien', 'viandes', 'haut en calories', 'faible en calories', 'rapide', 'congelable', 'lunch'];

const nettoyer = (brut) => brut.trim().toLowerCase().slice(0, 40);

export default function SaisieEtiquettes({ valeur, onChange, id = 'etiquettes' }) {
  const [texte, setTexte] = useState('');
  const [existantes, setExistantes] = useState([]);

  useEffect(() => {
    api('/api/etiquettes').then((l) => setExistantes(l.map((e) => e.nom))).catch(() => {});
  }, []);

  function ajouterPlusieurs(bruts) {
    const nouveaux = [...valeur];
    for (const b of bruts) {
      const nom = nettoyer(b);
      if (nom && !nouveaux.includes(nom) && nouveaux.length < 30) nouveaux.push(nom);
    }
    if (nouveaux.length !== valeur.length) onChange(nouveaux);
  }

  function ajouter(brut) {
    ajouterPlusieurs([brut]);
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
          placeholder="Nouvelle étiquette"
          enterKeyHint="done"
          autoCapitalize="none"
          onChange={(e) => {
            // Les claviers Android n'envoient pas toujours la touche virgule : on la détecte dans le texte.
            const v = e.target.value;
            if (v.includes(',')) {
              const morceaux = v.split(',');
              ajouterPlusieurs(morceaux.slice(0, -1));
              setTexte(morceaux.at(-1));
            } else setTexte(v);
          }}
          // Texte tapé puis on touche ailleurs (ex. : « Enregistrer ») : l'étiquette n'est pas perdue.
          onBlur={() => texte.trim() && ajouter(texte)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              ajouter(texte);
            } else if (e.key === 'Backspace' && !texte && valeur.length) {
              onChange(valeur.slice(0, -1));
            }
          }}
        />
        {texte.trim() && (
          <button
            type="button"
            className="etiquette etiquette--bouton"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => ajouter(texte)}
          >
            <Plus size={12} aria-hidden="true" />
            Ajouter « {nettoyer(texte)} »
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="saisie-etiquettes__suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="etiquette etiquette--neutre etiquette--bouton"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ajouter(s)}
            >
              <Plus size={12} aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
