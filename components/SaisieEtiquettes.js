'use client';

import { useEffect, useState } from 'react';
import { Plus, Sparkles, Tag, X } from 'lucide-react';
import { api } from '@/lib/client';
import { ETIQUETTES_DE_BASE, formaterEtiquette } from '@/lib/etiquettes';
import { Message } from './Elements';

const cle = (s) => s.toLocaleLowerCase('fr-CA');

/**
 * Saisie des étiquettes d'une recette.
 * `contexte` (facultatif) : fonction qui renvoie la recette en cours, pour les suggestions automatiques.
 */
export default function SaisieEtiquettes({ valeur, onChange, id = 'etiquettes', contexte }) {
  const [texte, setTexte] = useState('');
  const [existantes, setExistantes] = useState([]);
  const [suggestion, setSuggestion] = useState({ enCours: false, message: '' });

  useEffect(() => {
    api('/api/etiquettes').then((l) => setExistantes(l.map((e) => e.nom))).catch(() => {});
  }, []);

  function ajouterPlusieurs(bruts) {
    const nouveaux = [...valeur];
    for (const b of bruts) {
      const nom = formaterEtiquette(b);
      if (nom && !nouveaux.some((x) => cle(x) === cle(nom)) && nouveaux.length < 30) nouveaux.push(nom);
    }
    if (nouveaux.length !== valeur.length) onChange(nouveaux);
    return nouveaux.length - valeur.length;
  }

  function ajouter(brut) {
    ajouterPlusieurs([brut]);
    setTexte('');
  }

  async function suggerer() {
    const recette = contexte();
    if (!recette.titre) return setSuggestion({ enCours: false, message: 'Entrez d\'abord le titre de la recette.' });
    setSuggestion({ enCours: true, message: '' });
    try {
      const { etiquettes } = await api('/api/etiquettes/automatique', { methode: 'POST', corps: { recette } });
      const ajoutees = ajouterPlusieurs(etiquettes);
      setSuggestion({ enCours: false, message: ajoutees ? '' : 'Aucune nouvelle étiquette trouvée.' });
    } catch (e) {
      setSuggestion({ enCours: false, message: e.message });
    }
  }

  const choisies = new Set(valeur.map(cle));
  const suggestions = [...new Map([...existantes, ...ETIQUETTES_DE_BASE].map((s) => [cle(s), formaterEtiquette(s)])).values()]
    .filter((s) => !choisies.has(cle(s)) && (!texte || cle(s).includes(cle(texte.trim()))))
    .slice(0, 14);

  return (
    <div>
      <div className="saisie-etiquettes">
        <Tag size={16} aria-hidden="true" />
        {valeur.map((e) => (
          <span key={e} className="etiquette">
            {formaterEtiquette(e)}
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
            Ajouter « {formaterEtiquette(texte)} »
          </button>
        )}
      </div>
      <div className="saisie-etiquettes__suggestions">
        {contexte && (
          <button type="button" className="etiquette etiquette--bouton etiquette--active" onClick={suggerer} disabled={suggestion.enCours}>
            <Sparkles size={12} aria-hidden="true" />
            {suggestion.enCours ? 'Recherche…' : 'Étiqueter automatiquement'}
          </button>
        )}
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
      <Message type="erreur">{suggestion.message}</Message>
    </div>
  );
}
