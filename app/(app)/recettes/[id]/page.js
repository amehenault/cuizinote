'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Check, CircleAlert, Clock, ExternalLink, Flame, Pencil, ShoppingCart, Trash2, Users } from 'lucide-react';
import { api, urlImage } from '@/lib/client';
import { MOMENTS, versIso } from '@/lib/dates';
import { LIBELLES_EMPLACEMENT, trouverEnInventaire } from '@/lib/disponibilite';
import { Chargement, EntetePage, Etoiles, Message, Modale, versNombre } from '@/components/Elements';

function Nutrition({ recette }) {
  const valeurs = [
    ['kcal', 'kcal', recette.kcal],
    ['proteines', 'Protéines (g)', recette.proteines],
    ['glucides', 'Glucides (g)', recette.glucides],
    ['lipides', 'Lipides (g)', recette.lipides],
  ];
  if (valeurs.every(([, , v]) => v == null)) {
    return <p className="champ__aide">Aucune valeur nutritive. Liez des ingrédients à la banque d&apos;aliments ou saisissez-les.</p>;
  }
  return (
    <div className="pile pile--serre">
      <div className="nutrition">
        {valeurs.map(([cle, libelle, v]) => (
          <div key={cle} className="nutrition__valeur">
            <span className="nutrition__nombre">{v == null ? '-' : Math.round(v)}</span>
            <span className="nutrition__libelle">{libelle}</span>
          </div>
        ))}
      </div>
      <p className="nutrition__source">
        Par portion.{' '}
        {recette.nutrition_manuelle
          ? 'Valeurs saisies manuellement.'
          : recette.kcal_calcule != null
            ? `Calculé automatiquement à partir de ${recette.ingredients_lies} ingrédient${recette.ingredients_lies > 1 ? 's' : ''} (produits liés et calories saisies).`
            : 'Valeurs saisies ou importées.'}
      </p>
    </div>
  );
}

export default function PageRecette({ params }) {
  const { id } = use(params);
  const routeur = useRouter();
  const [recette, setRecette] = useState(null);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [planif, setPlanif] = useState(null);
  const [inventaire, setInventaire] = useState(null);
  const [aAcheter, setAAcheter] = useState(new Set());

  useEffect(() => {
    Promise.all([api(`/api/recettes/${id}`), api('/api/inventaire')])
      .then(([rec, inv]) => {
        setRecette(rec);
        setInventaire(inv);
        // Par défaut, on coche seulement les ingrédients manquants
        setAAcheter(new Set(rec.ingredients.map((ing, n) => (trouverEnInventaire(ing, inv) ? null : n)).filter((n) => n !== null)));
      })
      .catch((e) => setErreur(e.message));
  }, [id]);

  async function supprimer() {
    if (!window.confirm('Supprimer définitivement cette recette ?')) return;
    try {
      await api(`/api/recettes/${id}`, { methode: 'DELETE' });
      routeur.push('/recettes');
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function ajouterAEpicerie() {
    const choisis = recette.ingredients.filter((_, n) => aAcheter.has(n));
    if (!choisis.length) {
      setInfo('Rien à ajouter : vous avez déjà tout.');
      return;
    }
    try {
      await Promise.all(
        choisis.map((i) => api('/api/epicerie', { methode: 'POST', corps: { nom: i.texte, rayon: recette.titre.slice(0, 60) } }))
      );
      setInfo(`${choisis.length} ingrédient${choisis.length > 1 ? 's' : ''} ajouté${choisis.length > 1 ? 's' : ''} à la liste d'épicerie.`);
    } catch (e) {
      setErreur(e.message);
    }
  }

  const basculerAchat = (n) =>
    setAAcheter((x) => {
      const copie = new Set(x);
      if (copie.has(n)) copie.delete(n);
      else copie.add(n);
      return copie;
    });

  async function planifier(e) {
    e.preventDefault();
    try {
      await api('/api/planificateur', {
        methode: 'POST',
        corps: { jour: planif.jour, moment: planif.moment, recette_id: id, portions: versNombre(planif.portions) || 1 },
      });
      setPlanif(null);
      setInfo('Recette ajoutée au planificateur.');
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (erreur && !recette) return <Message type="erreur">{erreur}</Message>;
  if (!recette) return <Chargement />;

  const temps = (recette.temps_preparation || 0) + (recette.temps_cuisson || 0);
  const manquants = inventaire ? recette.ingredients.filter((i) => !trouverEnInventaire(i, inventaire)).length : 0;

  return (
    <article className="recette">
      {recette.image_id && (
        <div className="recette__couverture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="recette__image" src={urlImage(recette.image_id)} alt={recette.titre} />
        </div>
      )}

      <EntetePage titre={recette.titre} sousTitre={recette.description}>
        <button type="button" className="bouton bouton--principal" onClick={() => setPlanif({ jour: versIso(), moment: 'souper', portions: '1' })}>
          <CalendarPlus size={16} aria-hidden="true" />
          Planifier
        </button>
        <button type="button" className="bouton bouton--secondaire" onClick={ajouterAEpicerie}>
          <ShoppingCart size={16} aria-hidden="true" />
          Ajouter les manquants
        </button>
        <Link href={`/recettes/${id}/modifier`} className="bouton bouton--secondaire">
          <Pencil size={16} aria-hidden="true" />
          Modifier
        </Link>
        <button type="button" className="bouton bouton--fantome bouton--icone" onClick={supprimer} aria-label="Supprimer la recette">
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </EntetePage>

      <Message type="succes">{info}</Message>
      <Message type="erreur">{erreur}</Message>

      <div className="recette__meta">
        <span className="carte-recette__info"><Users size={16} aria-hidden="true" />{recette.portions} portion{recette.portions > 1 ? 's' : ''}</span>
        {recette.temps_preparation > 0 && <span className="carte-recette__info"><Clock size={16} aria-hidden="true" />Préparation {recette.temps_preparation} min</span>}
        {recette.temps_cuisson > 0 && <span className="carte-recette__info"><Flame size={16} aria-hidden="true" />Cuisson {recette.temps_cuisson} min</span>}
        {temps > 0 && <span className="carte-recette__info">Total {temps} min</span>}
        {recette.note > 0 && <Etoiles valeur={recette.note} />}
        <span className={`etiquette${recette.publiee ? ' etiquette--succes' : ' etiquette--neutre'}`}>
          {recette.publiee ? 'Publiée dans la communauté' : 'Privée'}
        </span>
      </div>

      {recette.etiquettes.length > 0 && (
        <div className="carte-recette__etiquettes">
          {recette.etiquettes.map((e) => <span key={e} className="etiquette">{e}</span>)}
        </div>
      )}

      <div className="recette__colonnes">
        <div className="pile">
          <section className="carte">
            <div className="carte__corps">
              <h2>Valeurs nutritives</h2>
              <Nutrition recette={recette} />
            </div>
          </section>
          <section className="carte">
            <div className="carte__corps">
              <h2>Ingrédients</h2>
              {inventaire && recette.ingredients.length > 0 && (
                <p className="champ__aide">
                  {recette.ingredients.length - manquants} sur {recette.ingredients.length} en inventaire. Cochez ce que vous voulez acheter.
                </p>
              )}
              <ul className="recette__ingredients">
                {recette.ingredients.map((i, n) => {
                  const dispo = inventaire ? trouverEnInventaire(i, inventaire) : null;
                  return (
                    <li key={n} className="recette__ingredient">
                      <label className="recette__ingredient-choix">
                        <input
                          type="checkbox"
                          className="epicerie__case"
                          checked={aAcheter.has(n)}
                          onChange={() => basculerAchat(n)}
                          aria-label={`Acheter : ${i.texte}`}
                        />
                        <span>{i.texte}</span>
                      </label>
                      <span className="recette__ingredient-etat">
                        {inventaire && (dispo ? (
                          <span className="etiquette etiquette--succes">
                            <Check size={12} aria-hidden="true" />
                            J&apos;ai ({LIBELLES_EMPLACEMENT[dispo.emplacement]})
                          </span>
                        ) : (
                          <span className="etiquette etiquette--alerte">
                            <CircleAlert size={12} aria-hidden="true" />
                            Manquant
                          </span>
                        ))}
                        {i.kcal != null && <span className="recette__ingredient-kcal">{i.kcal} kcal</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {recette.ingredients.length > 0 && (
                <button type="button" className="bouton bouton--principal" onClick={ajouterAEpicerie} disabled={!aAcheter.size}>
                  <ShoppingCart size={16} aria-hidden="true" />
                  Ajouter {aAcheter.size} ingrédient{aAcheter.size > 1 ? 's' : ''} à l&apos;épicerie
                </button>
              )}
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
                <h2>Notes</h2>
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

      <Modale titre="Planifier cette recette" ouverte={!!planif} onFermer={() => setPlanif(null)}>
        {planif && (
          <form className="formulaire" onSubmit={planifier}>
            <div className="formulaire__ligne">
              <label className="champ">
                <span className="champ__libelle">Jour</span>
                <input className="champ__saisie" type="date" required value={planif.jour} onChange={(e) => setPlanif({ ...planif, jour: e.target.value })} />
              </label>
              <label className="champ">
                <span className="champ__libelle">Repas</span>
                <select className="champ__saisie" value={planif.moment} onChange={(e) => setPlanif({ ...planif, moment: e.target.value })}>
                  {MOMENTS.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
                </select>
              </label>
              <label className="champ">
                <span className="champ__libelle">Portions mangées</span>
                <input className="champ__saisie" inputMode="decimal" value={planif.portions} onChange={(e) => setPlanif({ ...planif, portions: e.target.value })} />
              </label>
            </div>
            <div className="formulaire__actions">
              <button type="submit" className="bouton bouton--principal">
                <CalendarPlus size={16} aria-hidden="true" />
                Ajouter au planificateur
              </button>
            </div>
          </form>
        )}
      </Modale>
    </article>
  );
}
