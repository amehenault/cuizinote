'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Apple, BookOpen, Bot, Plus, Search, UsersRound } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, EtatVide, Message } from '@/components/Elements';
import CarteRecette from '@/components/CarteRecette';

export default function PageRecettes() {
  const [recettes, setRecettes] = useState(null);
  const [etiquettes, setEtiquettes] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api('/api/etiquettes').then(setEtiquettes).catch(() => {});
  }, []);

  useEffect(() => {
    const minuterie = setTimeout(() => {
      const p = new URLSearchParams({ q: recherche, etiquette: filtre });
      api(`/api/recettes?${p}`).then(setRecettes).catch((e) => setErreur(e.message));
    }, 200);
    return () => clearTimeout(minuterie);
  }, [recherche, filtre]);

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
        {etiquettes.length > 0 && (
          <div className="filtres__etiquettes">
            <button
              type="button"
              className={`etiquette etiquette--bouton${filtre === '' ? ' etiquette--active' : ' etiquette--neutre'}`}
              onClick={() => setFiltre('')}
            >
              Toutes
            </button>
            {etiquettes.filter((e) => e.total > 0).map((e) => (
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
