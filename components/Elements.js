'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Star, X } from 'lucide-react';

export function EntetePage({ titre, sousTitre, children }) {
  return (
    <header className="entete">
      <div className="entete__titres">
        <h1>{titre}</h1>
        {sousTitre && <p className="entete__sous-titre">{sousTitre}</p>}
      </div>
      {children && <div className="entete__actions">{children}</div>}
    </header>
  );
}

export function Chargement({ texte = 'Chargement...' }) {
  return (
    <div className="chargement" role="status">
      <Loader2 className="chargement__icone" size={20} aria-hidden="true" />
      {texte}
    </div>
  );
}

export function EtatVide({ Icone, titre, children }) {
  return (
    <div className="vide">
      {Icone && <Icone className="vide__icone" size={44} aria-hidden="true" />}
      <h2>{titre}</h2>
      {children}
    </div>
  );
}

const ICONES_MESSAGE = { erreur: AlertCircle, succes: CheckCircle2, info: Info, alerte: AlertCircle };

export function Message({ type = 'info', children }) {
  if (!children) return null;
  const Icone = ICONES_MESSAGE[type];
  return (
    <div className={`message message--${type}`} role={type === 'erreur' ? 'alert' : 'status'}>
      <Icone size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function Modale({ titre, ouverte, onFermer, large = false, children }) {
  const boite = useRef(null);
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });

  useEffect(() => {
    if (!ouverte) return undefined;
    const precedent = document.activeElement;
    boite.current?.focus();
    const touche = (e) => e.key === 'Escape' && fermer.current();
    document.addEventListener('keydown', touche);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = '';
      precedent?.focus?.();
    };
  }, [ouverte]);

  if (!ouverte) return null;
  return (
    <div className="modale" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div
        className={`modale__boite${large ? ' modale__boite--large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        tabIndex={-1}
        ref={boite}
      >
        <div className="modale__entete">
          <h2>{titre}</h2>
          <button type="button" className="bouton bouton--fantome bouton--icone" onClick={onFermer} aria-label="Fermer">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modale__corps">{children}</div>
      </div>
    </div>
  );
}

export function Etoiles({ valeur = 0, onChange, taille = 18 }) {
  return (
    <div className="etoiles" role={onChange ? 'radiogroup' : 'img'} aria-label={`Note : ${valeur || 0} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`etoiles__bouton${n <= (valeur || 0) ? ' etoiles__bouton--plein' : ''}`}
          disabled={!onChange}
          onClick={() => onChange?.(n === valeur ? 0 : n)}
          aria-label={onChange ? `${n} sur 5` : undefined}
          aria-hidden={onChange ? undefined : 'true'}
        >
          <Star size={taille} fill={n <= (valeur || 0) ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** Champ numérique : retourne un nombre ou null. */
export function versNombre(valeur) {
  if (valeur === '' || valeur == null) return null;
  const n = Number(String(valeur).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
