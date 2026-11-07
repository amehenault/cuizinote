'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, UsersRound } from 'lucide-react';
import { api } from '@/lib/client';
import CarteRecette from './CarteRecette';

/** Dernières recettes publiées par les autres membres, en bandeau défilant. */
export default function CommunauteAccueil() {
  const [recettes, setRecettes] = useState(null);

  useEffect(() => {
    api('/api/communaute?limite=30')
      .then((liste) => setRecettes(liste.filter((r) => !r.mienne).slice(0, 12)))
      .catch(() => setRecettes([]));
  }, []);

  if (!recettes) return null;

  return (
    <section className="communaute" aria-labelledby="titre-communaute">
      <div className="rangee rangee--espacee">
        <h2 id="titre-communaute" className="carte__titre">
          <UsersRound size={18} aria-hidden="true" />
          Communauté
        </h2>
        <Link href="/communaute" className="bouton bouton--fantome bouton--petit">
          Tout voir
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {recettes.length ? (
        <div className="communaute__bande">
          {recettes.map((r) => (
            <CarteRecette key={r.id} recette={r} href={`/communaute/${r.id}`} compacte />
          ))}
        </div>
      ) : (
        <p className="champ__aide">Les recettes partagées par les autres membres apparaîtront ici.</p>
      )}
    </section>
  );
}
