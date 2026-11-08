'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, X } from 'lucide-react';
import { clePrecise, estPoids, G_PAR_UNITE, GROUPES_MESURES, grammesDePoids, libelleMesure, mlDeMesure } from '@/lib/mesures';

const mlFr = (ml) => `${String(Math.round(ml * 10) / 10).replace('.', ',')} ml`;

/**
 * Choix de la mesure d'un ingrédient : cuillère à thé, cuillère à soupe, tasse (avec les ml),
 * une quantité précise (« 254 g », « 1/2 lb ») ou « Mesure manuelle » (portions de l'étiquette ou grammes).
 * valeur : « tasse:1/3 », « lb:1/2 » ou '' (manuelle).
 */
export default function SelecteurMesure({ valeur, onChange, detailManuel, equivalent, libelle, groupes = GROUPES_MESURES, unites = [] }) {
  const [ouvert, setOuvert] = useState(false);
  const [unitePrecise, uniteValeur] = String(valeur || '').split(':');
  const precise = unites.some(([u]) => u === unitePrecise) && !groupes.some((g) => g.options.includes(valeur));
  const [saisie, setSaisie] = useState({ quantite: precise ? uniteValeur : '', unite: precise ? unitePrecise : unites[0]?.[0] || 'g' });
  const clePrete = clePrecise(saisie.unite, saisie.quantite);
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
  const horsListe = valeur && !precise && !groupes.some((g) => g.options.includes(valeur));

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

      {ouvert && <div className="mesure__voile" aria-hidden="true" onClick={() => setOuvert(false)} />}
      {ouvert && (
        <div className="mesure__panneau" role="listbox" aria-label={libelle}>
          <div className="mesure__entete">
            <span>Choisir la mesure</span>
            <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => setOuvert(false)} aria-label="Fermer">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {horsListe && (
            <div className="mesure__groupe">
              <div className="mesure__grille">
                <Pastille cle={valeur} actif onClick={() => setOuvert(false)} />
              </div>
            </div>
          )}
          {unites.length > 0 && (
            <div className="mesure__groupe">
              <p className="mesure__titre">Quantité précise</p>
              <div className="mesure__precise">
                <input
                  className="champ__saisie champ__saisie--compact mesure__precise-saisie"
                  inputMode="decimal"
                  placeholder="ex. : 254 ou 1/2"
                  value={saisie.quantite}
                  onChange={(e) => setSaisie((x) => ({ ...x, quantite: e.target.value }))}
                  onKeyDown={(e) => {
                    // Pas de formulaire imbriqué : Entrée valide sans envoyer la recette.
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (clePrete) choisir(clePrete);
                  }}
                  aria-label="Quantité précise"
                />
                <div className="mesure__unites" role="radiogroup" aria-label="Unité">
                  {unites.map(([u, nom]) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={saisie.unite === u}
                      className={`mesure__unite${saisie.unite === u ? ' mesure__unite--actif' : ''}`}
                      onClick={() => setSaisie((x) => ({ ...x, unite: u }))}
                    >
                      {nom}
                    </button>
                  ))}
                </div>
                <button type="button" className="bouton bouton--principal bouton--petit" disabled={!clePrete} onClick={() => choisir(clePrete)}>
                  <Check size={14} aria-hidden="true" />
                  OK
                </button>
              </div>
              {clePrete && G_PAR_UNITE[saisie.unite] && saisie.unite !== 'g' && (
                <p className="mesure__detail">= {String(Math.round(grammesDePoids(clePrete))).replace('.', ',')} g</p>
              )}
            </div>
          )}
          {groupes.map((g) => (
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
  const [unite, quantite] = String(cle).split(':');
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
      <span className="mesure__ml">
        {estPoids(cle) ? unite : unite === 'spray' ? `${String(mlDeMesure(cle)).replace('.', ',')} ml` : mlFr(mlDeMesure(cle))}
      </span>
    </button>
  );
}
