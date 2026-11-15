'use client';

import { useState } from 'react';
import { Calculator, PenLine, Save } from 'lucide-react';
import { api } from '@/lib/client';
import { enLb, nombreFr } from '@/lib/dates';
import { COEFFICIENTS_PROTEINES, calculerProteines } from '@/lib/objectif';
import { Message, versNombre } from './Elements';

/** Objectif de protéines : poids x coefficient selon l'âge (automatique) ou saisi à la main. */
export default function ObjectifProteines({ compte, onChange }) {
  const [mode, setMode] = useState(compte.proteines_mode || 'auto');
  const [manuel, setManuel] = useState(compte.proteines_manuel ? String(compte.proteines_manuel) : '');
  const [message, setMessage] = useState({ type: 'info', texte: '' });
  const [envoi, setEnvoi] = useState(false);

  const calcul = calculerProteines(compte.date_naissance, compte.dernier_poids_kg);

  async function enregistrer(e) {
    e.preventDefault();
    setMessage({ type: 'info', texte: '' });
    setEnvoi(true);
    try {
      if (mode === 'manuel') {
        const n = versNombre(manuel);
        await api('/api/compte', { methode: 'PATCH', corps: { proteines_mode: 'manuel', objectif_proteines: n ? Math.round(n) : null } });
        setMessage({ type: 'succes', texte: 'Objectif de protéines enregistré.' });
      } else {
        if (!calcul) throw new Error('Il manque votre date de naissance ou une pesée (voir Objectif calorique ou Santé).');
        await api('/api/compte', { methode: 'PATCH', corps: { proteines_mode: 'auto' } });
        setMessage({ type: 'succes', texte: `Objectif automatique activé : ${nombreFr(calcul.grammes)} g de protéines par jour.` });
      }
      onChange?.();
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.message });
    }
    setEnvoi(false);
  }

  return (
    <form className="pile" onSubmit={enregistrer}>
      <div className="onglets" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'auto'} className={`onglets__bouton${mode === 'auto' ? ' onglets__bouton--actif' : ''}`} onClick={() => setMode('auto')}>
          <Calculator size={16} aria-hidden="true" />
          Calcul automatique
        </button>
        <button type="button" role="tab" aria-selected={mode === 'manuel'} className={`onglets__bouton${mode === 'manuel' ? ' onglets__bouton--actif' : ''}`} onClick={() => setMode('manuel')}>
          <PenLine size={16} aria-hidden="true" />
          Je l&apos;entre moi-même
        </button>
      </div>

      {mode === 'manuel' ? (
        <div className="rangee">
          <input
            className="champ__saisie champ__saisie--court"
            inputMode="numeric"
            placeholder="Ex. : 90"
            value={manuel}
            onChange={(e) => setManuel(e.target.value)}
            aria-label="Objectif de protéines en grammes"
          />
          <span className="champ__aide">g de protéines par jour</span>
        </div>
      ) : (
        <div className="pile">
          <p className="champ__aide">
            Votre poids multiplié par un coefficient selon votre âge, <strong>recalculé tout seul</strong> à chaque
            nouvelle pesée :{' '}
            {COEFFICIENTS_PROTEINES.map((t) => `${t.libelle} : ${nombreFr(t.coefficient, 2)} g/kg`).join(' · ')}.
          </p>
          {calcul ? (
            <div className="objectif__resultat">
              <span className="objectif__nombre">{nombreFr(calcul.grammes)} g</span>
              <span className="champ__aide">
                par jour · {nombreFr(enLb(compte.dernier_poids_kg), 1)} lb ({nombreFr(compte.dernier_poids_kg, 1)} kg) x{' '}
                {nombreFr(calcul.coefficient, 2)} g/kg ({calcul.age} ans)
              </span>
            </div>
          ) : (
            <Message type="alerte">
              Pour le calcul automatique, il faut votre date de naissance (section Objectif calorique) et au moins une
              pesée (page Santé).
            </Message>
          )}
        </div>
      )}

      <div>
        <button type="submit" className="bouton bouton--principal" disabled={envoi}>
          <Save size={16} aria-hidden="true" />
          {envoi ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
      <Message type={message.type}>{message.texte}</Message>
      <p className="champ__aide">Utilisé dans l&apos;accueil (calories mangées) et le menu de la semaine.</p>
    </form>
  );
}
