'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookmarkPlus, CalendarPlus, Check, Clock, Flame, Send, Sparkles } from 'lucide-react';
import { api } from '@/lib/client';
import { formaterEtiquette } from '@/lib/etiquettes';
import { EMPLACEMENTS, MOMENTS, ajouterJours, debutSemaine, formaterJour, versIso } from '@/lib/dates';
import { Chargement, EntetePage, Message } from '@/components/Elements';

const EXEMPLES = [
  'Que puis-je cuisiner ce soir avec ce que j\'ai ?',
  'Une idée de souper riche en protéines, moins de 500 kcal',
  'Une collation rapide avec ce qui va bientôt expirer',
  'Un repas à préparer d\'avance pour mes lunchs de la semaine',
];

function Proposition({ recette, semaine }) {
  const [etat, setEtat] = useState({ enregistree: null, erreur: '', envoi: false });
  const jours = semaine ? Array.from({ length: 7 }, (_, n) => ajouterJours(semaine, n)) : [];
  const [planif, setPlanif] = useState(() => ({
    jour: jours.includes(versIso()) ? versIso() : jours[0],
    moment: (recette.etiquettes || []).find((e) => MOMENTS.some((m) => m.valeur === e)) || 'souper',
    fait: false,
  }));

  /** Enregistre la recette (une seule fois) et retourne son identifiant. */
  async function enregistrer() {
    if (etat.enregistree) return etat.enregistree;
    setEtat({ ...etat, envoi: true, erreur: '' });
    try {
      const { id } = await api('/api/recettes', {
        methode: 'POST',
        corps: {
          titre: recette.titre,
          description: recette.description,
          portions: recette.portions,
          temps_preparation: recette.temps_preparation != null ? Math.round(recette.temps_preparation) : null,
          temps_cuisson: recette.temps_cuisson != null ? Math.round(recette.temps_cuisson) : null,
          etapes: recette.etapes,
          ingredients: recette.ingredients.map((texte) => ({ texte })),
          kcal_portion: recette.kcal_portion,
          proteines_portion: recette.proteines_portion,
          glucides_portion: recette.glucides_portion,
          lipides_portion: recette.lipides_portion,
          etiquettes: [...recette.etiquettes, 'idée ia'],
        },
      });
      setEtat({ enregistree: id, erreur: '', envoi: false });
      return id;
    } catch (e) {
      setEtat({ enregistree: null, erreur: e.message, envoi: false });
      return null;
    }
  }

  async function planifier() {
    const id = await enregistrer();
    if (!id) return;
    try {
      await api('/api/planificateur', {
        methode: 'POST',
        corps: { jour: planif.jour, moment: planif.moment, recette_id: id, portions: 1 },
      });
      setPlanif((p) => ({ ...p, fait: true }));
    } catch (e) {
      setEtat((x) => ({ ...x, erreur: e.message }));
    }
  }

  const temps = (recette.temps_preparation || 0) + (recette.temps_cuisson || 0);

  return (
    <article className="carte">
      <div className="carte__corps">
        <h3>{recette.titre}</h3>
        {recette.description && <p className="champ__aide">{recette.description}</p>}
        <div className="carte-recette__meta">
          {recette.kcal_portion != null && <span className="carte-recette__info"><Flame size={14} aria-hidden="true" />environ {Math.round(recette.kcal_portion)} kcal/portion</span>}
          {temps > 0 && <span className="carte-recette__info"><Clock size={14} aria-hidden="true" />{temps} min</span>}
        </div>
        {recette.etiquettes.length > 0 && (
          <div className="carte-recette__etiquettes">
            {recette.etiquettes.map((e) => <span key={e} className="etiquette">{formaterEtiquette(e)}</span>)}
          </div>
        )}
        <details>
          <summary>Ingrédients et étapes</summary>
          <ul className="assistant__liste">{recette.ingredients.map((i, n) => <li key={n}>{i}</li>)}</ul>
          <ol className="assistant__liste">{recette.etapes.map((e, n) => <li key={n}>{e}</li>)}</ol>
        </details>
        {recette.manquants.length > 0 && (
          <p className="champ__aide">À acheter : {recette.manquants.join(', ')}</p>
        )}
        <Message type="erreur">{etat.erreur}</Message>
        {semaine &&
          (planif.fait ? (
            <Message type="succes">
              Ajoutée au planificateur : {MOMENTS.find((m) => m.valeur === planif.moment)?.libelle.toLowerCase()}, {formaterJour(planif.jour)}.
            </Message>
          ) : (
            <div className="rangee">
              <select className="champ__saisie champ__saisie--court" value={planif.jour} onChange={(e) => setPlanif({ ...planif, jour: e.target.value })} aria-label="Jour">
                {jours.map((j) => <option key={j} value={j}>{formaterJour(j, { weekday: 'long', day: 'numeric' })}</option>)}
              </select>
              <select className="champ__saisie champ__saisie--court" value={planif.moment} onChange={(e) => setPlanif({ ...planif, moment: e.target.value })} aria-label="Repas">
                {MOMENTS.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
              </select>
              <button type="button" className="bouton bouton--principal" onClick={planifier} disabled={etat.envoi}>
                <CalendarPlus size={16} aria-hidden="true" />
                Planifier
              </button>
            </div>
          ))}
        {etat.enregistree ? (
          <Link href={`/recettes/${etat.enregistree}`} className="bouton bouton--secondaire">
            <Check size={16} aria-hidden="true" />
            Ajoutée - voir la recette
          </Link>
        ) : (
          <button type="button" className={`bouton ${semaine ? 'bouton--secondaire' : 'bouton--principal'}`} onClick={enregistrer} disabled={etat.envoi}>
            <BookmarkPlus size={16} aria-hidden="true" />
            {etat.envoi ? 'Ajout...' : 'Ajouter à mes recettes'}
          </button>
        )}
      </div>
    </article>
  );
}

export default function PageAssistant({ searchParams }) {
  // ?semaine=AAAA-MM-JJ (depuis le planificateur) : chaque idée peut être planifiée directement.
  const params = use(searchParams);
  const semaine = /^\d{4}-\d{2}-\d{2}$/.test(params?.semaine || '') ? debutSemaine(params.semaine) : null;
  // La conversation vit uniquement en mémoire : elle disparaît en quittant la page.
  const [fil, setFil] = useState([]);
  const [demande, setDemande] = useState('');
  const [emplacements, setEmplacements] = useState(['frigo', 'congelateur', 'garde-manger']);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  async function envoyer(texte) {
    const question = (texte ?? demande).trim();
    if (!question || envoi) return;
    setErreur('');
    setEnvoi(true);
    setDemande('');
    const historique = fil.slice(-6).map((m) => ({ role: m.role, content: m.texte.slice(0, 4000) }));
    setFil((f) => [...f, { role: 'user', texte: question }]);
    try {
      const reponse = await api('/api/assistant', { methode: 'POST', corps: { demande: question, emplacements, historique } });
      const resume = [reponse.message, ...reponse.recettes.map((r) => `- ${r.titre}`)].filter(Boolean).join('\n');
      setFil((f) => [...f, { role: 'assistant', texte: resume || 'Voici mes idées.', message: reponse.message, recettes: reponse.recettes }]);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const basculer = (v) => setEmplacements((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));

  return (
    <div className="assistant">
      <EntetePage
        titre="Assistant culinaire"
        sousTitre={
          semaine
            ? `Semaine du ${formaterJour(semaine, { day: 'numeric', month: 'long' })} : touchez « Planifier » sous une idée pour l'ajouter.`
            : 'Des idées de repas à partir de ce que vous avez sous la main'
        }
      >
        {semaine && (
          <Link href={`/planificateur?semaine=${semaine}`} className="bouton bouton--secondaire">
            <ArrowLeft size={16} aria-hidden="true" />
            Retour à la semaine
          </Link>
        )}
      </EntetePage>

      {fil.length === 0 && (
        <div className="carte carte--accent">
          <div className="carte__corps">
            <h2 className="carte__titre"><Sparkles size={18} aria-hidden="true" />Par où commencer ?</h2>
            <div className="filtres__etiquettes">
              {EXEMPLES.map((e) => (
                <button key={e} type="button" className="etiquette etiquette--bouton assistant__exemple" onClick={() => envoyer(e)}>{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="assistant__fil" aria-live="polite">
        {fil.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="assistant__bulle assistant__bulle--utilisateur">{m.texte}</p>
          ) : (
            <div key={i} className="pile">
              {m.message && <p className="assistant__bulle assistant__bulle--ia">{m.message}</p>}
              <div className="assistant__propositions">
                {m.recettes.map((r, n) => <Proposition key={n} recette={r} semaine={semaine} />)}
              </div>
            </div>
          )
        )}
        {envoi && <Chargement texte="L'assistant réfléchit..." />}
        <Message type="erreur">{erreur}</Message>
      </div>

      <form className="assistant__saisie" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
        <div className="rangee">
          <span className="champ__aide">Utiliser mon inventaire :</span>
          {EMPLACEMENTS.map((e) => (
            <button
              key={e.valeur}
              type="button"
              className={`etiquette etiquette--bouton${emplacements.includes(e.valeur) ? ' etiquette--active' : ' etiquette--neutre'}`}
              aria-pressed={emplacements.includes(e.valeur)}
              onClick={() => basculer(e.valeur)}
            >
              {e.libelle}
            </button>
          ))}
        </div>
        <div className="rangee">
          <input
            className="champ__saisie importeur__champ"
            placeholder="Ex. : un souper au poulet en moins de 30 minutes"
            value={demande}
            maxLength={1000}
            onChange={(e) => setDemande(e.target.value)}
            aria-label="Votre demande"
          />
          <button type="submit" className="bouton bouton--principal" disabled={envoi || !demande.trim()}>
            <Send size={16} aria-hidden="true" />
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
