import Link from 'next/link';
import { Clock, Flame, UtensilsCrossed, Users } from 'lucide-react';
import { urlImage } from '@/lib/client';
import { Etoiles } from './Elements';

export default function CarteRecette({ recette }) {
  const temps = (recette.temps_preparation || 0) + (recette.temps_cuisson || 0);
  return (
    <Link href={`/recettes/${recette.id}`} className="carte-recette">
      <div className="carte-recette__visuel">
        {recette.image_id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="carte-recette__image" src={urlImage(recette.image_id)} alt="" loading="lazy" />
        ) : (
          <UtensilsCrossed size={40} aria-hidden="true" />
        )}
      </div>
      <div className="carte-recette__corps">
        <h2 className="carte-recette__titre">{recette.titre}</h2>
        <div className="carte-recette__meta">
          {recette.kcal != null && (
            <span className="carte-recette__info">
              <Flame size={14} aria-hidden="true" />
              {Math.round(recette.kcal)} kcal/portion
            </span>
          )}
          {temps > 0 && (
            <span className="carte-recette__info">
              <Clock size={14} aria-hidden="true" />
              {temps} min
            </span>
          )}
          <span className="carte-recette__info">
            <Users size={14} aria-hidden="true" />
            {recette.portions}
          </span>
        </div>
        {recette.note > 0 && <Etoiles valeur={recette.note} taille={14} />}
        {recette.etiquettes?.length > 0 && (
          <div className="carte-recette__etiquettes">
            {recette.etiquettes.slice(0, 5).map((e) => (
              <span key={e} className="etiquette">{e}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
