'use client';

import { useEffect, useState } from 'react';
import { Search, UsersRound } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, EtatVide, Message } from '@/components/Elements';
import CarteRecette from '@/components/CarteRecette';

export default function PageCommunaute() {
  const [recettes, setRecettes] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [toutes, setToutes] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const minuterie = setTimeout(() => {
      api(`/api/communaute?${new URLSearchParams({ q: recherche })}`).then(setRecettes).catch((e) => setErreur(e.message));
    }, 200);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  const affichees = (recettes || []).filter((r) => toutes || !r.mienne);

  return (
    <>
      <EntetePage titre="Communauté" sousTitre="Les recettes partagées par les membres. Ajoutez celles qui vous plaisent à vos recettes." />

      <div className="filtres">
        <div className="recherche">
          <Search className="recherche__icone" size={16} aria-hidden="true" />
          <input
            className="champ__saisie recherche__saisie"
            placeholder="Rechercher une recette"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher une recette de la communauté"
          />
        </div>
        <label className="champ--case">
          <input type="checkbox" checked={toutes} onChange={(e) => setToutes(e.target.checked)} />
          <span>Afficher aussi mes recettes publiées</span>
        </label>
      </div>

      <Message type="erreur">{erreur}</Message>
      {!recettes && !erreur && <Chargement />}
      {recettes && affichees.length === 0 && (
        <EtatVide Icone={UsersRound} titre={recherche ? 'Aucune recette trouvée' : 'Rien de partagé pour le moment'}>
          <p>Les recettes publiées par les autres membres apparaîtront ici.</p>
        </EtatVide>
      )}
      {affichees.length > 0 && (
        <div className="grille grille--cartes">
          {affichees.map((r) => (
            <CarteRecette key={r.id} recette={r} href={r.mienne ? `/recettes/${r.id}` : `/communaute/${r.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
