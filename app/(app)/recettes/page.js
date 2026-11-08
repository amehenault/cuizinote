'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Apple, BookOpen, Bot, Plus, Search, UsersRound } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, EtatVide, Message } from '@/components/Elements';
import CarteRecette from '@/components/CarteRecette';
import { grouperEtiquettes } from '@/lib/etiquettes';

const MEMOIRE = 'cuizinote:recettes';
function lireMemoire() {
  try {
    return JSON.parse(sessionStorage.getItem(MEMOIRE)) || {};
  } catch {
    return {};
  }
}
function ecrireMemoire(valeurs) {
  try {
    sessionStorage.setItem(MEMOIRE, JSON.stringify({ ...lireMemoire(), ...valeurs }));
  } catch {
    // stockage indisponible : on revient simplement en haut de la liste
  }
}

export default function PageRecettes() {
  const [recettes, setRecettes] = useState(null);
  const [etiquettes, setEtiquettes] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('');
  const [pret, setPret] = useState(false);
  // Panneau des filtres : ouvert par défaut, état gardé pour la visite.
  const [ouvert, setOuvert] = useState(true);
  const positionRestauree = useRef(false);

  // Recherche et filtre de la dernière visite (lus après l'affichage, pour éviter un décalage avec le serveur).
  useEffect(() => {
    const m = lireMemoire();
    setRecherche(m.recherche || '');
    setFiltre(m.filtre || '');
    if (m.ouvert === false) setOuvert(false);
    setPret(true);
  }, []);

  // Position dans la page, gardée pour le retour depuis une recette.
  useEffect(() => {
    const noter = () => positionRestauree.current && ecrireMemoire({ y: window.scrollY });
    window.addEventListener('scroll', noter, { passive: true });
    return () => window.removeEventListener('scroll', noter);
  }, []);
  useEffect(() => {
    if (pret) ecrireMemoire({ recherche, filtre, ouvert });
  }, [recherche, filtre, ouvert, pret]);
  useEffect(() => {
    if (!recettes || positionRestauree.current) return;
    const { y } = lireMemoire();
    requestAnimationFrame(() => {
      if (y) window.scrollTo(0, y);
      positionRestauree.current = true;
    });
  }, [recettes]);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api('/api/etiquettes').then(setEtiquettes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pret) return undefined;
    const minuterie = setTimeout(() => {
      const p = new URLSearchParams({ q: recherche, etiquette: filtre });
      api(`/api/recettes?${p}`).then(setRecettes).catch((e) => setErreur(e.message));
    }, 200);
    return () => clearTimeout(minuterie);
  }, [recherche, filtre, pret]);

  return (
    <>
      <EntetePage titre="Mes recettes" sousTitre="Votre banque de recettes et de plats">
        <Link href="/assistant" className="bouton bouton--secondaire">
          <Bot size={16} aria-hidden="true" />
          Assistant culinaire
        </Link>
        <Link href="/communaute" className="bouton bouton--secondaire">
          <UsersRound size={16} aria-hidden="true" />
          Communauté
        </Link>
        <Link href="/aliments?de=recettes" className="bouton bouton--secondaire">
          <Apple size={16} aria-hidden="true" />
          Aliments
        </Link>
        <Link href="/recettes/nouvelle" className="bouton bouton--principal">
          <Plus size={16} aria-hidden="true" />
          Nouvelle recette
        </Link>
      </EntetePage>

      <div className="filtres">
        <div className="recherche">
          <Search className="recherche__icone" size={16} aria-hidden="true" />
          <input
            className="champ__saisie recherche__saisie"
            placeholder="Rechercher une recette"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher une recette"
          />
        </div>
        {etiquettes.some((e) => e.total > 0) && (
          <details className="filtres__panneau" open={ouvert} onToggle={(ev) => setOuvert(ev.currentTarget.open)}>
            <summary className="filtres__resume">
              <span>Filtrer par étiquette</span>
              {filtre && <span className="etiquette etiquette--active">{filtre}</span>}
            </summary>
            <div className="filtres__groupes">
              <div>
                <button
                  type="button"
                  className={`etiquette etiquette--bouton${filtre === '' ? ' etiquette--active' : ' etiquette--neutre'}`}
                  onClick={() => setFiltre('')}
                >
                  Toutes les recettes
                </button>
              </div>
              {grouperEtiquettes(etiquettes.filter((e) => e.total > 0)).map(({ categorie, elements }) => (
                <div key={categorie.id} className="filtres__groupe" role="group" aria-label={categorie.titre}>
                  <p className="filtres__titre">{categorie.titre}</p>
                  <div className="filtres__etiquettes">
                    {elements.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className={`etiquette etiquette--bouton${filtre === e.nom ? ' etiquette--active' : ''}`}
                        onClick={() => setFiltre(filtre === e.nom ? '' : e.nom)}
                        aria-pressed={filtre === e.nom}
                      >
                        {e.nom} ({e.total})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <Message type="erreur">{erreur}</Message>
      {!recettes && !erreur && <Chargement />}
      {recettes?.length === 0 && (
        <EtatVide Icone={BookOpen} titre={recherche || filtre ? 'Aucune recette trouvée' : 'Aucune recette pour le moment'}>
          <p>Ajoutez votre première recette ou importez-la depuis un lien.</p>
          <Link href="/recettes/nouvelle" className="bouton bouton--principal">
            <Plus size={16} aria-hidden="true" />
            Ajouter une recette
          </Link>
        </EtatVide>
      )}
      {recettes?.length > 0 && (
        <div className="grille grille--cartes">
          {recettes.map((r) => (
            <CarteRecette key={r.id} recette={r} />
          ))}
        </div>
      )}
    </>
  );
}
