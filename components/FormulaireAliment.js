'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/client';
import { Message, versNombre } from './Elements';

// Nutriments stockés en grammes pour 100 g ; chacun peut être saisi en g ou en mg.
const NUTRIMENTS = [
  ['proteines_100g', 'Protéines'],
  ['glucides_100g', 'Glucides'],
  ['lipides_100g', 'Lipides'],
  ['fibres_100g', 'Fibres'],
  ['sucres_100g', 'Sucres'],
  ['sel_100g', 'Sel'],
];

const versTexte = (v) => (v == null ? '' : String(Math.round(v * 100) / 100));

/** Valeur stockée (pour 100) -> valeur affichée selon la base choisie (portion ou 100). */
const depuis100 = (v, base, portionG) => (v == null ? null : base === 'portion' && portionG ? (v * portionG) / 100 : v);
/** Valeur affichée -> valeur à stocker (pour 100). */
const vers100 = (v, base, portionG) => (v == null ? null : base === 'portion' ? (v * 100) / portionG : v);

function initialNutriment(g) {
  if (g != null && g > 0 && g < 1) return { valeur: versTexte(g * 1000), unite: 'mg' };
  return { valeur: versTexte(g), unite: 'g' };
}

export default function FormulaireAliment({ initial = {}, onEnregistre }) {
  // Valeurs saisies « par portion » par défaut quand la portion est connue, comme sur l'étiquette.
  const baseInitiale = initial.portion_g ? 'portion' : '100';
  const [base, setBase] = useState(baseInitiale);
  const [valeurs, setValeurs] = useState(() => ({
    nom: initial.nom || '',
    marque: initial.marque || '',
    code_barre: initial.code_barre || '',
    unite: initial.unite || 'g',
    portion_texte: initial.portion_texte || '',
    portion_g: versTexte(initial.portion_g),
    kcal: versTexte(depuis100(initial.kcal_100g, baseInitiale, initial.portion_g)),
  }));
  const [nutriments, setNutriments] = useState(() =>
    Object.fromEntries(NUTRIMENTS.map(([cle]) => [cle, initialNutriment(depuis100(initial[cle], baseInitiale, initial.portion_g))]))
  );
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const changer = (cle) => (e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));
  const changerNutriment = (cle, champ) => (e) =>
    setNutriments((n) => ({ ...n, [cle]: { ...n[cle], [champ]: e.target.value } }));

  /** Changer de base convertit les chiffres déjà saisis. */
  function changerBase(nouvelle) {
    const portionG = versNombre(valeurs.portion_g);
    if (nouvelle === base) return;
    if (!portionG) {
      setBase(nouvelle);
      return;
    }
    const facteur = nouvelle === 'portion' ? portionG / 100 : 100 / portionG;
    const convertir = (t) => {
      const n = versNombre(t);
      return n == null ? t : versTexte(n * facteur);
    };
    setValeurs((v) => ({ ...v, kcal: convertir(v.kcal) }));
    setNutriments((n) => Object.fromEntries(Object.entries(n).map(([k, x]) => [k, { ...x, valeur: convertir(x.valeur) }])));
    setBase(nouvelle);
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    const portionG = versNombre(valeurs.portion_g);
    if (base === 'portion' && !portionG) {
      setErreur(`Indiquez le poids de la portion (en ${valeurs.unite}) pour entrer les valeurs par portion.`);
      return;
    }
    setEnvoi(true);
    try {
      const corps = {
        nom: valeurs.nom,
        marque: valeurs.marque || null,
        code_barre: valeurs.code_barre.replace(/\D/g, '') || null,
        unite: valeurs.unite,
        portion_texte: valeurs.portion_texte.trim() || null,
        portion_g: portionG,
        kcal_100g: vers100(versNombre(valeurs.kcal), base, portionG),
        image_url: initial.image_url || null,
        ...Object.fromEntries(
          NUTRIMENTS.map(([cle]) => {
            const n = versNombre(nutriments[cle].valeur);
            const enG = n == null ? null : nutriments[cle].unite === 'mg' ? n / 1000 : n;
            return [cle, vers100(enG, base, portionG)];
          })
        ),
      };
      for (const cle of Object.keys(corps)) if (typeof corps[cle] === 'number') corps[cle] = Math.round(corps[cle] * 1000) / 1000;
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
  const libelleBase = base === 'portion' ? valeurs.portion_texte.trim() || '1 portion' : `100 ${u}`;

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
          <span className="champ__libelle">Portion (comme sur l&apos;étiquette)</span>
          <input
            className="champ__saisie"
            placeholder="Ex. : 2 c. à soupe, 15 croustilles, 2 tranches"
            value={valeurs.portion_texte}
            onChange={changer('portion_texte')}
            maxLength={60}
          />
        </label>
        <div className="champ">
          <span className="champ__libelle">Poids de cette portion</span>
          <div className="champ__groupe">
            <input className="champ__saisie" inputMode="decimal" value={valeurs.portion_g} onChange={changer('portion_g')} aria-label="Poids de la portion" />
            <select className="champ__saisie champ__saisie--unite" value={u} onChange={changer('unite')} aria-label="Unité">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
          <span className="champ__aide">Sert seulement au calcul ; indiqué entre parenthèses sur l&apos;étiquette.</span>
        </div>
      </div>

      <div className="champ">
        <span className="champ__libelle">Valeurs nutritives pour</span>
        <div className="onglets" role="tablist">
          <button type="button" role="tab" aria-selected={base === 'portion'} className={`onglets__bouton${base === 'portion' ? ' onglets__bouton--actif' : ''}`} onClick={() => changerBase('portion')}>
            1 portion{valeurs.portion_texte.trim() ? ` (${valeurs.portion_texte.trim()})` : ''}
          </button>
          <button type="button" role="tab" aria-selected={base === '100'} className={`onglets__bouton${base === '100' ? ' onglets__bouton--actif' : ''}`} onClick={() => changerBase('100')}>
            100 {u}
          </button>
        </div>
      </div>

      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Calories</span>
          <input className="champ__saisie" inputMode="decimal" value={valeurs.kcal} onChange={changer('kcal')} aria-describedby="base-aliment" />
        </label>
        {NUTRIMENTS.map(([cle, libelle]) => (
          <div key={cle} className="champ">
            <span className="champ__libelle">{libelle}</span>
            <div className="champ__groupe">
              <input className="champ__saisie" inputMode="decimal" value={nutriments[cle].valeur} onChange={changerNutriment(cle, 'valeur')} aria-label={libelle} />
              <select className="champ__saisie champ__saisie--unite" value={nutriments[cle].unite} onChange={changerNutriment(cle, 'unite')} aria-label={`Unité : ${libelle}`}>
                <option value="g">g</option>
                <option value="mg">mg</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      <p className="champ__aide" id="base-aliment">Valeurs pour {libelleBase}.</p>

      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Code-barres</span>
          <input className="champ__saisie" inputMode="numeric" value={valeurs.code_barre} onChange={changer('code_barre')} maxLength={14} />
        </label>
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
