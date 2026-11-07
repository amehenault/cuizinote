'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil } from 'lucide-react';
import { GROUPES_MESURES, libelleMesure, mlDeMesure } from '@/lib/mesures';

const mlFr = (ml) => `${String(Math.round(ml * 10) / 10).replace('.', ',')} ml`;

/**
 * Choix de la mesure d'un ingrédient : cuillère à thé, cuillère à soupe, tasse (avec les ml),
 * ou « Mesure manuelle » (portions de l'étiquette ou grammes).
 * valeur : « tasse:1/3 » ou '' (manuelle).
 */
export default function SelecteurMesure({ valeur, onChange, detailManuel, equivalent, libelle }) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => !boite.current?.contains(e.target) && setOuvert(false);
    const touche = (e) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', dehors);
    document.addEventListener('touchstart', dehors);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('touchstart', dehors);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);

  const choisir = (cle) => {
    onChange(cle);
    setOuvert(false);
  };
  const horsListe = valeur && !GROUPES_MESURES.some((g) => g.options.includes(valeur));

  return (
    <div className="mesure" ref={boite}>
      <button
        type="button"
        className={`mesure__bouton${valeur ? '' : ' mesure__bouton--manuel'}`}
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={libelle}
      >
        <span className="mesure__valeur">
          {valeur ? libelleMesure(valeur, { avecMl: false }) : 'Mesure manuelle'}
          {valeur && equivalent && <span className="mesure__equivalent">{equivalent}</span>}
        </span>
        <ChevronDown size={16} aria-hidden="true" className="mesure__chevron" />
      </button>

      {ouvert && (
        <div className="mesure__panneau" role="listbox" aria-label={libelle}>
          {horsListe && (
            <div className="mesure__groupe">
              <div className="mesure__grille">
                <Pastille cle={valeur} actif onClick={() => setOuvert(false)} />
              </div>
            </div>
          )}
          {GROUPES_MESURES.map((g) => (
            <div key={g.titre} className="mesure__groupe">
              <p className="mesure__titre">{g.titre}</p>
              <div className="mesure__grille">
                {g.options.map((cle) => (
                  <Pastille key={cle} cle={cle} actif={cle === valeur} onClick={() => choisir(cle)} />
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            role="option"
            aria-selected={!valeur}
            className={`mesure__manuelle${!valeur ? ' mesure__manuelle--actif' : ''}`}
            onClick={() => choisir('')}
          >
            <Pencil size={16} aria-hidden="true" />
            <span>
              <strong>Mesure manuelle</strong>
              <span className="mesure__detail">{detailManuel}</span>
            </span>
            {!valeur && <Check size={16} aria-hidden="true" className="mesure__coche" />}
          </button>
        </div>
      )}
    </div>
  );
}

function Pastille({ cle, actif, onClick }) {
  const quantite = String(cle).split(':')[1];
  return (
    <button
      type="button"
      role="option"
      aria-selected={actif}
      className={`mesure__pastille${actif ? ' mesure__pastille--actif' : ''}`}
      onClick={onClick}
      title={libelleMesure(cle)}
    >
      <span className="mesure__fraction">{quantite.includes('.') ? quantite.replace('.', ',') : quantite}</span>
      <span className="mesure__ml">{mlFr(mlDeMesure(cle))}</span>
    </button>
  );
}
