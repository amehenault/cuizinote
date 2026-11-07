'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '@/lib/client';
import { ML_PAR_TASSE, ecrireQuantite, libelleContenance, lireQuantite } from '@/lib/quantites';
import { Message } from './Elements';

const VIDE = { nom: '', quantite: '', unite: 'tasses' };

/** Formulaire d'un verre : nom + contenance en tasses (« 1 1/2 », « 1,5 ») ou en ml. */
function FormulaireVerre({ initial = VIDE, libelleBouton, onEnregistrer, onAnnuler }) {
  const [v, setV] = useState(initial);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    const n = lireQuantite(String(v.quantite || '').replace(/tasses?|ml/gi, ''));
    if (!n || n <= 0) return setErreur('Entrez une contenance, par exemple 1 1/2.');
    const ml = Math.round((v.unite === 'tasses' ? n * ML_PAR_TASSE : n) * 100) / 100;
    if (ml > 5000) return setErreur('Contenance trop grande (maximum 5 L).');
    setEnvoi(true);
    try {
      await onEnregistrer({ nom: v.nom.trim(), ml });
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <form className="formulaire" onSubmit={soumettre}>
      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Nom</span>
          <input className="champ__saisie" required maxLength={80} placeholder="Ex. : tasse chat" value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />
        </label>
        <label className="champ">
          <span className="champ__libelle">Contenance</span>
          <input className="champ__saisie" required inputMode="decimal" placeholder="Ex. : 1 1/2" value={v.quantite} onChange={(e) => setV({ ...v, quantite: e.target.value })} />
        </label>
        <label className="champ">
          <span className="champ__libelle">Unité</span>
          <select className="champ__saisie" value={v.unite} onChange={(e) => setV({ ...v, unite: e.target.value })}>
            <option value="tasses">tasses</option>
            <option value="ml">ml</option>
          </select>
        </label>
      </div>
      <Message type="erreur">{erreur}</Message>
      <div className="formulaire__actions">
        <button type="submit" className="bouton bouton--principal" disabled={envoi}>
          {initial === VIDE ? <Plus size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          {libelleBouton}
        </button>
        {onAnnuler && (
          <button type="button" className="bouton bouton--secondaire" onClick={onAnnuler}>
            <X size={16} aria-hidden="true" />
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

/** Paramètres : mes verres et tasses (proposés quand j'ajoute une boisson à mes repas). */
export default function GestionVerres() {
  const [verres, setVerres] = useState(null);
  const [edition, setEdition] = useState(null);
  const [ajout, setAjout] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = () => api('/api/verres').then(setVerres).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
  }, []);

  async function supprimer(v) {
    if (!window.confirm(`Retirer « ${v.nom} » ?`)) return;
    try {
      await api(`/api/verres/${v.id}`, { methode: 'DELETE' });
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div className="pile">
      <p className="champ__aide">
        Quand vous ajoutez une boisson à vos repas, l&apos;app vous demande dans quel verre vous l&apos;avez bue. 1 tasse = {ML_PAR_TASSE} ml.
      </p>
      <Message type="erreur">{erreur}</Message>
      {verres && verres.length === 0 && <p className="champ__aide">Aucun verre pour l&apos;instant.</p>}
      {verres && verres.length > 0 && (
        <ul className="liste">
          {verres.map((v) => (
            <li key={v.id} className="liste__element">
              {edition === v.id ? (
                <FormulaireVerre
                  initial={{ nom: v.nom, quantite: ecrireQuantite(v.ml / ML_PAR_TASSE), unite: 'tasses' }}
                  libelleBouton="Enregistrer"
                  onAnnuler={() => setEdition(null)}
                  onEnregistrer={async (corps) => {
                    await api(`/api/verres/${v.id}`, { methode: 'PUT', corps });
                    setEdition(null);
                    charger();
                  }}
                />
              ) : (
                <>
                  <div className="liste__principal">
                    <p className="liste__titre">{v.nom}</p>
                    <p className="liste__detail">{libelleContenance(v.ml)}</p>
                  </div>
                  <div className="rangee">
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => setEdition(v.id)} aria-label={`Modifier ${v.nom}`}>
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer(v)} aria-label={`Retirer ${v.nom}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {ajout ? (
        <FormulaireVerre
          libelleBouton="Ajouter ce verre"
          onAnnuler={() => setAjout(false)}
          onEnregistrer={async (corps) => {
            await api('/api/verres', { methode: 'POST', corps });
            setAjout(false);
            charger();
          }}
        />
      ) : (
        <div>
          <button type="button" className="bouton bouton--secondaire" onClick={() => setAjout(true)}>
            <Plus size={16} aria-hidden="true" />
            Ajouter un verre
          </button>
        </div>
      )}
    </div>
  );
}
