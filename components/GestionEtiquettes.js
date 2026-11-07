'use client';

import { useEffect, useState } from 'react';
import { Pencil, Save, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '@/lib/client';
import { formaterEtiquette } from '@/lib/etiquettes';
import { Message } from './Elements';

const recettes = (n) => `${n} recette${n > 1 ? 's' : ''}`;

/** Paramètres : renommer ou supprimer les étiquettes de recettes. */
export default function GestionEtiquettes() {
  const [etiquettes, setEtiquettes] = useState(null);
  const [edition, setEdition] = useState(null);
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState('');
  const [auto, setAuto] = useState({ enCours: false, message: '' });

  const charger = () => api('/api/etiquettes').then(setEtiquettes).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
  }, []);

  async function supprimer(e) {
    const detail = e.total ? ` Elle sera retirée de ${recettes(e.total)} (les recettes ne sont pas supprimées).` : '';
    if (!window.confirm(`Supprimer l'étiquette « ${e.nom} » ?${detail}`)) return;
    try {
      await api(`/api/etiquettes/${e.id}`, { methode: 'DELETE' });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function etiqueterTout() {
    if (!window.confirm('Recalculer les étiquettes automatiques de toutes vos recettes ? Celles ajoutées à la main sont gardées.')) return;
    const libelle = (n) => `${n} recette${n > 1 ? 's' : ''} étiquetée${n > 1 ? 's' : ''}`;
    setAuto({ enCours: true, message: 'Étiquetage en cours…' });
    let apres = null;
    let total = 0;
    try {
      do {
        const r = await api('/api/etiquettes/automatique', { methode: 'POST', corps: { apres } });
        total += r.etiquetees;
        apres = r.suivant;
        setAuto({ enCours: true, message: `Étiquetage en cours… ${libelle(total)}` });
      } while (apres);
      setAuto({ enCours: false, message: total ? `Terminé : ${libelle(total)}.` : 'Aucune recette à étiqueter.' });
    } catch (err) {
      setAuto({ enCours: false, message: `${total ? `${libelle(total)}, puis : ` : ''}${err.message}` });
    }
    charger();
  }

  async function renommer(ev, e) {
    ev.preventDefault();
    const nouveau = formaterEtiquette(nom);
    if (!nouveau) return;
    const existe = etiquettes.some((x) => x.id !== e.id && x.nom.toLocaleLowerCase('fr-CA') === nouveau.toLocaleLowerCase('fr-CA'));
    if (existe && !window.confirm(`« ${nouveau} » existe déjà. Fusionner les deux étiquettes ?`)) return;
    try {
      await api(`/api/etiquettes/${e.id}`, { methode: 'PUT', corps: { nom: nouveau } });
      setEdition(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="pile">
      <p className="champ__aide">
        Pour créer une étiquette, ajoutez-la dans une recette. Ici, vous pouvez les renommer ou les supprimer.
        Les recettes sont étiquetées automatiquement selon leurs ingrédients, et mises à jour quand vous les modifiez.
        Les étiquettes ajoutées à la main sont toujours gardées.
      </p>
      <div className="rangee">
        <button type="button" className="bouton bouton--secondaire" disabled={auto.enCours} onClick={etiqueterTout}>
          <Sparkles size={16} aria-hidden="true" />
          Recalculer toutes mes recettes
        </button>
      </div>
      {auto.message && <p className="champ__aide" role="status">{auto.message}</p>}
      <Message type="erreur">{erreur}</Message>
      {etiquettes && etiquettes.length === 0 && <p className="champ__aide">Aucune étiquette pour l&apos;instant.</p>}
      {etiquettes && etiquettes.length > 0 && (
        <ul className="liste">
          {etiquettes.map((e) => (
            <li key={e.id} className="liste__element">
              {edition === e.id ? (
                <form className="formulaire" onSubmit={(ev) => renommer(ev, e)}>
                  <div className="formulaire__ligne">
                    <label className="champ">
                      <span className="champ__libelle">Nouveau nom</span>
                      <input className="champ__saisie" required maxLength={40} autoFocus value={nom} onChange={(ev) => setNom(ev.target.value)} />
                    </label>
                  </div>
                  <div className="formulaire__actions">
                    <button type="submit" className="bouton bouton--principal">
                      <Save size={16} aria-hidden="true" />
                      Enregistrer
                    </button>
                    <button type="button" className="bouton bouton--secondaire" onClick={() => setEdition(null)}>
                      <X size={16} aria-hidden="true" />
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="liste__principal">
                    <p className="liste__titre">{e.nom}</p>
                    <p className="liste__detail">{e.total ? recettes(e.total) : 'Aucune recette'}</p>
                  </div>
                  <div className="rangee">
                    <button
                      type="button"
                      className="bouton bouton--fantome bouton--icone"
                      onClick={() => {
                        setNom(e.nom);
                        setEdition(e.id);
                      }}
                      aria-label={`Renommer ${e.nom}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer(e)} aria-label={`Supprimer ${e.nom}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
