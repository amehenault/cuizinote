'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { MOMENTS, formaterJour, nombreFr, versIso } from '@/lib/dates';
import { Chargement, Message, Modale, versNombre } from './Elements';
import FormulaireRepas from './FormulaireRepas';
import { quantiteEnPortions } from '@/lib/portion';

function ModifierEntree({ entree, onFait }) {
  const [kcal, setKcal] = useState(entree.kcal == null ? '' : String(entree.kcal));
  const [moment, setMoment] = useState(entree.moment);
  const [erreur, setErreur] = useState('');

  async function enregistrer(e) {
    e.preventDefault();
    try {
      const n = versNombre(kcal);
      await api(`/api/journal/${entree.id}`, { methode: 'PATCH', corps: { kcal: n == null ? null : Math.round(n), moment } });
      onFait();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer() {
    try {
      await api(`/api/journal/${entree.id}`, { methode: 'DELETE' });
      onFait();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <form className="formulaire" onSubmit={enregistrer}>
      <p className="liste__titre">{entree.libelle}</p>
      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Calories (kcal)</span>
          <input className="champ__saisie" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__libelle">Catégorie</span>
          <select className="champ__saisie" value={moment} onChange={(e) => setMoment(e.target.value)}>
            {MOMENTS.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
          </select>
        </label>
      </div>
      <Message type="erreur">{erreur}</Message>
      <div className="formulaire__actions">
        <button type="button" className="bouton bouton--fantome" onClick={supprimer}>
          <Trash2 size={16} aria-hidden="true" />
          Retirer
        </button>
        <button type="submit" className="bouton bouton--principal">
          <Save size={16} aria-hidden="true" />
          Enregistrer
        </button>
      </div>
    </form>
  );
}

/** Calories mangées dans la journée, par catégorie, avec total et objectif. */
export default function JournalJour({ jour, objectif }) {
  const [entrees, setEntrees] = useState(null);
  const [ajout, setAjout] = useState(null);
  const [edition, setEdition] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(() => {
    api(`/api/journal?jour=${jour}`).then(setEntrees).catch((e) => setErreur(e.message));
  }, [jour]);

  useEffect(() => {
    charger();
  }, [charger]);

  function apresChangement() {
    setAjout(null);
    setEdition(null);
    charger();
  }

  if (erreur) return <Message type="erreur">{erreur}</Message>;
  if (!entrees) return <Chargement />;

  const total = entrees.reduce((s, e) => s + (e.kcal || 0), 0);
  const depassement = objectif ? total - objectif : null;
  const libelleJour = jour === versIso() ? "aujourd'hui" : `le ${formaterJour(jour, { day: 'numeric', month: 'long' })}`;

  return (
    <section className="carte journal">
      {MOMENTS.map((m) => {
        const liste = entrees.filter((e) => e.moment === m.valeur);
        const sousTotal = liste.reduce((s, e) => s + (e.kcal || 0), 0);
        return (
          <div key={m.valeur} className="journal__section">
            <div className="journal__entete">
              <h3 className="journal__titre">{m.libelle}</h3>
              <span className="journal__kcal">{nombreFr(sousTotal)} kcal</span>
              <button
                type="button"
                className="journal__ajouter"
                onClick={() => setAjout(m.valeur)}
                aria-label={`Ajouter au ${m.libelle.toLowerCase()}`}
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            {liste.length > 0 && (
              <ul className="journal__liste">
                {liste.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="journal__entree" onClick={() => setEdition(e)}>
                      <span className="journal__nom">
                        {e.libelle}
                        {e.aliment_id && e.portion_g && (e.grammes == null || e.grammes === e.portion_g) ? (
                          <span className="journal__detail"> · {quantiteEnPortions(e.portions, e)}</span>
                        ) : (
                          <>
                            {e.portions !== 1 && <span className="journal__detail"> x {nombreFr(e.portions, 2)}</span>}
                            {e.grammes != null && <span className="journal__detail"> · {nombreFr(e.grammes)} {e.unite}</span>}
                          </>
                        )}
                      </span>
                      <span className="journal__valeur">{e.kcal != null ? `${nombreFr(e.kcal)} kcal` : 'kcal ?'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="journal__total">
        <div className="rangee rangee--espacee">
          <span className="journal__titre">Total de la journée</span>
          <span className="journal__total-valeur">
            {nombreFr(total)}{objectif ? ` / ${nombreFr(objectif)}` : ''} kcal
          </span>
        </div>
        {objectif > 0 && (
          <div className="jauge">
            <div className={`jauge__remplissage${depassement > 0 ? ' jauge__remplissage--depasse' : ''}`} style={{ width: `${Math.min(100, (total / objectif) * 100)}%` }} />
          </div>
        )}
        {depassement > 0 && (
          <Message type="alerte">Vous dépassez votre objectif de {nombreFr(depassement)} kcal {libelleJour}.</Message>
        )}
        {depassement != null && depassement <= 0 && total > 0 && (
          <p className="champ__aide">Il vous reste {nombreFr(-depassement)} kcal {libelleJour}.</p>
        )}
        {!objectif && (
          <p className="champ__aide">
            <Link href="/parametres">Définissez votre objectif calorique</Link> pour être averti en cas de dépassement.
          </p>
        )}
      </div>

      <Modale
        titre={ajout ? `Ajouter - ${MOMENTS.find((x) => x.valeur === ajout)?.libelle}` : ''}
        ouverte={!!ajout}
        onFermer={() => setAjout(null)}
      >
        {ajout && <FormulaireRepas key={ajout} cible="journal" jour={jour} moment={ajout} onEnregistre={apresChangement} />}
      </Modale>
      <Modale titre="Modifier" ouverte={!!edition} onFermer={() => setEdition(null)}>
        {edition && <ModifierEntree key={edition.id} entree={edition} onFait={apresChangement} />}
      </Modale>
    </section>
  );
}
