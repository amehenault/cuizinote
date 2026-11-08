'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { api } from '@/lib/client';
import { ajouterJours, depuisIso, enLb, formaterJour, nombreFr, versIso } from '@/lib/dates';
import { Message } from './Elements';
import { GraphiqueBarres } from './Graphiques';

// Ordre d'affichage lundi -> dimanche ; valeur = getDay() (0 = dimanche).
const JOURS = [
  [1, 'Lun'],
  [2, 'Mar'],
  [3, 'Mer'],
  [4, 'Jeu'],
  [5, 'Ven'],
  [6, 'Sam'],
  [0, 'Dim'],
];
const SEMAINES_HISTORIQUE = 8;

/** Premier jour de la période qui contient la date, pour une semaine commençant le jour « debut » (0-6). */
function debutPeriode(iso, debut) {
  return ajouterJours(iso, -((depuisIso(iso).getDay() - debut + 7) % 7));
}

const court = (iso) => formaterJour(iso, { weekday: 'short', day: 'numeric', month: 'short' });
const signe = (n) => (n > 0 ? `+${nombreFr(n)}` : nombreFr(n));
const lb = (kg) => `${nombreFr(enLb(kg), 1)} lb`;

/** Liste des jours (AAAA-MM-JJ) de debut à fin inclus. */
function joursEntre(debut, fin) {
  const liste = [];
  for (let j = debut; j <= fin && liste.length < 401; j = ajouterJours(j, 1)) liste.push(j);
  return liste;
}

/**
 * Résumé d'une période : total, moyenne sur les jours saisis, écart à l'objectif sur ces jours,
 * pesée de début (première de la période) et pesée de fin (première après la période, sinon dernière de la période).
 */
function resumer(debut, fin, parJour, poids, objectif) {
  const aujourdhui = versIso();
  const jours = joursEntre(debut, fin).map((jour) => ({ jour, kcal: parJour.get(jour)?.kcal ?? 0, saisi: parJour.has(jour), futur: jour > aujourdhui }));
  const saisis = jours.filter((j) => j.saisi && j.kcal > 0);
  const total = saisis.reduce((s, j) => s + j.kcal, 0);
  const moyenne = saisis.length ? total / saisis.length : null;
  const ecart = objectif && saisis.length ? total - objectif * saisis.length : null;
  const dans = (p, a, b) => p.jour >= a && p.jour <= b;
  const pesees = poids.filter((p) => dans(p, debut, fin));
  const poidsDebut = pesees[0] || null;
  const apres = poids.find((p) => dans(p, ajouterJours(fin, 1), ajouterJours(fin, 7)));
  const poidsFin = apres || (pesees.length > 1 ? pesees[pesees.length - 1] : null);
  return {
    debut,
    fin,
    jours,
    total,
    moyenne,
    ecart,
    nbSaisis: saisis.length,
    nbJours: jours.filter((j) => !j.futur).length,
    poidsDebut,
    poidsFin,
    variation: poidsDebut && poidsFin ? poidsFin.poids_kg - poidsDebut.poids_kg : null,
  };
}

/** Récapitulatif des calories par semaine (jour de début au choix, ex. : mardi -> lundi) ou sur des dates choisies. */
export default function RecapCalories() {
  const [debutSemaine, setDebutSemaine] = useState(null);
  const [ancre, setAncre] = useState(null); // premier jour de la semaine affichée
  const [perso, setPerso] = useState(null); // { debut, fin } en mode « dates personnalisées »
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  // Préférence enregistrée dans le compte : lue au premier chargement (semaine courante).
  useEffect(() => {
    const aujourdhui = versIso();
    api(`/api/sante/calories?debut=${aujourdhui}&fin=${aujourdhui}`)
      .then((d) => {
        setDebutSemaine(d.debut_semaine);
        setAncre(debutPeriode(aujourdhui, d.debut_semaine));
      })
      .catch((e) => setErreur(e.message));
  }, []);

  const plage = useMemo(() => {
    if (perso) return perso.debut && perso.fin && perso.fin >= perso.debut ? perso : null;
    if (!ancre) return null;
    return { debut: ajouterJours(ancre, -7 * (SEMAINES_HISTORIQUE - 1)), fin: ajouterJours(ancre, 6) };
  }, [ancre, perso]);

  useEffect(() => {
    if (!plage) return;
    setErreur('');
    api(`/api/sante/calories?debut=${plage.debut}&fin=${plage.fin}`)
      .then(setDonnees)
      .catch((e) => setErreur(e.message));
  }, [plage]);

  async function choisirDebut(jour) {
    setDebutSemaine(jour);
    setAncre(debutPeriode(ancre || versIso(), jour));
    setPerso(null);
    await api('/api/sante/calories', { methode: 'PUT', corps: { debut_semaine: jour } }).catch((e) => setErreur(e.message));
  }

  const resumes = useMemo(() => {
    if (!donnees || !plage) return null;
    const parJour = new Map(donnees.jours.map((j) => [j.jour, j]));
    const poids = donnees.poids.map((p) => ({ ...p, jour: versIso(new Date(p.mesure_le)) }));
    if (perso) return { principal: resumer(plage.debut, plage.fin, parJour, poids, donnees.objectif), historique: [] };
    const historique = Array.from({ length: SEMAINES_HISTORIQUE }, (_, i) => {
      const debut = ajouterJours(ancre, -7 * i);
      return resumer(debut, ajouterJours(debut, 6), parJour, poids, donnees.objectif);
    });
    return { principal: historique[0], historique };
  }, [donnees, plage, perso, ancre]);

  if (debutSemaine == null) return <Message type="erreur">{erreur}</Message>;

  const r = resumes?.principal;
  const objectif = donnees?.objectif;
  const estSemaineCourante = !perso && ancre === debutPeriode(versIso(), debutSemaine);

  return (
    <section className="carte">
      <div className="carte__entete">
        <h2 className="carte__titre">
          <Flame size={18} aria-hidden="true" />
          Récapitulatif des calories
        </h2>
      </div>
      <div className="carte__corps pile">
        <div className="recap__reglages">
          <span className="champ__libelle">Ma semaine commence le</span>
          <div className="recap__jours" role="radiogroup" aria-label="Premier jour de la semaine">
            {JOURS.map(([v, nom]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={!perso && debutSemaine === v}
                className={`etiquette etiquette--bouton${!perso && debutSemaine === v ? ' etiquette--active' : ' etiquette--neutre'}`}
                onClick={() => choisirDebut(v)}
              >
                {nom}
              </button>
            ))}
          </div>
        </div>

        {perso ? (
          <div className="recap__navigation">
            <label className="champ">
              <span className="champ__libelle">Du</span>
              <input className="champ__saisie champ__saisie--court" type="date" value={perso.debut} max={perso.fin} onChange={(e) => setPerso({ ...perso, debut: e.target.value })} />
            </label>
            <label className="champ">
              <span className="champ__libelle">Au</span>
              <input className="champ__saisie champ__saisie--court" type="date" value={perso.fin} min={perso.debut} onChange={(e) => setPerso({ ...perso, fin: e.target.value })} />
            </label>
            <button type="button" className="bouton bouton--fantome" onClick={() => setPerso(null)}>
              Revenir aux semaines
            </button>
          </div>
        ) : (
          <div className="recap__navigation">
            <button type="button" className="bouton bouton--secondaire bouton--icone" onClick={() => setAncre(ajouterJours(ancre, -7))} aria-label="Semaine précédente">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <p className="recap__periode">
              {court(ancre)} au {court(ajouterJours(ancre, 6))}
              {estSemaineCourante && <span className="etiquette">Cette semaine</span>}
            </p>
            <button
              type="button"
              className="bouton bouton--secondaire bouton--icone"
              onClick={() => setAncre(ajouterJours(ancre, 7))}
              disabled={estSemaineCourante}
              aria-label="Semaine suivante"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            {!estSemaineCourante && (
              <button type="button" className="bouton bouton--fantome bouton--petit" onClick={() => setAncre(debutPeriode(versIso(), debutSemaine))}>
                Cette semaine
              </button>
            )}
            <button
              type="button"
              className="bouton bouton--fantome bouton--petit"
              onClick={() => setPerso({ debut: ancre, fin: ajouterJours(ancre, 6) < versIso() ? ajouterJours(ancre, 6) : versIso() })}
            >
              <CalendarRange size={14} aria-hidden="true" />
              Dates personnalisées
            </button>
          </div>
        )}

        <Message type="erreur">{erreur}</Message>

        {r && (
          <>
            <div className="grille grille--stats">
              <div className="stat">
                <span className="stat__libelle">Total</span>
                <span className="stat__valeur">{nombreFr(r.total)}</span>
                <span className="stat__note">kcal · {r.nbSaisis} jour{r.nbSaisis > 1 ? 's' : ''} saisi{r.nbSaisis > 1 ? 's' : ''} sur {r.nbJours}</span>
              </div>
              <div className="stat">
                <span className="stat__libelle">Moyenne par jour</span>
                <span className="stat__valeur">{r.moyenne != null ? nombreFr(r.moyenne) : '-'}</span>
                <span className="stat__note">{objectif ? `objectif : ${nombreFr(objectif)} kcal` : 'kcal (jours saisis)'}</span>
              </div>
              <div className="stat">
                <span className="stat__libelle">Écart à l&apos;objectif</span>
                <span className="stat__valeur">{r.ecart != null ? signe(r.ecart) : '-'}</span>
                <span className="stat__note">{r.ecart != null ? (r.ecart > 0 ? 'kcal au-dessus' : 'kcal en dessous') : 'objectif non défini'}</span>
              </div>
              <div className="stat">
                <span className="stat__libelle">Poids</span>
                <span className="stat__valeur">{r.variation != null ? `${r.variation > 0 ? '+' : ''}${nombreFr(enLb(r.variation), 1)} lb` : r.poidsDebut ? lb(r.poidsDebut.poids_kg) : '-'}</span>
                <span className="stat__note">
                  {r.poidsDebut
                    ? `${lb(r.poidsDebut.poids_kg)} (${court(r.poidsDebut.jour)})${r.poidsFin ? ` → ${lb(r.poidsFin.poids_kg)} (${court(r.poidsFin.jour)})` : ''}`
                    : 'Aucune pesée'}
                </span>
              </div>
            </div>

            {r.jours.length <= 62 && r.nbSaisis > 0 && (
              <GraphiqueBarres points={r.jours.filter((j) => !j.futur).map((j) => ({ x: j.jour, y: j.kcal }))} unite="kcal" libelle="Calories par jour" objectif={objectif || 0} />
            )}
            {r.jours.length <= 62 && r.nbSaisis > 0 && objectif > 0 && <p className="champ__aide">Ligne pointillée : objectif de {nombreFr(objectif)} kcal.</p>}

            {r.jours.length <= 14 && (
              <table className="tableau">
                <thead>
                  <tr>
                    <th className="tableau__cellule tableau__cellule--entete">Jour</th>
                    <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">kcal</th>
                    {objectif > 0 && <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Écart</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.jours.map((j) => (
                    <tr key={j.jour} className={j.futur ? 'recap__futur' : undefined}>
                      <td className="tableau__cellule">{formaterJour(j.jour, { weekday: 'long', day: 'numeric', month: 'short' })}</td>
                      <td className="tableau__cellule tableau__cellule--nombre">{j.saisi ? nombreFr(j.kcal) : '-'}</td>
                      {objectif > 0 && (
                        <td className="tableau__cellule tableau__cellule--nombre">{j.saisi && j.kcal > 0 ? signe(j.kcal - objectif) : ''}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {resumes?.historique.length > 1 && (
          <details className="recap__historique" open>
            <summary className="champ__aide">Semaines précédentes</summary>
            <div className="recap__defilement">
              <table className="tableau">
                <thead>
                  <tr>
                    <th className="tableau__cellule tableau__cellule--entete">Semaine</th>
                    <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Moy./jour</th>
                    <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Écart</th>
                    <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Poids</th>
                  </tr>
                </thead>
                <tbody>
                  {resumes.historique.slice(1).map((s) => (
                    <tr key={s.debut}>
                      <td className="tableau__cellule">
                        <button type="button" className="recap__lien" onClick={() => setAncre(s.debut)}>
                          {formaterJour(s.debut, { day: 'numeric', month: 'short' })} – {formaterJour(s.fin, { day: 'numeric', month: 'short' })}
                        </button>
                      </td>
                      <td className="tableau__cellule tableau__cellule--nombre">{s.moyenne != null ? nombreFr(s.moyenne) : '-'}</td>
                      <td className="tableau__cellule tableau__cellule--nombre">{s.ecart != null ? signe(s.ecart) : '-'}</td>
                      <td className="tableau__cellule tableau__cellule--nombre">
                        {s.variation != null ? `${s.variation > 0 ? '+' : ''}${nombreFr(enLb(s.variation), 1)} lb` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
