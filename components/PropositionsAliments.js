'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api, urlImage } from '@/lib/client';
import { Message, Modale } from './Elements';

const LIGNES = [
  ['nom', 'Nom'],
  ['marque', 'Marque'],
  ['kcal_100g', 'Calories (100 g)', ' kcal'],
  ['proteines_100g', 'Protéines (100 g)', ' g'],
  ['glucides_100g', 'Glucides (100 g)', ' g'],
  ['lipides_100g', 'Lipides (100 g)', ' g'],
  ['fibres_100g', 'Fibres (100 g)', ' g'],
  ['sucres_100g', 'Sucres (100 g)', ' g'],
  ['sel_100g', 'Sel (100 g)', ' g'],
  ['sodium_100g', 'Sodium (100 g)', ' mg', 1000],
  ['portion_g', 'Portion', ''],
  ['portion_texte', 'Portion (texte)'],
  ['contenant', 'Format du contenant'],
  ['photo', 'Photo'],
];

function valeur(v, cle, suffixe = '', facteur = 1) {
  if (cle === 'contenant') return v.contenant_qte ? `${String(v.contenant_qte).replace('.', ',')} ${v.contenant_unite || v.unite || ''}` : '—';
  if (cle === 'portion_g') return v.portion_g ? `${String(v.portion_g).replace('.', ',')} ${v.unite || 'g'}` : '—';
  const x = v[cle];
  if (x == null || x === '') return '—';
  if (typeof x === 'number') return `${String(Math.round(x * facteur * 100) / 100).replace('.', ',')}${suffixe}`;
  return String(x);
}

function Photo({ v }) {
  const src = urlImage(v.image_id) || v.image_url;
  return src ? <img src={src} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} /> : '—';
}

/**
 * Fenêtre affichée sur toutes les pages quand quelqu'un a modifié un produit que j'utilise :
 * ma version à gauche, la nouvelle à droite ; je garde la mienne ou je prends la nouvelle.
 */
export default function PropositionsAliments() {
  const [liste, setListe] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api('/api/aliments/propositions').then(setListe).catch(() => {});
  }, []);

  const p = liste[0];
  if (!p) return null;

  const differents = (cle) =>
    cle === 'contenant'
      ? p.avant.contenant_qte !== p.apres.contenant_qte || p.avant.contenant_unite !== p.apres.contenant_unite
      : cle === 'photo'
        ? p.avant.image_id !== p.apres.image_id || p.avant.image_url !== p.apres.image_url
        : cle === 'portion_g'
          ? p.avant.portion_g !== p.apres.portion_g || p.avant.unite !== p.apres.unite
          : JSON.stringify(p.avant[cle]) !== JSON.stringify(p.apres[cle]);
  const lignes = LIGNES.filter(([cle]) => differents(cle) || cle === 'nom');

  async function repondre(accepter) {
    setEnvoi(true);
    setErreur('');
    try {
      await api(`/api/aliments/propositions/${p.id}`, { methode: 'POST', corps: { accepter } });
      setListe((l) => l.slice(1));
    } catch (e) {
      setErreur(e.message);
    }
    setEnvoi(false);
  }

  return (
    <Modale titre="Nouvelle version d’un produit" ouverte large onFermer={() => setListe((l) => l.slice(1))}>
      <div className="pile">
        <p className="champ__aide">
          <strong>{p.auteur || 'Quelqu’un'}</strong> a modifié « {p.apres.nom} ». Voulez-vous la nouvelle version ?
          {liste.length > 1 ? ` (${liste.length - 1} autre${liste.length > 2 ? 's' : ''} ensuite)` : ''}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="tableau">
            <thead>
              <tr>
                <th className="tableau__cellule tableau__cellule--entete" scope="col"> </th>
                <th className="tableau__cellule tableau__cellule--entete" scope="col">Ma version</th>
                <th className="tableau__cellule tableau__cellule--entete" scope="col">Nouvelle version</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(([cle, libelle, suffixe, facteur]) => {
                const change = differents(cle);
                return (
                  <tr key={cle}>
                    <th className="tableau__cellule" scope="row" style={{ fontWeight: 600 }}>{libelle}</th>
                    <td className="tableau__cellule">
                      {cle === 'photo' ? <Photo v={p.avant} /> : valeur(p.avant, cle, suffixe, facteur)}
                    </td>
                    <td className="tableau__cellule" style={change ? { fontWeight: 700, background: 'var(--couleur-succes-pale)' } : undefined}>
                      {cle === 'photo' ? <Photo v={p.apres} /> : valeur(p.apres, cle, suffixe, facteur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Message type="erreur">{erreur}</Message>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--espace-2)' }}>
          <button type="button" className="bouton bouton--secondaire" disabled={envoi} onClick={() => repondre(false)}>
            <X size={16} aria-hidden="true" />
            Garder la mienne
          </button>
          <button type="button" className="bouton bouton--principal" disabled={envoi} onClick={() => repondre(true)}>
            <Check size={16} aria-hidden="true" />
            Prendre la nouvelle
          </button>
        </div>
      </div>
    </Modale>
  );
}
