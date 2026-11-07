'use client';

import { useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api, urlImage } from '@/lib/client';
import { Message } from './Elements';

/** Réduit l'image dans le navigateur (1600 px max, WebP) avant l'envoi au serveur. */
export async function reduire(fichier) {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const toile = document.createElement('canvas');
  toile.width = Math.round(bitmap.width * echelle);
  toile.height = Math.round(bitmap.height * echelle);
  toile.getContext('2d').drawImage(bitmap, 0, 0, toile.width, toile.height);
  bitmap.close?.();
  return new Promise((resoudre, rejeter) =>
    toile.toBlob((b) => (b ? resoudre(b) : rejeter(new Error('Conversion impossible'))), 'image/webp', 0.82)
  );
}

export default function TeleversementImage({ imageId, onChange, alt = 'Photo de la recette', compact = false }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  async function choisir(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setErreur('');
    setEnvoi(true);
    try {
      const blob = await reduire(fichier);
      const formulaire = new FormData();
      formulaire.append('image', blob, 'photo.webp');
      const { id } = await api('/api/images', { methode: 'POST', formulaire });
      onChange(id);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="televersement">
      <label className={`televersement__zone${compact ? ' televersement__zone--compact' : ''}`}>
        {imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="televersement__image" src={urlImage(imageId)} alt={alt} />
        ) : (
          <span className="televersement__invite">
            {envoi ? <Loader2 className="chargement__icone" size={32} aria-hidden="true" /> : <ImagePlus size={32} aria-hidden="true" />}
            {envoi ? 'Envoi en cours...' : 'Ajouter une photo'}
          </span>
        )}
        <input className="televersement__fichier" type="file" accept="image/*" onChange={choisir} disabled={envoi} aria-label="Choisir une photo" />
      </label>
      {imageId && (
        <div className="rangee rangee--fin">
          <button type="button" className="bouton bouton--fantome bouton--petit" onClick={() => onChange(null)}>
            <Trash2 size={14} aria-hidden="true" />
            Retirer la photo
          </button>
        </div>
      )}
      <Message type="erreur">{erreur}</Message>
    </div>
  );
}
