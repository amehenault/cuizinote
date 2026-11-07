'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Check, CircleAlert, Clock, ExternalLink, Flame, Minus, Pencil, Plus, ShoppingCart, Trash2, Users, Utensils } from 'lucide-react';
import { api, urlImage } from '@/lib/client';
import { MOMENTS, nombreFr, versIso } from '@/lib/dates';
import { ajusterIngredient, ecrireQuantite } from '@/lib/quantites';
import { LIBELLES_EMPLACEMENT, trouverEnInventaire } from '@/lib/disponibilite';
import { Chargement, EntetePage, Etoiles, Message, Modale, versNombre } from '@/components/Elements';

/** Choix du nombre de portions : boutons − / + et saisie libre (ex. : 1,5). */
function ChoixPortions({ valeur, onChange }) {
  const n = versNombre(valeur) || 0;
  const changer = (delta) => {
    const suivant = delta < 0 ? (n > 1 ? Math.ceil(n) - 1 : 0.5) : n < 1 ? 1 : Math.floor(n) + 1;
    onChange(String(Math.min(100, suivant)).replace('.', ','));
  };
  return (
    <div className="portions-choix">
      <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => changer(-1)} disabled={n <= 0.5} aria-label="Une portion de moins">
        <Minus size={16} aria-hidden="true" />
      </button>
      <input className="champ__saisie portions-choix__saisie" inputMode="decimal" value={valeur} onChange={(e) => onChange(e.target.value)} aria-label="Nombre de portions" />
      <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => changer(1)} disabled={n >= 100} aria-label="Une portion de plus">
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function Nutrition({ recette, nb }) {
  const fois = (v) => (v == null ? null : v * nb);
  const valeurs = [
    ['kcal', 'kcal', fois(recette.kcal)],
    ['proteines', 'Protéines (g)', fois(recette.proteines)],
    ['glucides', 'Glucides (g)', fois(recette.glucides)],
    ['lipides', 'Lipides (g)', fois(recette.lipides)],
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
        {nb === 1 ? 'Pour 1 portion.' : `Pour ${ecrireQuantite(nb)} portions (${nombreFr(recette.kcal)} kcal par portion).`}{' '}
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
  const [mange, setMange] = useState(null);
  const [portionsChoisies, setPortionsChoisies] = useState('1');
  const [inventaire, setInventaire] = useState(null);
  const [aAcheter, setAAcheter] = useState(new Set());

  useEffect(() => {
    Promise.all([api(`/api/recettes/${id}`), api('/api/inventaire')])
      .then(([rec, inv]) => {
        setRecette(rec);
        setPortionsChoisies(String(rec.portions).replace('.', ','));
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

  async function ajouterAuJournal(e) {
    e.preventDefault();
    try {
      await api('/api/journal', {
        methode: 'POST',
        corps: { jour: mange.jour, moment: mange.moment, recette_id: id, portions: versNombre(mange.portions) || 1 },
      });
      setMange(null);
      setInfo('Ajouté à vos repas (calories comptées).');
    } catch (err) {
      setErreur(err.message);
    }
  }

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

  const nb = versNombre(portionsChoisies) > 0 ? Math.min(100, versNombre(portionsChoisies)) : recette.portions;
  const facteur = nb / (recette.portions || 1);
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

      <Link href="/recettes" className="bouton bouton--fantome" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} aria-hidden="true" />
        Mes recettes
      </Link>
      <EntetePage titre={recette.titre} sousTitre={recette.description}>
        <button type="button" className="bouton bouton--principal" onClick={() => setPlanif({ jour: versIso(), moment: 'souper', portions: portionsChoisies })}>
          <CalendarPlus size={16} aria-hidden="true" />
          Planifier
        </button>
        <button type="button" className="bouton bouton--secondaire" onClick={ajouterAEpicerie}>
          <ShoppingCart size={16} aria-hidden="true" />
          Ajouter les manquants
        </button>
        <Link href={`/recettes/${id}/modifier?de=fiche`} className="bouton bouton--secondaire">
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
              <div className="portions-ligne">
                <span className="champ__libelle">Portions</span>
                <ChoixPortions valeur={portionsChoisies} onChange={setPortionsChoisies} />
                {facteur !== 1 && (
                  <button type="button" className="bouton bouton--fantome" onClick={() => setPortionsChoisies(String(recette.portions).replace('.', ','))}>
                    Recette originale ({ecrireQuantite(recette.portions)})
                  </button>
                )}
              </div>
              <Nutrition recette={recette} nb={nb} />
              <button type="button" className="bouton bouton--principal" onClick={() => setMange({ jour: versIso(), moment: 'souper', portions: portionsChoisies })}>
                <Utensils size={16} aria-hidden="true" />
                Ajouter à mes repas
              </button>
            </div>
          </section>
          <section className="carte">
            <div className="carte__corps">
              <h2>Ingrédients</h2>
              {facteur !== 1 && (
                <p className="champ__aide">Quantités ajustées pour {ecrireQuantite(nb)} portion{nb > 1 ? 's' : ''} (recette originale : {ecrireQuantite(recette.portions)}).</p>
              )}
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
                        <span>{ajusterIngredient(i.texte, facteur)}</span>
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
                        {i.kcal != null && <span className="recette__ingredient-kcal">{Math.round(i.kcal * facteur)} kcal</span>}
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

      <Modale titre="Ajouter à mes repas" ouverte={!!mange} onFermer={() => setMange(null)}>
        {mange && (
          <form className="formulaire" onSubmit={ajouterAuJournal}>
            <div className="formulaire__ligne">
              <label className="champ">
                <span className="champ__libelle">Jour</span>
                <input className="champ__saisie" type="date" required value={mange.jour} onChange={(e) => setMange({ ...mange, jour: e.target.value })} />
              </label>
              <label className="champ">
                <span className="champ__libelle">Repas</span>
                <select className="champ__saisie" value={mange.moment} onChange={(e) => setMange({ ...mange, moment: e.target.value })}>
                  {MOMENTS.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
                </select>
              </label>
              <label className="champ">
                <span className="champ__libelle">Portions mangées</span>
                <input className="champ__saisie" inputMode="decimal" value={mange.portions} onChange={(e) => setMange({ ...mange, portions: e.target.value })} />
              </label>
            </div>
            {recette.kcal != null && (
              <p className="journal__apercu">{nombreFr(recette.kcal * (versNombre(mange.portions) || 1))} kcal</p>
            )}
            <div className="formulaire__actions">
              <button type="submit" className="bouton bouton--principal">
                <Utensils size={16} aria-hidden="true" />
                Ajouter à mes calories
              </button>
            </div>
          </form>
        )}
      </Modale>

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
