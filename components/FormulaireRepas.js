'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/client';
import { MOMENTS, nombreFr } from '@/lib/dates';
import { Message, versNombre } from './Elements';
import AjoutParScan from './AjoutParScan';
import { kcalParPortion, libellePortion, resumeCalories } from '@/lib/portion';
import RechercheAliment from './RechercheAliment';
import { libelleContenance } from '@/lib/quantites';

const TYPES = [
  ['recette', 'Repas'],
  ['aliment', 'Aliment'],
  ['scanner', 'Scanner'],
  ['libre', 'Autre'],
];

/**
 * Ajout d'un repas.
 * cible = 'journal' : ce que je viens de manger (calories comptées)
 * cible = 'plan'    : repas prévu dans le menu de la semaine
 */
export default function FormulaireRepas({ cible = 'journal', jour, moment, onEnregistre }) {
  const [type, setType] = useState('recette');
  const [recettes, setRecettes] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [recetteId, setRecetteId] = useState('');
  const [aliment, setAliment] = useState(null);
  const [libelle, setLibelle] = useState('');
  const [kcalLibre, setKcalLibre] = useState('');
  const [portions, setPortions] = useState('1');
  const [grammes, setGrammes] = useState('');
  const [m, setM] = useState(moment);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // Boissons : on demande dans quel verre (collection de la personne, voir Paramètres)
  const [verres, setVerres] = useState([]);
  const [verre, setVerre] = useState('');

  useEffect(() => {
    api('/api/recettes').then(setRecettes).catch(() => {});
    api('/api/verres').then(setVerres).catch(() => {});
  }, []);

  const options = recettes.filter((r) => r.titre.toLowerCase().includes(filtre.toLowerCase())).slice(0, 60);
  const recette = recettes.find((r) => r.id === recetteId);
  const nbPortions = versNombre(portions) || 1;

  const boisson = type === 'aliment' && aliment?.unite === 'ml' && verres.length > 0;
  const verreChoisi = verres.find((v) => v.id === verre);
  // ml d'un verre : verre de la collection, portion de l'étiquette, ou quantité entrée
  const mlVerre = !boisson ? null : verreChoisi ? verreChoisi.ml : verre === 'etiquette' ? aliment.portion_g || 100 : verre === 'autre' ? versNombre(grammes) : null;

  let apercu = null;
  if (type === 'recette' && recette?.kcal != null) apercu = recette.kcal * nbPortions;
  const parPortionEtiquette = type === 'aliment' && aliment?.portion_g && !boisson;
  if (type === 'aliment' && aliment?.kcal_100g != null) {
    if (boisson) apercu = mlVerre != null ? (aliment.kcal_100g * mlVerre) / 100 * nbPortions : null;
    else apercu = parPortionEtiquette ? kcalParPortion(aliment) * nbPortions : (aliment.kcal_100g * (versNombre(grammes) ?? 100)) / 100 * nbPortions;
  }
  if (type === 'libre' && cible === 'journal') apercu = versNombre(kcalLibre);

  function choisirAliment(a) {
    setAliment(a);
    setGrammes(a.portion_g ? String(a.portion_g) : '100');
    setVerre('');
    setType('aliment');
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    const corps = { jour, moment: m, portions: nbPortions };
    if (type === 'recette') {
      if (!recetteId) return setErreur('Choisissez un repas dans la liste.');
      corps.recette_id = recetteId;
    }
    if (type === 'aliment') {
      if (!aliment) return setErreur('Choisissez un aliment.');
      corps.aliment_id = aliment.id;
      if (boisson) {
        if (!verre) return setErreur('Choisissez votre verre.');
        if (!mlVerre) return setErreur('Entrez la quantité en ml.');
        corps.grammes = verre === 'etiquette' ? null : mlVerre;
      } else {
        corps.grammes = aliment.portion_g ? null : versNombre(grammes);
      }
    }
    if (type === 'libre') {
      corps.libelle = libelle;
      if (cible === 'journal') corps.kcal = versNombre(kcalLibre);
    }
    setEnvoi(true);
    try {
      await api(cible === 'journal' ? '/api/journal' : '/api/planificateur', { methode: 'POST', corps });
      onEnregistre();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="pile">
      <div className="onglets" role="tablist">
        {TYPES.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={type === v} className={`onglets__bouton${type === v ? ' onglets__bouton--actif' : ''}`} onClick={() => setType(v)}>
            {l}
          </button>
        ))}
      </div>

      {type === 'scanner' ? (
        <AjoutParScan onEnregistre={choisirAliment} />
      ) : (
        <form className="formulaire" onSubmit={soumettre}>
          <label className="champ">
            <span className="champ__libelle">Catégorie</span>
            <select className="champ__saisie" value={m} onChange={(e) => setM(e.target.value)}>
              {MOMENTS.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
            </select>
          </label>

          {type === 'recette' && (
            <div className="pile pile--serre">
              <input className="champ__saisie" placeholder="Filtrer mes recettes" value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer les recettes" />
              <select className="champ__saisie" size={Math.min(8, Math.max(3, options.length))} value={recetteId} onChange={(e) => setRecetteId(e.target.value)} aria-label="Repas">
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
                  <span>{aliment.nom}{resumeCalories(aliment) ? ` - ${resumeCalories(aliment)}` : ''}</span>
                  <button type="button" className="etiquette__retirer" onClick={() => setAliment(null)}>Changer</button>
                </div>
              ) : (
                <RechercheAliment onChoisir={choisirAliment} />
              )}
              {boisson ? (
                <>
                  <label className="champ">
                    <span className="champ__libelle">Dans quel verre ?</span>
                    <select className="champ__saisie" required value={verre} onChange={(e) => setVerre(e.target.value)}>
                      <option value="" disabled>Choisissez votre verre</option>
                      {verres.map((v) => <option key={v.id} value={v.id}>{v.nom} - {libelleContenance(v.ml)}</option>)}
                      {aliment.portion_g && <option value="etiquette">Portion de l&apos;étiquette ({libellePortion(aliment)})</option>}
                      <option value="autre">Autre quantité (ml)</option>
                    </select>
                  </label>
                  {verre === 'autre' && (
                    <label className="champ">
                      <span className="champ__libelle">Quantité (ml)</span>
                      <input className="champ__saisie" inputMode="decimal" value={grammes} onChange={(e) => setGrammes(e.target.value)} />
                    </label>
                  )}
                </>
              ) : (
                !aliment?.portion_g && (
                  <label className="champ">
                    <span className="champ__libelle">Quantité ({aliment?.unite || 'g'})</span>
                    <input className="champ__saisie" inputMode="decimal" value={grammes} onChange={(e) => setGrammes(e.target.value)} />
                  </label>
                )
              )}
            </div>
          )}

          {type === 'libre' && (
            <div className="formulaire__ligne">
              <label className="champ">
                <span className="champ__libelle">Description</span>
                <input className="champ__saisie" required maxLength={200} placeholder="Ex. : restaurant, café latte..." value={libelle} onChange={(e) => setLibelle(e.target.value)} />
              </label>
              {cible === 'journal' && (
                <label className="champ">
                  <span className="champ__libelle">Calories (kcal)</span>
                  <input className="champ__saisie" inputMode="numeric" value={kcalLibre} onChange={(e) => setKcalLibre(e.target.value)} />
                </label>
              )}
            </div>
          )}

          {type !== 'libre' && (
            <label className="champ">
              <span className="champ__libelle">
                {boisson ? 'Nombre de verres' : parPortionEtiquette ? `Nombre de portions (1 portion = ${libellePortion(aliment)})` : 'Portions'}
              </span>
              <input className="champ__saisie" inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} />
            </label>
          )}

          {apercu != null && <p className="journal__apercu">{nombreFr(apercu)} kcal</p>}
          <Message type="erreur">{erreur}</Message>
          <div className="formulaire__actions">
            <button type="submit" className="bouton bouton--principal" disabled={envoi}>
              <Plus size={16} aria-hidden="true" />
              {cible === 'journal' ? 'Ajouter à mes calories' : 'Ajouter au menu'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
