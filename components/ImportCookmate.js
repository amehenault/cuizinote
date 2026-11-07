'use client';

import { useState } from 'react';
import { BookUp, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import { lireExportCookmate } from '@/lib/import-cookmate';
import { Message } from './Elements';
import { reduire } from './TeleversementImage';

const typeImage = (o) => (o[0] === 0x89 ? 'image/png' : o[0] === 0x52 ? 'image/webp' : 'image/jpeg');

/** Import des recettes exportées de CookMate (.mcb). Tout est lu dans le navigateur. */
export default function ImportCookmate() {
  const [elements, setElements] = useState(null);
  const [ignorerDoublons, setIgnorerDoublons] = useState(true);
  const [existants, setExistants] = useState(new Set());
  const [progression, setProgression] = useState(null);
  const [message, setMessage] = useState({ type: 'info', texte: '' });

  async function choisir(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setMessage({ type: 'info', texte: '' });
    setProgression(null);
    try {
      const lus = lireExportCookmate(new Uint8Array(await fichier.arrayBuffer()));
      if (!lus.length) throw new Error('Aucune recette dans ce fichier.');
      const actuelles = await api('/api/recettes');
      setExistants(new Set(actuelles.map((r) => r.titre.trim().toLowerCase())));
      setElements(lus);
    } catch (err) {
      setElements(null);
      setMessage({ type: 'erreur', texte: err.message });
    }
  }

  const estDoublon = (el) => existants.has(el.recette.titre.trim().toLowerCase());
  const aImporter = (elements || []).filter((el) => !(ignorerDoublons && estDoublon(el)));

  async function importer() {
    const erreurs = [];
    let faits = 0;
    setProgression({ faits: 0, total: aImporter.length });
    for (const el of aImporter) {
      try {
        let image_id = null;
        if (el.image) {
          try {
            const blob = await reduire(new Blob([el.image], { type: typeImage(el.image) }));
            const formulaire = new FormData();
            formulaire.append('image', blob, 'recette.webp');
            image_id = (await api('/api/images', { methode: 'POST', formulaire })).id;
          } catch {
            /* la photo est facultative : la recette est importée sans elle */
          }
        }
        await api('/api/recettes', { methode: 'POST', corps: { ...el.recette, image_id } });
      } catch (err) {
        erreurs.push(`${el.recette.titre} : ${err.message}`);
      }
      faits += 1;
      setProgression({ faits, total: aImporter.length });
    }
    setElements(null);
    setMessage(
      erreurs.length
        ? { type: 'alerte', texte: `${faits - erreurs.length} recette(s) importée(s). Problèmes : ${erreurs.join(' ; ')}` }
        : { type: 'succes', texte: `${faits} recette(s) importée(s) avec leurs photos. Retrouvez-les dans Recettes.` }
    );
  }

  const enCours = progression && progression.faits < progression.total;

  return (
    <div className="pile">
      <p className="liste__titre">Recettes CookMate (.mcb)</p>
      <div className="pile">
        <div>
          <label className="bouton bouton--secondaire">
            <Upload size={16} aria-hidden="true" />
            Choisir le fichier .mcb
            <input type="file" accept=".mcb,.zip" className="visuellement-cache" onChange={choisir} disabled={enCours} />
          </label>
        </div>

        {elements && (
          <div className="pile">
            <p className="liste__titre">{elements.length} recette{elements.length > 1 ? 's' : ''} trouvée{elements.length > 1 ? 's' : ''} dans le fichier</p>
            <ul className="import__liste">
              {elements.map((el, i) => (
                <li key={i} className={estDoublon(el) ? 'import__doublon' : undefined}>
                  {el.recette.titre}
                  {el.image ? '' : ' (sans photo)'}
                  {estDoublon(el) ? ' - déjà dans vos recettes' : ''}
                </li>
              ))}
            </ul>
            <label className="champ--case">
              <input type="checkbox" checked={ignorerDoublons} onChange={(e) => setIgnorerDoublons(e.target.checked)} />
              <span>Ignorer les recettes que j&apos;ai déjà (même titre)</span>
            </label>
            <div>
              <button type="button" className="bouton bouton--principal" onClick={importer} disabled={enCours || !aImporter.length}>
                <BookUp size={16} aria-hidden="true" />
                Importer {aImporter.length} recette{aImporter.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {progression && (
          <div className="pile pile--serre">
            <div className="jauge">
              <div className="jauge__remplissage" style={{ width: `${(progression.faits / Math.max(1, progression.total)) * 100}%` }} />
            </div>
            <p className="champ__aide">{progression.faits} / {progression.total}</p>
          </div>
        )}
        <Message type={message.type}>{message.texte}</Message>
      </div>
    </div>
  );
}
