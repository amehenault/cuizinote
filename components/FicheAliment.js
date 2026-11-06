'use client';

import { useState } from 'react';
import { Pencil, Plus, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/client';
import { EMPLACEMENTS, nombreFr } from '@/lib/dates';
import { LIBELLES_EMPLACEMENT, trouverEnInventaire } from '@/lib/disponibilite';
import { Message } from './Elements';

/** Fiche d'un aliment : valeurs nutritives, présence dans l'inventaire, ajout à l'épicerie ou à l'inventaire. */
export default function FicheAliment({ aliment, inventaire, onModifier, onInventaireChange }) {
  const [emplacement, setEmplacement] = useState('frigo');
  const [message, setMessage] = useState({ type: 'info', texte: '' });
  const dispo = trouverEnInventaire({ aliment_id: aliment.id, nom: aliment.nom }, inventaire);

  async function versEpicerie() {
    try {
      await api('/api/epicerie', { methode: 'POST', corps: { nom: aliment.marque ? `${aliment.nom} (${aliment.marque})` : aliment.nom } });
      setMessage({ type: 'succes', texte: 'Ajouté à la liste d\'épicerie.' });
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    }
  }

  async function versInventaire() {
    try {
      await api('/api/inventaire', { methode: 'POST', corps: { emplacement, nom: aliment.nom, aliment_id: aliment.id } });
      setMessage({ type: 'succes', texte: `Ajouté au ${LIBELLES_EMPLACEMENT[emplacement]}.` });
      onInventaireChange();
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    }
  }

  const valeurs = [
    ['kcal', aliment.kcal_100g, 0],
    ['Protéines (g)', aliment.proteines_100g, 1],
    ['Glucides (g)', aliment.glucides_100g, 1],
    ['Lipides (g)', aliment.lipides_100g, 1],
  ];

  return (
    <div className="pile">
      <div className="rangee">
        {aliment.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="aliment__vignette" src={aliment.image_url} alt="" referrerPolicy="no-referrer" />
        )}
        <div className="liste__principal">
          <p className="liste__titre">{aliment.nom}</p>
          <p className="liste__detail">{[aliment.marque, aliment.code_barre].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <div className="nutrition">
        {valeurs.map(([libelle, v, d]) => (
          <div key={libelle} className="nutrition__valeur">
            <span className="nutrition__nombre">{nombreFr(v, d)}</span>
            <span className="nutrition__libelle">{libelle}</span>
          </div>
        ))}
      </div>
      <p className="nutrition__source">
        Pour 100 g{aliment.portion_g ? ` · portion habituelle ${nombreFr(aliment.portion_g)} g (${nombreFr((aliment.kcal_100g || 0) * aliment.portion_g / 100)} kcal)` : ''}
      </p>

      {dispo ? (
        <Message type="succes">
          Vous en avez au {LIBELLES_EMPLACEMENT[dispo.emplacement]}
          {dispo.quantite != null ? ` (${nombreFr(dispo.quantite, 2)} ${dispo.unite || ''})` : ''}.
        </Message>
      ) : (
        <Message type="alerte">Vous n&apos;en avez pas en inventaire.</Message>
      )}

      <div className="rangee">
        <button type="button" className={`bouton ${dispo ? 'bouton--secondaire' : 'bouton--principal'}`} onClick={versEpicerie}>
          <ShoppingCart size={16} aria-hidden="true" />
          Ajouter à l&apos;épicerie
        </button>
        <select className="champ__saisie champ__saisie--court" value={emplacement} onChange={(e) => setEmplacement(e.target.value)} aria-label="Emplacement">
          {EMPLACEMENTS.map((e) => <option key={e.valeur} value={e.valeur}>{e.libelle}</option>)}
        </select>
        <button type="button" className="bouton bouton--secondaire" onClick={versInventaire}>
          <Plus size={16} aria-hidden="true" />
          Ajouter à l&apos;inventaire
        </button>
        <button type="button" className="bouton bouton--fantome" onClick={onModifier}>
          <Pencil size={16} aria-hidden="true" />
          Modifier les calories
        </button>
      </div>
      <Message type={message.type}>{message.texte}</Message>
    </div>
  );
}
