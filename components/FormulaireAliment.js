'use client';

import { useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/client';
import { Message, versNombre } from './Elements';
import TeleversementImage from './TeleversementImage';

// Nutriments stockés en grammes pour 100 g. Unité affichée par défaut comme sur une étiquette
// canadienne : grammes pour les macronutriments, milligrammes pour le sodium.
const NUTRIMENTS = [
  ['proteines_100g', 'Protéines', 'g'],
  ['glucides_100g', 'Glucides', 'g'],
  ['lipides_100g', 'Lipides', 'g'],
  ['fibres_100g', 'Fibres', 'g'],
  ['sucres_100g', 'Sucres', 'g'],
  ['sodium_100g', 'Sodium', 'mg'],
];

/** Arrondi d'étiquette : entier (calories, mg) ou une décimale (grammes). */
const arrondir = (v, decimales) => {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
};
const versTexte = (v, decimales = 2) => (v == null ? '' : String(arrondir(v, decimales)));

/** Valeur stockée (pour 100) -> valeur affichée selon la base choisie (portion ou 100). */
const depuis100 = (v, base, portionG) => (v == null ? null : base === 'portion' && portionG ? (v * portionG) / 100 : v);
/** Valeur affichée -> valeur à stocker (pour 100). */
const vers100 = (v, base, portionG) => (v == null ? null : base === 'portion' ? (v * 100) / portionG : v);

/** Valeur en grammes -> champ affiché, dans l'unité par défaut du nutriment, arrondi comme sur l'étiquette. */
function initialNutriment(g, unite) {
  if (g == null) return { valeur: '', unite };
  return unite === 'mg' ? { valeur: versTexte(g * 1000, 0), unite } : { valeur: versTexte(g, 1), unite };
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
    portion_g: versTexte(initial.portion_g, 1),
    contenant_qte: versTexte(initial.contenant_qte, 2),
    contenant_unite: initial.contenant_unite || initial.unite || 'g',
    kcal: versTexte(depuis100(initial.kcal_100g, baseInitiale, initial.portion_g), 0),
  }));
  const [nutriments, setNutriments] = useState(() =>
    Object.fromEntries(
      NUTRIMENTS.map(([cle, , unite]) => [cle, initialNutriment(depuis100(initial[cle], baseInitiale, initial.portion_g), unite)])
    )
  );
  const [imageId, setImageId] = useState(initial.image_id || null);
  const [imageUrl, setImageUrl] = useState(initial.image_url || null);
  const [erreur, setErreur] = useState('');
  const [erreurPortion, setErreurPortion] = useState(false);
  const champPortion = useRef(null);
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
    const convertir = (t, decimales) => {
      const n = versNombre(t);
      return n == null ? t : versTexte(n * facteur, decimales);
    };
    setValeurs((v) => ({ ...v, kcal: convertir(v.kcal, 0) }));
    setNutriments((n) =>
      Object.fromEntries(Object.entries(n).map(([k, x]) => [k, { ...x, valeur: convertir(x.valeur, x.unite === 'mg' ? 0 : 1) }]))
    );
    setBase(nouvelle);
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    // Portion obligatoire : on remonte jusqu'au champ et on le signale.
    if (!valeurs.portion_texte.trim()) {
      setErreurPortion(true);
      champPortion.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      champPortion.current?.focus({ preventScroll: true });
      return;
    }
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
        contenant_qte: versNombre(valeurs.contenant_qte),
        contenant_unite: versNombre(valeurs.contenant_qte) ? valeurs.contenant_unite : null,
        kcal_100g: vers100(versNombre(valeurs.kcal), base, portionG),
        image_url: imageUrl,
        image_id: imageId,
        // Ancien champ « sel » (n'est plus affiché) : conservé tel quel
        sel_100g: initial.sel_100g ?? null,
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
      <div className="champ">
        <span className="champ__libelle">Photo</span>
        {!imageId && imageUrl ? (
          <div className="rangee">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="aliment__vignette aliment__vignette--grande" src={imageUrl} alt="" referrerPolicy="no-referrer" />
            <span className="champ__aide">Image d&apos;Open Food Facts.</span>
            <button type="button" className="bouton bouton--fantome bouton--petit" onClick={() => setImageUrl(null)}>
              Remplacer par ma photo
            </button>
          </div>
        ) : (
          <TeleversementImage imageId={imageId} onChange={setImageId} alt="Photo de l'aliment" compact />
        )}
      </div>
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
          <span className="champ__libelle">Portion (comme sur l&apos;étiquette) *</span>
          <input
            ref={champPortion}
            className={`champ__saisie${erreurPortion ? ' champ__saisie--erreur' : ''}`}
            value={valeurs.portion_texte}
            onChange={(e) => {
              changer('portion_texte')(e);
              if (e.target.value.trim()) setErreurPortion(false);
            }}
            maxLength={60}
            aria-invalid={erreurPortion}
            aria-describedby="aide-portion"
          />
          {erreurPortion ? (
            <span className="champ__erreur" id="aide-portion" role="alert">Cette information est obligatoire.</span>
          ) : (
            <span className="champ__aide" id="aide-portion">Ex. : 2 c. à soupe, 15 croustilles, 2 tranches</span>
          )}
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

      <div className="formulaire__ligne">
        <div className="champ">
          <span className="champ__libelle">Format du contenant</span>
          <div className="champ__groupe">
            <input
              className="champ__saisie"
              inputMode="decimal"
              value={valeurs.contenant_qte}
              onChange={changer('contenant_qte')}
              aria-label="Format du contenant"
              aria-describedby="aide-contenant"
            />
            <select className="champ__saisie champ__saisie--unite" value={valeurs.contenant_unite} onChange={changer('contenant_unite')} aria-label="Unité du contenant">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
          <span className="champ__aide" id="aide-contenant">Le paquet complet (ex. : 893 ml). Quantité par défaut dans l&apos;inventaire.</span>
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
