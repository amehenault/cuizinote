'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/client';

/** Champ de recherche dans la banque d'aliments. */
export default function RechercheAliment({ onChoisir, placeholder = 'Rechercher un aliment', compact = false }) {
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const idListe = useId();
  const minuterie = useRef(null);

  useEffect(() => {
    clearTimeout(minuterie.current);
    if (texte.trim().length < 2) {
      setResultats([]);
      return undefined;
    }
    minuterie.current = setTimeout(() => {
      api(`/api/aliments?q=${encodeURIComponent(texte.trim())}`)
        .then((r) => {
          setResultats(r);
          setActif(0);
          setOuvert(true);
        })
        .catch(() => setResultats([]));
    }, 250);
    return () => clearTimeout(minuterie.current);
  }, [texte]);

  function choisir(aliment) {
    onChoisir(aliment);
    setTexte('');
    setOuvert(false);
  }

  return (
    <div className="recherche">
      <Search className="recherche__icone" size={16} aria-hidden="true" />
      <input
        className={`champ__saisie recherche__saisie${compact ? ' champ__saisie--compact' : ''}`}
        value={texte}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={ouvert && resultats.length > 0}
        aria-controls={idListe}
        aria-label={placeholder}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onFocus={() => resultats.length && setOuvert(true)}
        onKeyDown={(e) => {
          if (!ouvert || !resultats.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActif((a) => Math.min(a + 1, resultats.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActif((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); choisir(resultats[actif]); }
          if (e.key === 'Escape') setOuvert(false);
        }}
      />
      {ouvert && texte.trim().length >= 2 && (
        <ul className="recherche__resultats" id={idListe} role="listbox">
          {resultats.length === 0 && <li className="recherche__vide">Aucun aliment trouvé</li>}
          {resultats.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === actif}>
              <button
                type="button"
                className={`recherche__option${i === actif ? ' recherche__option--active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(a)}
              >
                <span>
                  {a.nom}
                  {a.marque && <span className="recherche__option-detail"> - {a.marque}</span>}
                </span>
                <span className="recherche__option-detail">{a.kcal_100g != null ? `${Math.round(a.kcal_100g)} kcal/100 ${a.unite || 'g'}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
