'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Circle, CalendarDays, ListChecks, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { MOMENTS, ajouterJours, debutSemaine, formaterJour, nombreFr, versIso } from '@/lib/dates';
import { EntetePage, Message, Modale, versNombre } from '@/components/Elements';
import RechercheAliment from '@/components/RechercheAliment';

function FormulaireRepas({ jour, moment, recettes, onEnregistre }) {
  const [type, setType] = useState('recette');
  const [filtre, setFiltre] = useState('');
  const [recetteId, setRecetteId] = useState('');
  const [aliment, setAliment] = useState(null);
  const [libelle, setLibelle] = useState('');
  const [portions, setPortions] = useState('1');
  const [grammes, setGrammes] = useState('');
  const [m, setM] = useState(moment);
  const [erreur, setErreur] = useState('');

  const options = recettes.filter((r) => r.titre.toLowerCase().includes(filtre.toLowerCase())).slice(0, 50);

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    const corps = { jour, moment: m, portions: versNombre(portions) || 1 };
    if (type === 'recette') corps.recette_id = recetteId || null;
    if (type === 'aliment') {
      corps.aliment_id = aliment?.id || null;
      corps.grammes = versNombre(grammes);
    }
    if (type === 'libre') corps.libelle = libelle;
    try {
      await api('/api/planificateur', { methode: 'POST', corps });
      onEnregistre();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <form className="formulaire" onSubmit={soumettre}>
      <div className="onglets" role="tablist">
        {[['recette', 'Recette'], ['aliment', 'Aliment'], ['libre', 'Repas libre']].map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={type === v} className={`onglets__bouton${type === v ? ' onglets__bouton--actif' : ''}`} onClick={() => setType(v)}>
            {l}
          </button>
        ))}
      </div>
      <label className="champ">
        <span className="champ__libelle">Repas</span>
        <select className="champ__saisie" value={m} onChange={(e) => setM(e.target.value)}>
          {MOMENTS.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
        </select>
      </label>

      {type === 'recette' && (
        <div className="pile pile--serre">
          <input className="champ__saisie" placeholder="Filtrer les recettes" value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer les recettes" />
          <select className="champ__saisie" size={Math.min(8, Math.max(3, options.length))} required value={recetteId} onChange={(e) => setRecetteId(e.target.value)} aria-label="Recette">
            {options.map((r) => (
              <option key={r.id} value={r.id}>{r.titre}{r.kcal != null ? ` (${Math.round(r.kcal)} kcal/portion)` : ''}</option>
            ))}
          </select>
          {recettes.length === 0 && <p className="champ__aide">Aucune recette. <Link href="/recettes/nouvelle">Créer une recette</Link></p>}
        </div>
      )}

      {type === 'aliment' && (
        <div className="pile pile--serre">
          {aliment ? (
            <div className="editeur-lignes__lie">
              <span>{aliment.nom}{aliment.kcal_100g != null ? ` - ${Math.round(aliment.kcal_100g)} kcal/100 g` : ''}</span>
              <button type="button" className="etiquette__retirer" onClick={() => setAliment(null)}>Changer</button>
            </div>
          ) : (
            <RechercheAliment onChoisir={(a) => { setAliment(a); setGrammes(a.portion_g ? String(a.portion_g) : '100'); }} />
          )}
          <label className="champ">
            <span className="champ__libelle">Grammes par portion</span>
            <input className="champ__saisie" inputMode="decimal" value={grammes} onChange={(e) => setGrammes(e.target.value)} />
          </label>
        </div>
      )}

      {type === 'libre' && (
        <label className="champ">
          <span className="champ__libelle">Description</span>
          <input className="champ__saisie" required maxLength={200} placeholder="Ex. : restaurant, restes..." value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        </label>
      )}

      <label className="champ">
        <span className="champ__libelle">Portions</span>
        <input className="champ__saisie" inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} />
      </label>
      <Message type="erreur">{erreur}</Message>
      <div className="formulaire__actions">
        <button type="submit" className="bouton bouton--principal">
          <Plus size={16} aria-hidden="true" />
          Ajouter
        </button>
      </div>
    </form>
  );
}

export default function PagePlanificateur() {
  const [debut, setDebut] = useState(() => debutSemaine());
  const [repas, setRepas] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [objectif, setObjectif] = useState(null);
  const [ajout, setAjout] = useState(null);
  const [message, setMessage] = useState({ type: 'info', texte: '' });

  const fin = ajouterJours(debut, 6);
  const aujourdhui = versIso();
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i)), [debut]);

  const charger = useCallback(() => {
    api(`/api/planificateur?debut=${debut}&fin=${fin}`).then(setRepas).catch((e) => setMessage({ type: 'erreur', texte: e.message }));
  }, [debut, fin]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    api('/api/recettes').then(setRecettes).catch(() => {});
    api('/api/compte').then((u) => setObjectif(u.objectif_kcal)).catch(() => {});
  }, []);

  async function basculer(r) {
    await api(`/api/planificateur/${r.id}`, { methode: 'PATCH', corps: { mange: !r.mange } }).catch(() => {});
    charger();
  }

  async function supprimer(r) {
    await api(`/api/planificateur/${r.id}`, { methode: 'DELETE' }).catch(() => {});
    charger();
  }

  async function genererEpicerie() {
    try {
      const { ajoutes } = await api('/api/epicerie/generer', { methode: 'POST', corps: { debut, fin } });
      setMessage({
        type: 'succes',
        texte: ajoutes ? `${ajoutes} article(s) ajouté(s) à la liste d'épicerie (ce qui est déjà dans l'inventaire est ignoré).` : 'Rien à ajouter : tout est déjà dans votre inventaire ou votre liste.',
      });
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    }
  }

  return (
    <>
      <EntetePage
        titre="Planificateur"
        sousTitre={`Semaine du ${formaterJour(debut, { day: 'numeric', month: 'long' })} au ${formaterJour(fin, { day: 'numeric', month: 'long', year: 'numeric' })}`}
      >
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
        <button type="button" className="bouton bouton--principal" onClick={genererEpicerie}>
          <ShoppingCart size={16} aria-hidden="true" />
          Générer l&apos;épicerie
        </button>
        <Link href="/epicerie" className="bouton bouton--secondaire">
          <ListChecks size={16} aria-hidden="true" />
          Liste d&apos;épicerie
        </Link>
      </EntetePage>

      <Message type={message.type}>{message.texte}</Message>

      <div className="semaine">
        {jours.map((jour) => {
          const duJour = repas.filter((r) => r.jour === jour);
          const total = duJour.reduce((s, r) => s + (r.kcal || 0), 0);
          return (
            <section key={jour} className={`semaine__jour${jour === aujourdhui ? ' semaine__jour--aujourdhui' : ''}`} aria-label={formaterJour(jour)}>
              <div className="semaine__entete">
                <span className="semaine__nom">{formaterJour(jour, { weekday: 'short', day: 'numeric' })}</span>
                <span className="semaine__total">
                  {nombreFr(total)}{objectif ? ` / ${nombreFr(objectif)}` : ''} kcal
                </span>
              </div>
              {objectif > 0 && (
                <div className="jauge" role="img" aria-label={`${Math.round((total / objectif) * 100)} % de l'objectif`}>
                  <div
                    className={`jauge__remplissage${total > objectif ? ' jauge__remplissage--depasse' : ''}`}
                    style={{ width: `${Math.min(100, (total / objectif) * 100)}%` }}
                  />
                </div>
              )}
              {MOMENTS.map((m) => (
                <div key={m.valeur} className="semaine__moment">
                  <div className="semaine__moment-titre">
                    {m.libelle}
                    <button
                      type="button"
                      className="bouton bouton--fantome bouton--icone"
                      onClick={() => setAjout({ jour, moment: m.valeur })}
                      aria-label={`Ajouter au ${m.libelle.toLowerCase()} du ${formaterJour(jour)}`}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  {duJour.filter((r) => r.moment === m.valeur).map((r) => (
                    <div key={r.id} className={`semaine__repas${r.mange ? ' semaine__repas--mange' : ''}`}>
                      <button type="button" className="etiquette__retirer" onClick={() => basculer(r)} aria-label={r.mange ? 'Marquer comme non mangé' : 'Marquer comme mangé'}>
                        {r.mange ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                      </button>
                      {r.recette_id ? (
                        <Link href={`/recettes/${r.recette_id}`} className="semaine__repas-nom">{r.recette_titre}</Link>
                      ) : (
                        <span className="semaine__repas-nom">{r.aliment_nom || r.libelle}</span>
                      )}
                      {r.kcal != null && <span className="semaine__repas-kcal">{nombreFr(r.kcal)}</span>}
                      <button type="button" className="etiquette__retirer" onClick={() => supprimer(r)} aria-label="Retirer ce repas">
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <Modale
        titre={ajout ? `Ajouter un repas - ${formaterJour(ajout.jour)}` : ''}
        ouverte={!!ajout}
        onFermer={() => setAjout(null)}
      >
        {ajout && (
          <FormulaireRepas
            key={`${ajout.jour}-${ajout.moment}`}
            jour={ajout.jour}
            moment={ajout.moment}
            recettes={recettes}
            onEnregistre={() => {
              setAjout(null);
              charger();
            }}
          />
        )}
      </Modale>
    </>
  );
}
