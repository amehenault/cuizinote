'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookmarkPlus, Clock, ExternalLink, Flame, UserRound, Users } from 'lucide-react';
import { api, urlImage } from '@/lib/client';
import { Chargement, EntetePage, Message } from '@/components/Elements';

/** Recette d'une autre personne : lecture seule, avec « Ajouter à mes recettes ». */
export default function PageRecetteCommunaute({ params }) {
  const { id } = use(params);
  const routeur = useRouter();
  const [recette, setRecette] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    api(`/api/communaute/${id}`)
      .then((r) => (r.mienne ? routeur.replace(`/recettes/${id}`) : setRecette(r)))
      .catch((e) => setErreur(e.message));
  }, [id, routeur]);

  async function ajouter() {
    setEnvoi(true);
    try {
      const { id: nouvelle } = await api(`/api/communaute/${id}/copier`, { methode: 'POST' });
      routeur.push(`/recettes/${nouvelle}`);
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  if (erreur && !recette) return <Message type="erreur">{erreur}</Message>;
  if (!recette) return <Chargement />;

  const temps = (recette.temps_preparation || 0) + (recette.temps_cuisson || 0);
  const nutrition = [
    ['kcal', recette.kcal],
    ['Protéines (g)', recette.proteines],
    ['Glucides (g)', recette.glucides],
    ['Lipides (g)', recette.lipides],
  ];

  return (
    <article className="recette">
      <div>
        <Link href="/communaute" className="bouton bouton--fantome bouton--petit">
          <ArrowLeft size={14} aria-hidden="true" />
          Communauté
        </Link>
      </div>
      {recette.image_id && (
        <div className="recette__couverture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="recette__image" src={urlImage(recette.image_id)} alt={recette.titre} />
        </div>
      )}

      <EntetePage titre={recette.titre} sousTitre={recette.description}>
        <button type="button" className="bouton bouton--principal" onClick={ajouter} disabled={envoi}>
          <BookmarkPlus size={16} aria-hidden="true" />
          {envoi ? 'Ajout...' : 'Ajouter à mes recettes'}
        </button>
      </EntetePage>
      <Message type="erreur">{erreur}</Message>

      <div className="recette__meta">
        <span className="carte-recette__info"><UserRound size={16} aria-hidden="true" />Partagée par {recette.auteur}</span>
        <span className="carte-recette__info"><Users size={16} aria-hidden="true" />{recette.portions} portion{recette.portions > 1 ? 's' : ''}</span>
        {recette.temps_preparation > 0 && <span className="carte-recette__info"><Clock size={16} aria-hidden="true" />Préparation {recette.temps_preparation} min</span>}
        {recette.temps_cuisson > 0 && <span className="carte-recette__info"><Flame size={16} aria-hidden="true" />Cuisson {recette.temps_cuisson} min</span>}
        {temps > 0 && <span className="carte-recette__info">Total {temps} min</span>}
      </div>

      {recette.etiquettes.length > 0 && (
        <div className="carte-recette__etiquettes">
          {recette.etiquettes.map((e) => <span key={e} className="etiquette">{e}</span>)}
        </div>
      )}

      <div className="recette__colonnes">
        <div className="pile">
          {nutrition.some(([, v]) => v != null) && (
            <section className="carte">
              <div className="carte__corps">
                <h2>Valeurs nutritives</h2>
                <div className="nutrition">
                  {nutrition.map(([libelle, v]) => (
                    <div key={libelle} className="nutrition__valeur">
                      <span className="nutrition__nombre">{v == null ? '-' : Math.round(v)}</span>
                      <span className="nutrition__libelle">{libelle}</span>
                    </div>
                  ))}
                </div>
                <p className="nutrition__source">Par portion.</p>
              </div>
            </section>
          )}
          <section className="carte">
            <div className="carte__corps">
              <h2>Ingrédients</h2>
              <ul className="recette__ingredients">
                {recette.ingredients.map((i, n) => (
                  <li key={n} className="recette__ingredient">
                    <span>{i.texte}</span>
                    {i.kcal != null && <span className="recette__ingredient-kcal">{i.kcal} kcal</span>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
        <div className="pile">
          <section className="carte">
            <div className="carte__corps">
              <h2>Préparation</h2>
              {recette.etapes.length ? (
                <ol className="recette__etapes">
                  {recette.etapes.map((e, n) => <li key={n} className="recette__etape">{e}</li>)}
                </ol>
              ) : (
                <p className="champ__aide">Aucune étape.</p>
              )}
            </div>
          </section>
          {(recette.commentaires || recette.source_url) && (
            <section className="carte">
              <div className="carte__corps">
                <h2>Notes de {recette.auteur}</h2>
                {recette.commentaires && <p className="recette__commentaires">{recette.commentaires}</p>}
                {recette.source_url && (
                  <a href={recette.source_url} target="_blank" rel="noopener noreferrer nofollow" className="carte-recette__info">
                    <ExternalLink size={14} aria-hidden="true" />
                    Recette originale
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
