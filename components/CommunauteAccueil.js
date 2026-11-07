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
      // Recettes des autres en premier ; s'il n'y en a pas encore, les miennes publiées.
      .then((liste) => {
        const autres = liste.filter((r) => !r.mienne);
        setRecettes((autres.length ? autres : liste).slice(0, 12));
      })
      .catch(() => setRecettes([]));
  }, []);

  if (!recettes) return null;

  return (
    <section className="stat communaute" aria-labelledby="titre-communaute">
      <div className="rangee rangee--espacee">
        <h2 id="titre-communaute" className="stat__libelle communaute__titre">
          <UsersRound size={18} aria-hidden="true" />
          Communauté
        </h2>
        <Link href="/communaute" className="bouton bouton--fantome bouton--petit">
          Tout voir
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <p className="stat__note">Recettes partagées avec toute la communauté</p>
      {recettes.length > 0 && (
        <div className="communaute__bande">
          {recettes.map((r) => (
            <CarteRecette key={r.id} recette={r} href={r.mienne ? `/recettes/${r.id}` : `/communaute/${r.id}`} compacte />
          ))}
        </div>
      )}
    </section>
  );
}
