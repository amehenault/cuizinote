'use client';

import { useEffect, useMemo, useState } from 'react';
import { Beef, CalendarRange, ChevronLeft, ChevronRight, Flame, Scale } from 'lucide-react';
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

const ONGLETS = [
  { id: 'calories', libelle: 'Calories', Icone: Flame },
  { id: 'proteines', libelle: 'Protéines', Icone: Beef },
  { id: 'poids', libelle: 'Poids', Icone: Scale },
];

/** Premier jour de la période qui contient la date, pour une semaine commençant le jour « debut » (0-6). */
function debutPeriode(iso, debut) {
  return ajouterJours(iso, -((depuisIso(iso).getDay() - debut + 7) % 7));
}

const court = (iso) => formaterJour(iso, { weekday: 'short', day: 'numeric', month: 'short' });
const signe = (n) => (n > 0 ? `+${nombreFr(n)}` : nombreFr(n));
const lb = (kg) => `${nombreFr(enLb(kg), 1)} lb`;
const variationLb = (kg) => `${kg > 0 ? '+' : ''}${nombreFr(enLb(kg), 1)} lb`;

/** Liste des jours (AAAA-MM-JJ) de debut à fin inclus. */
function joursEntre(debut, fin) {
  const liste = [];
  for (let j = debut; j <= fin && liste.length < 401; j = ajouterJours(j, 1)) liste.push(j);
  return liste;
}

/**
 * Résumé d'une période : calories et protéines (total, moyenne et écart sur les jours saisis),
 * pesée de début (première de la période) et de fin (première après la période, sinon dernière de la période).
 */
function resumer(debut, fin, parJour, poids, objectif, objectifProteines) {
  const aujourdhui = versIso();
  const jours = joursEntre(debut, fin).map((jour) => {
    const pesees = poids.filter((p) => p.jour === jour);
    return {
      jour,
      kcal: parJour.get(jour)?.kcal ?? 0,
      proteines: parJour.get(jour)?.proteines ?? 0,
      saisi: parJour.has(jour),
      futur: jour > aujourdhui,
      pesee: pesees[pesees.length - 1] || null,
    };
  });
  const saisis = jours.filter((j) => j.saisi && j.kcal > 0);
  const n = saisis.length;
  const total = saisis.reduce((s, j) => s + j.kcal, 0);
  const totalProteines = saisis.reduce((s, j) => s + j.proteines, 0);
  const dans = (p, a, b) => p.jour >= a && p.jour <= b;
  const pesees = poids.filter((p) => dans(p, debut, fin));
  const poidsDebut = pesees[0] || null;
  const apres = poids.find((p) => dans(p, ajouterJours(fin, 1), ajouterJours(fin, 7)));
  const poidsFin = apres || (pesees.length > 1 ? pesees[pesees.length - 1] : null);
  return {
    debut,
    fin,
    jours,
    nbSaisis: n,
    nbJours: jours.filter((j) => !j.futur).length,
    total,
    moyenne: n ? total / n : null,
    ecart: objectif && n ? total - objectif * n : null,
    totalProteines,
    moyenneProteines: n ? totalProteines / n : null,
    ecartProteines: objectifProteines && n ? totalProteines - objectifProteines * n : null,
    poidsDebut,
    poidsFin,
    variation: poidsDebut && poidsFin ? poidsFin.poids_kg - poidsDebut.poids_kg : null,
  };
}

/** Cellule d'écart : rien si le jour n'est pas saisi ou s'il n'y a pas d'objectif. */
function Ecart({ jour, valeur, objectif }) {
  return (
    <td className="tableau__cellule tableau__cellule--nombre">
      {objectif > 0 && jour.saisi && jour.kcal > 0 ? signe(valeur - objectif) : ''}
    </td>
  );
}

/** Historique des semaines pour une mesure (moyenne par jour et écart). */
function Historique({ semaines, onChoisir, colonnes }) {
  return (
    <div className="recap__defilement">
      <table className="tableau">
        <thead>
          <tr>
            <th className="tableau__cellule tableau__cellule--entete">Semaine</th>
            {colonnes.map(([titre]) => (
              <th key={titre} className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">{titre}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semaines.map((s) => (
            <tr key={s.debut}>
              <td className="tableau__cellule">
                <button type="button" className="recap__lien" onClick={() => onChoisir(s.debut)}>
                  {formaterJour(s.debut, { day: 'numeric', month: 'short' })} – {formaterJour(s.fin, { day: 'numeric', month: 'short' })}
                </button>
              </td>
              {colonnes.map(([titre, valeur]) => (
                <td key={titre} className="tableau__cellule tableau__cellule--nombre">{valeur(s)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Récapitulatif santé par semaine (jour de début au choix) ou sur des dates choisies :
 * calories, protéines et poids avec leurs écarts, puis le détail de chacun dans des onglets.
 * ongletPoids : contenu de l'onglet Poids (graphique, saisie et import des pesées).
 */
export default function RecapCalories({ ongletPoids = null, versionPoids = 0 }) {
  const [debutSemaine, setDebutSemaine] = useState(null);
  const [ancre, setAncre] = useState(null); // premier jour de la semaine affichée
  const [perso, setPerso] = useState(null); // { debut, fin } en mode « dates personnalisées »
  const [donnees, setDonnees] = useState(null);
  const [onglet, setOnglet] = useState('calories');
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
  }, [plage, versionPoids]);

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
    const resume = (debut, fin) => resumer(debut, fin, parJour, poids, donnees.objectif, donnees.objectif_proteines);
    if (perso) return { principal: resume(plage.debut, plage.fin), historique: [] };
    const historique = Array.from({ length: SEMAINES_HISTORIQUE }, (_, i) => {
      const debut = ajouterJours(ancre, -7 * i);
      return resume(debut, ajouterJours(debut, 6));
    });
    return { principal: historique[0], historique };
  }, [donnees, plage, perso, ancre]);

  if (debutSemaine == null) return <Message type="erreur">{erreur}</Message>;

  const r = resumes?.principal;
  const objectif = donnees?.objectif;
  const objectifProteines = donnees?.objectif_proteines;
  const estSemaineCourante = !perso && ancre === debutPeriode(versIso(), debutSemaine);
  const semainesPassees = resumes?.historique.slice(1) || [];
  const graphique = r && r.jours.length <= 62 && r.nbSaisis > 0;

  return (
    <>
      <section className="carte">
        <div className="carte__entete">
          <h2 className="carte__titre">
            <CalendarRange size={18} aria-hidden="true" />
            Récapitulatif
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
              <div className="grille grille--stats grille--trois">
                <div className="stat">
                  <span className="stat__libelle"><Flame size={16} aria-hidden="true" />Calories</span>
                  <span className="stat__valeur">{r.moyenne != null ? nombreFr(r.moyenne) : '-'}</span>
                  <span className="stat__note">kcal par jour{objectif ? ` · objectif ${nombreFr(objectif)}` : ''}</span>
                  <span className="stat__note">
                    {r.ecart != null ? `Écart : ${signe(r.ecart)} kcal (${r.ecart > 0 ? 'au-dessus' : 'en dessous'})` : 'Objectif non défini'}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat__libelle"><Beef size={16} aria-hidden="true" />Protéines</span>
                  <span className="stat__valeur">{r.moyenneProteines != null ? `${nombreFr(r.moyenneProteines)} g` : '-'}</span>
                  <span className="stat__note">par jour{objectifProteines ? ` · objectif ${nombreFr(objectifProteines)} g` : ''}</span>
                  <span className="stat__note">
                    {r.ecartProteines != null
                      ? `Écart : ${signe(r.ecartProteines)} g (${r.ecartProteines >= 0 ? 'atteint' : 'manquant'})`
                      : 'Objectif non défini'}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat__libelle"><Scale size={16} aria-hidden="true" />Poids</span>
                  <span className="stat__valeur">{r.variation != null ? variationLb(r.variation) : r.poidsDebut ? lb(r.poidsDebut.poids_kg) : '-'}</span>
                  <span className="stat__note">
                    {r.poidsDebut
                      ? `${lb(r.poidsDebut.poids_kg)} (${court(r.poidsDebut.jour)})${r.poidsFin ? ` → ${lb(r.poidsFin.poids_kg)} (${court(r.poidsFin.jour)})` : ''}`
                      : 'Aucune pesée'}
                  </span>
                </div>
              </div>
              <p className="champ__aide">
                Moyennes et écarts sur les {r.nbSaisis} jour{r.nbSaisis > 1 ? 's' : ''} saisi{r.nbSaisis > 1 ? 's' : ''} sur {r.nbJours}.
              </p>

              {r.jours.length <= 14 && (
                <div className="recap__defilement">
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th className="tableau__cellule tableau__cellule--entete">Jour</th>
                        <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">kcal</th>
                        {objectif > 0 && <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Écart</th>}
                        <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Prot. (g)</th>
                        {objectifProteines > 0 && <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Écart</th>}
                        <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">Poids</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.jours.map((j) => (
                        <tr key={j.jour} className={j.futur ? 'recap__futur' : undefined}>
                          <td className="tableau__cellule">{formaterJour(j.jour, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                          <td className="tableau__cellule tableau__cellule--nombre">{j.saisi ? nombreFr(j.kcal) : '-'}</td>
                          {objectif > 0 && <Ecart jour={j} valeur={j.kcal} objectif={objectif} />}
                          <td className="tableau__cellule tableau__cellule--nombre">{j.saisi ? nombreFr(j.proteines) : '-'}</td>
                          {objectifProteines > 0 && <Ecart jour={j} valeur={j.proteines} objectif={objectifProteines} />}
                          <td className="tableau__cellule tableau__cellule--nombre">{j.pesee ? lb(j.pesee.poids_kg) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="carte">
        <div className="carte__entete">
          <div className="onglets" role="tablist" aria-label="Détail">
            {ONGLETS.map(({ id, libelle, Icone }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={onglet === id}
                className={`onglets__bouton${onglet === id ? ' onglets__bouton--actif' : ''}`}
                onClick={() => setOnglet(id)}
              >
                <Icone size={16} aria-hidden="true" />
                {libelle}
              </button>
            ))}
          </div>
        </div>
        <div className="carte__corps pile">
          {onglet === 'calories' && r && (
            <>
              {graphique ? (
                <GraphiqueBarres points={r.jours.filter((j) => !j.futur).map((j) => ({ x: j.jour, y: j.kcal }))} unite="kcal" libelle="Calories par jour" objectif={objectif || 0} />
              ) : (
                <p className="champ__aide">Aucune calorie saisie sur la période.</p>
              )}
              {graphique && objectif > 0 && <p className="champ__aide">Ligne pointillée : objectif de {nombreFr(objectif)} kcal.</p>}
              {semainesPassees.length > 0 && (
                <Historique
                  semaines={semainesPassees}
                  onChoisir={setAncre}
                  colonnes={[
                    ['Moy./jour', (s) => (s.moyenne != null ? `${nombreFr(s.moyenne)} kcal` : '-')],
                    ['Écart', (s) => (s.ecart != null ? signe(s.ecart) : '-')],
                  ]}
                />
              )}
            </>
          )}

          {onglet === 'proteines' && r && (
            <>
              {graphique ? (
                <GraphiqueBarres points={r.jours.filter((j) => !j.futur).map((j) => ({ x: j.jour, y: j.proteines }))} unite="g" libelle="Protéines par jour" objectif={objectifProteines || 0} />
              ) : (
                <p className="champ__aide">Aucun repas saisi sur la période.</p>
              )}
              {graphique && objectifProteines > 0 && <p className="champ__aide">Ligne pointillée : objectif de {nombreFr(objectifProteines)} g.</p>}
              {semainesPassees.length > 0 && (
                <Historique
                  semaines={semainesPassees}
                  onChoisir={setAncre}
                  colonnes={[
                    ['Moy./jour', (s) => (s.moyenneProteines != null ? `${nombreFr(s.moyenneProteines)} g` : '-')],
                    ['Écart', (s) => (s.ecartProteines != null ? signe(s.ecartProteines) : '-')],
                  ]}
                />
              )}
            </>
          )}

          {onglet === 'poids' && (
            <>
              {ongletPoids}
              {semainesPassees.length > 0 && (
                <Historique
                  semaines={semainesPassees}
                  onChoisir={setAncre}
                  colonnes={[
                    ['Début', (s) => (s.poidsDebut ? lb(s.poidsDebut.poids_kg) : '-')],
                    ['Variation', (s) => (s.variation != null ? variationLb(s.variation) : '-')],
                  ]}
                />
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
