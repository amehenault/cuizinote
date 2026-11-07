'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, Save, Trash2, Utensils } from 'lucide-react';
import { api } from '@/lib/client';
import { MOMENTS, ajouterJours, debutSemaine, formaterJour, nombreFr, versIso } from '@/lib/dates';
import { Message, Modale, versNombre } from './Elements';
import FormulaireRepas from './FormulaireRepas';

/** Fenêtre d'un repas du menu : « Vous venez de le manger ? », modifier, retirer. */
function FicheRepasMenu({ repas, jours, onFait }) {
  const [portions, setPortions] = useState(String(repas.portions));
  const [jour, setJour] = useState(repas.jour);
  const [moment, setMoment] = useState(repas.moment);
  const [erreur, setErreur] = useState('');
  const nom = repas.recette_titre || repas.aliment_nom || repas.libelle;
  const modifie = versNombre(portions) !== repas.portions || jour !== repas.jour || moment !== repas.moment;

  const patch = async (corps) => {
    try {
      await api(`/api/planificateur/${repas.id}`, { methode: 'PATCH', corps });
      onFait();
    } catch (e) {
      setErreur(e.message);
    }
  };

  async function retirer() {
    try {
      await api(`/api/planificateur/${repas.id}`, { methode: 'DELETE' });
      onFait();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div className="pile">
      <div>
        <p className="liste__titre">{nom}</p>
        <p className="journal__apercu">{repas.kcal != null ? `${nombreFr(repas.kcal)} kcal` : 'Calories inconnues'}</p>
      </div>

      {repas.mange ? (
        <Message type="succes">Ce repas est déjà compté dans vos calories mangées.</Message>
      ) : (
        <div className="carte carte--accent">
          <div className="carte__corps">
            <p className="liste__titre">Vous venez de manger ce repas ?</p>
            <button type="button" className="bouton bouton--principal" onClick={() => patch({ mange: true, jour_mange: versIso() })}>
              <Utensils size={16} aria-hidden="true" />
              Oui, ajouter à mes calories d&apos;aujourd&apos;hui
            </button>
          </div>
        </div>
      )}

      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Jour</span>
          <select className="champ__saisie" value={jour} onChange={(e) => setJour(e.target.value)}>
            {jours.map((j) => <option key={j} value={j}>{formaterJour(j, { weekday: 'long', day: 'numeric', month: 'short' })}</option>)}
          </select>
        </label>
        <label className="champ">
          <span className="champ__libelle">Catégorie</span>
          <select className="champ__saisie" value={moment} onChange={(e) => setMoment(e.target.value)}>
            {MOMENTS.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
          </select>
        </label>
        <label className="champ">
          <span className="champ__libelle">Portions</span>
          <input className="champ__saisie" inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} />
        </label>
      </div>
      <Message type="erreur">{erreur}</Message>

      <div className="rangee">
        {modifie && (
          <button type="button" className="bouton bouton--secondaire" onClick={() => patch({ jour, moment, portions: versNombre(portions) || 1 })}>
            <Save size={16} aria-hidden="true" />
            Enregistrer les changements
          </button>
        )}
        {repas.recette_id && (
          <Link href={`/recettes/${repas.recette_id}`} className="bouton bouton--secondaire">
            <BookOpen size={16} aria-hidden="true" />
            Voir la recette
          </Link>
        )}
        {repas.mange && (
          <button type="button" className="bouton bouton--fantome" onClick={() => patch({ mange: false })}>
            Retirer de mes calories
          </button>
        )}
        <button type="button" className="bouton bouton--fantome" onClick={retirer}>
          <Trash2 size={16} aria-hidden="true" />
          Retirer du menu
        </button>
      </div>
    </div>
  );
}

/** Encadré « Menu du jour » (même style que les tuiles Pas et Poids) : évite de défiler jusqu'au bon jour. */
function MenuDuJour({ repas, objectif, onOuvrir, onPlanifier }) {
  const total = repas.reduce((s, r) => s + (r.kcal || 0), 0);
  const moments = MOMENTS.filter((m) => repas.some((r) => r.moment === m.valeur));
  return (
    <section className="stat menu-du-jour" aria-label="Menu du jour">
      <div className="menu-du-jour__entete">
        <span className="stat__libelle"><Utensils size={16} aria-hidden="true" />Menu du jour</span>
        {repas.length > 0 && (
          <span className="stat__note">{nombreFr(total)}{objectif ? ` / ${nombreFr(objectif)}` : ''} kcal</span>
        )}
      </div>
      {repas.length === 0 ? (
        <div className="menu-du-jour__vide">
          <span className="stat__note">Rien de planifié aujourd&apos;hui.</span>
          <button type="button" className="bouton bouton--secondaire bouton--petit" onClick={onPlanifier}>
            <CalendarPlus size={14} aria-hidden="true" />
            Planifier
          </button>
        </div>
      ) : (
        <ul className="menu-du-jour__liste">
          {moments.map((m) => (
            <li key={m.valeur} className="menu-du-jour__moment">
              <span className="menu-du-jour__categorie">{m.libelle}</span>
              {repas.filter((r) => r.moment === m.valeur).map((r) => (
                <div key={r.id} className={`semaine__repas${r.mange ? ' semaine__repas--mange' : ''}`}>
                  <button type="button" className="semaine__repas-nom" onClick={() => onOuvrir(r)}>
                    {r.recette_titre || r.aliment_nom || r.libelle}
                  </button>
                  {r.kcal != null && <span className="semaine__repas-kcal">{nombreFr(r.kcal)}</span>}
                  <button
                    type="button"
                    className={`semaine__manger${r.mange ? ' semaine__manger--fait' : ''}`}
                    onClick={() => onOuvrir(r)}
                    aria-label={r.mange ? 'Déjà mangé' : `J'ai mangé ${r.recette_titre || r.aliment_nom || r.libelle}`}
                    title={r.mange ? 'Déjà mangé' : 'Je viens de le manger'}
                  >
                    {r.mange ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                  </button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Menu de la semaine : 7 jours x 6 catégories, aujourd'hui encadré. */
export default function MenuSemaine({ debutInitial, onChange, onSemaine }) {
  const [debut, setDebut] = useState(() => debutInitial || debutSemaine());
  const [repas, setRepas] = useState([]);
  const [objectif, setObjectif] = useState(null);
  const [ajout, setAjout] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState('');

  const fin = ajouterJours(debut, 6);
  const aujourdhui = versIso();
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i)), [debut]);

  const [repasAujourdhui, setRepasAujourdhui] = useState([]);

  const charger = useCallback(() => {
    api(`/api/planificateur?debut=${debut}&fin=${fin}`).then(setRepas).catch((e) => setErreur(e.message));
    // Le menu du jour reste visible même quand on regarde une autre semaine
    const auj = versIso();
    api(`/api/planificateur?debut=${auj}&fin=${auj}`).then(setRepasAujourdhui).catch(() => {});
  }, [debut, fin]);

  useEffect(() => {
    charger();
    onSemaine?.(debut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charger]);

  useEffect(() => {
    api('/api/compte').then((u) => setObjectif(u.objectif_kcal)).catch(() => {});
  }, []);

  function apresChangement() {
    setAjout(null);
    setFiche(null);
    charger();
    onChange?.();
  }

  return (
    <div className="pile">
      <MenuDuJour
        repas={repasAujourdhui}
        objectif={objectif}
        onOuvrir={setFiche}
        onPlanifier={() => setAjout({ jour: aujourdhui, moment: 'souper' })}
      />
      <div className="rangee rangee--espacee">
        <h2>
          Semaine du {formaterJour(debut, { day: 'numeric', month: 'long' })} au {formaterJour(fin, { day: 'numeric', month: 'long' })}
        </h2>
        <div className="rangee">
          <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => setDebut(ajouterJours(debut, -7))} aria-label="Semaine précédente">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="bouton bouton--secondaire" onClick={() => setDebut(debutSemaine())}>
            <CalendarDays size={16} aria-hidden="true" />
            Cette semaine
          </button>
          <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => setDebut(ajouterJours(debut, 7))} aria-label="Semaine suivante">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <Message type="erreur">{erreur}</Message>

      <div className="semaine">
        {jours.map((jour) => {
          const duJour = repas.filter((r) => r.jour === jour);
          const total = duJour.reduce((s, r) => s + (r.kcal || 0), 0);
          return (
            <section key={jour} className={`semaine__jour${jour === aujourdhui ? ' semaine__jour--aujourdhui' : ''}`} aria-label={formaterJour(jour)}>
              <div className="semaine__entete">
                <span className="semaine__nom">
                  {formaterJour(jour, { weekday: 'short', day: 'numeric' })}
                  {jour === aujourdhui && <span className="etiquette semaine__badge">Aujourd&apos;hui</span>}
                </span>
                <span className="semaine__total">
                  {nombreFr(total)}{objectif ? ` / ${nombreFr(objectif)}` : ''} kcal
                </span>
              </div>
              {objectif > 0 && (
                <div className="jauge" role="img" aria-label={`${Math.round((total / objectif) * 100)} % de l'objectif`}>
                  <div className={`jauge__remplissage${total > objectif ? ' jauge__remplissage--depasse' : ''}`} style={{ width: `${Math.min(100, (total / objectif) * 100)}%` }} />
                </div>
              )}
              {MOMENTS.map((m) => {
                const liste = duJour.filter((r) => r.moment === m.valeur);
                return (
                  <div key={m.valeur} className="semaine__moment">
                    <div className="semaine__moment-titre">
                      {m.libelle}
                      <button
                        type="button"
                        className="bouton bouton--fantome bouton--icone"
                        onClick={() => setAjout({ jour, moment: m.valeur })}
                        aria-label={`Planifier un ${m.libelle.toLowerCase()} le ${formaterJour(jour)}`}
                        title="Planifier"
                      >
                        <CalendarPlus size={14} aria-hidden="true" />
                      </button>
                    </div>
                    {liste.map((r) => (
                      <div key={r.id} className={`semaine__repas${r.mange ? ' semaine__repas--mange' : ''}`}>
                        <button type="button" className="semaine__repas-nom" onClick={() => setFiche(r)}>
                          {r.recette_titre || r.aliment_nom || r.libelle}
                        </button>
                        {r.kcal != null && <span className="semaine__repas-kcal">{nombreFr(r.kcal)}</span>}
                        <button
                          type="button"
                          className={`semaine__manger${r.mange ? ' semaine__manger--fait' : ''}`}
                          onClick={() => setFiche(r)}
                          aria-label={r.mange ? 'Déjà mangé' : `J'ai mangé ${r.recette_titre || r.aliment_nom || r.libelle}`}
                          title={r.mange ? 'Déjà mangé' : 'Je viens de le manger'}
                        >
                          {r.mange ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <Modale titre={ajout ? `Planifier - ${formaterJour(ajout.jour)}` : ''} ouverte={!!ajout} onFermer={() => setAjout(null)}>
        {ajout && <FormulaireRepas key={`${ajout.jour}-${ajout.moment}`} cible="plan" jour={ajout.jour} moment={ajout.moment} onEnregistre={apresChangement} />}
      </Modale>
      <Modale titre="Repas du menu" ouverte={!!fiche} onFermer={() => setFiche(null)}>
        {fiche && <FicheRepasMenu key={fiche.id} repas={fiche} jours={jours} onFait={apresChangement} />}
      </Modale>
    </div>
  );
}
