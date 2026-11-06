'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/client';
import { Message, versNombre } from './Elements';

// Nutriments stockés en grammes ; chacun peut être saisi en g ou en mg.
const NUTRIMENTS = [
  ['proteines_100g', 'Protéines'],
  ['glucides_100g', 'Glucides'],
  ['lipides_100g', 'Lipides'],
  ['fibres_100g', 'Fibres'],
  ['sucres_100g', 'Sucres'],
  ['sel_100g', 'Sel'],
];

const versTexte = (v) => (v == null ? '' : String(Math.round(v * 1000) / 1000));

/** Valeur initiale : affichée en mg si elle est inférieure à 1 g. */
function initialNutriment(g) {
  if (g != null && g > 0 && g < 1) return { valeur: versTexte(g * 1000), unite: 'mg' };
  return { valeur: versTexte(g), unite: 'g' };
}

export default function FormulaireAliment({ initial = {}, onEnregistre }) {
  const [valeurs, setValeurs] = useState(() => ({
    nom: initial.nom || '',
    marque: initial.marque || '',
    code_barre: initial.code_barre || '',
    unite: initial.unite || 'g',
    portion_g: versTexte(initial.portion_g),
    kcal_100g: versTexte(initial.kcal_100g),
  }));
  const [nutriments, setNutriments] = useState(() =>
    Object.fromEntries(NUTRIMENTS.map(([cle]) => [cle, initialNutriment(initial[cle])]))
  );
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const changer = (cle) => (e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));
  const changerNutriment = (cle, champ) => (e) =>
    setNutriments((n) => ({ ...n, [cle]: { ...n[cle], [champ]: e.target.value } }));

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const corps = {
        nom: valeurs.nom,
        marque: valeurs.marque || null,
        code_barre: valeurs.code_barre.replace(/\D/g, '') || null,
        unite: valeurs.unite,
        portion_g: versNombre(valeurs.portion_g),
        kcal_100g: versNombre(valeurs.kcal_100g),
        image_url: initial.image_url || null,
        ...Object.fromEntries(
          NUTRIMENTS.map(([cle]) => {
            const n = versNombre(nutriments[cle].valeur);
            return [cle, n == null ? null : nutriments[cle].unite === 'mg' ? n / 1000 : n];
          })
        ),
      };
      const aliment = initial.id
        ? await api(`/api/aliments/${initial.id}`, { methode: 'PUT', corps })
        : await api('/api/aliments', { methode: 'POST', corps });
      onEnregistre(aliment);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  const u = valeurs.unite;

  return (
    <form className="formulaire" onSubmit={soumettre}>
      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Nom</span>
          <input className="champ__saisie" value={valeurs.nom} onChange={changer('nom')} required maxLength={200} />
        </label>
        <label className="champ">
          <span className="champ__libelle">Marque</span>
          <input className="champ__saisie" value={valeurs.marque} onChange={changer('marque')} maxLength={200} />
        </label>
      </div>
      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Code-barres</span>
          <input className="champ__saisie" inputMode="numeric" value={valeurs.code_barre} onChange={changer('code_barre')} maxLength={14} />
        </label>
        <div className="champ">
          <span className="champ__libelle">Portion habituelle</span>
          <div className="champ__groupe">
            <input className="champ__saisie" inputMode="decimal" value={valeurs.portion_g} onChange={changer('portion_g')} aria-label="Portion habituelle" />
            <select className="champ__saisie champ__saisie--unite" value={u} onChange={changer('unite')} aria-label="Unité de la portion">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
        </div>
      </div>

      <p className="champ__aide">Valeurs nutritives pour 100 {u}</p>
      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Calories (kcal)</span>
          <input className="champ__saisie" inputMode="decimal" value={valeurs.kcal_100g} onChange={changer('kcal_100g')} />
        </label>
        {NUTRIMENTS.map(([cle, libelle]) => (
          <div key={cle} className="champ">
            <span className="champ__libelle">{libelle}</span>
            <div className="champ__groupe">
              <input
                className="champ__saisie"
                inputMode="decimal"
                value={nutriments[cle].valeur}
                onChange={changerNutriment(cle, 'valeur')}
                aria-label={libelle}
              />
              <select
                className="champ__saisie champ__saisie--unite"
                value={nutriments[cle].unite}
                onChange={changerNutriment(cle, 'unite')}
                aria-label={`Unité : ${libelle}`}
              >
                <option value="g">g</option>
                <option value="mg">mg</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      <Message type="erreur">{erreur}</Message>
      <div className="formulaire__actions">
        <button type="submit" className="bouton bouton--principal" disabled={envoi}>
          <Save size={16} aria-hidden="true" />
          {envoi ? 'Enregistrement...' : 'Enregistrer l\'aliment'}
        </button>
      </div>
    </form>
  );
}
