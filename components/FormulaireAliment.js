'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/client';
import { Message, versNombre } from './Elements';

const NUTRIMENTS = [
  ['kcal_100g', 'Calories (kcal)'],
  ['proteines_100g', 'Protéines (g)'],
  ['glucides_100g', 'Glucides (g)'],
  ['lipides_100g', 'Lipides (g)'],
  ['fibres_100g', 'Fibres (g)'],
  ['sucres_100g', 'Sucres (g)'],
  ['sel_100g', 'Sel (g)'],
];

const versTexte = (v) => (v == null ? '' : String(v));

export default function FormulaireAliment({ initial = {}, onEnregistre }) {
  const [valeurs, setValeurs] = useState(() => ({
    nom: initial.nom || '',
    marque: initial.marque || '',
    code_barre: initial.code_barre || '',
    portion_g: versTexte(initial.portion_g),
    ...Object.fromEntries(NUTRIMENTS.map(([cle]) => [cle, versTexte(initial[cle])])),
  }));
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const changer = (cle) => (e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const corps = {
        nom: valeurs.nom,
        marque: valeurs.marque || null,
        code_barre: valeurs.code_barre.replace(/\D/g, '') || null,
        portion_g: versNombre(valeurs.portion_g),
        image_url: initial.image_url || null,
        ...Object.fromEntries(NUTRIMENTS.map(([cle]) => [cle, versNombre(valeurs[cle])])),
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
        <label className="champ">
          <span className="champ__libelle">Portion habituelle (g)</span>
          <input className="champ__saisie" inputMode="decimal" value={valeurs.portion_g} onChange={changer('portion_g')} />
        </label>
      </div>
      <p className="champ__aide">Valeurs nutritives pour 100 g</p>
      <div className="formulaire__ligne">
        {NUTRIMENTS.map(([cle, libelle]) => (
          <label key={cle} className="champ">
            <span className="champ__libelle">{libelle}</span>
            <input className="champ__saisie" inputMode="decimal" value={valeurs[cle]} onChange={changer(cle)} />
          </label>
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
