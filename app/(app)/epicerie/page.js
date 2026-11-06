'use client';

import { useEffect, useState } from 'react';
import { ClipboardCopy, Eraser, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, EtatVide, Message } from '@/components/Elements';

export default function PageEpicerie() {
  const [articles, setArticles] = useState(null);
  const [nom, setNom] = useState('');
  const [quantite, setQuantite] = useState('');
  const [message, setMessage] = useState({ type: 'info', texte: '' });

  const charger = () => api('/api/epicerie').then(setArticles).catch((e) => setMessage({ type: 'erreur', texte: e.message }));
  useEffect(() => {
    charger();
  }, []);

  async function ajouter(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    try {
      await api('/api/epicerie', { methode: 'POST', corps: { nom, quantite: quantite || null } });
      setNom('');
      setQuantite('');
      charger();
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
  }

  async function cocher(a) {
    setArticles((liste) => liste.map((x) => (x.id === a.id ? { ...x, coche: !x.coche } : x)));
    await api(`/api/epicerie/${a.id}`, { methode: 'PATCH', corps: { coche: !a.coche } }).catch(() => charger());
  }

  async function supprimer(a) {
    await api(`/api/epicerie/${a.id}`, { methode: 'DELETE' }).catch(() => {});
    charger();
  }

  async function viderCoches() {
    await api('/api/epicerie', { methode: 'DELETE' }).catch(() => {});
    charger();
  }

  async function copier() {
    const texte = (articles || []).filter((a) => !a.coche).map((a) => `- ${a.nom}${a.quantite ? ` (${a.quantite})` : ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(texte);
      setMessage({ type: 'succes', texte: 'Liste copiée dans le presse-papiers.' });
    } catch {
      setMessage({ type: 'erreur', texte: 'Copie impossible sur cet appareil.' });
    }
  }

  const groupes = (articles || []).reduce((acc, a) => {
    const cle = a.coche ? 'Dans le panier' : a.rayon || 'Autres';
    (acc[cle] ||= []).push(a);
    return acc;
  }, {});
  const restants = (articles || []).filter((a) => !a.coche).length;

  return (
    <>
      <EntetePage titre="Liste d'épicerie" sousTitre={articles ? `${restants} article${restants > 1 ? 's' : ''} à acheter` : ''}>
        <button type="button" className="bouton bouton--secondaire" onClick={copier} disabled={!restants}>
          <ClipboardCopy size={16} aria-hidden="true" />
          Copier
        </button>
        <button type="button" className="bouton bouton--secondaire" onClick={viderCoches} disabled={!articles?.some((a) => a.coche)}>
          <Eraser size={16} aria-hidden="true" />
          Retirer les cochés
        </button>
      </EntetePage>

      <form className="carte" onSubmit={ajouter}>
        <div className="carte__corps">
          <div className="rangee">
            <input className="champ__saisie importeur__champ" placeholder="Ajouter un article" value={nom} maxLength={200} onChange={(e) => setNom(e.target.value)} aria-label="Article" />
            <input className="champ__saisie champ__saisie--court" placeholder="Quantité" value={quantite} maxLength={60} onChange={(e) => setQuantite(e.target.value)} aria-label="Quantité" />
            <button type="submit" className="bouton bouton--principal">
              <Plus size={16} aria-hidden="true" />
              Ajouter
            </button>
          </div>
        </div>
      </form>

      <div className="pile" role="region" aria-live="polite">
        <Message type={message.type}>{message.texte}</Message>
        {!articles && <Chargement />}
        {articles?.length === 0 && (
          <EtatVide Icone={ShoppingCart} titre="Votre liste est vide">
            <p>Ajoutez des articles ici ou générez la liste depuis le planificateur.</p>
          </EtatVide>
        )}
        {Object.entries(groupes).map(([rayon, liste]) => (
          <section key={rayon} className="carte">
            <div className="carte__entete">
              <h2 className="carte__titre">{rayon}</h2>
            </div>
            <ul className="liste">
              {liste.map((a) => (
                <li key={a.id} className={`liste__element${a.coche ? ' epicerie__article--coche' : ''}`}>
                  <input type="checkbox" className="epicerie__case" checked={a.coche} onChange={() => cocher(a)} aria-label={`Cocher ${a.nom}`} />
                  <div className="liste__principal">
                    <p className="liste__titre">{a.nom}</p>
                    {a.quantite && <p className="liste__detail">{a.quantite}</p>}
                  </div>
                  <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer(a)} aria-label={`Supprimer ${a.nom}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
