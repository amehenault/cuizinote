'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calculator, PenLine, Save } from 'lucide-react';
import { api } from '@/lib/client';
import { enLb, nombreFr, versIso } from '@/lib/dates';
import { ACTIVITES, BUTS, calculerObjectif } from '@/lib/objectif';
import { Message, versNombre } from './Elements';

const LB = 0.45359237;
const PO = 2.54;

/** Objectif calorique : calculé automatiquement (profil + dernier poids) ou saisi à la main. */
export default function ObjectifCalorique({ compte, onChange }) {
  const [mode, setMode] = useState(compte.objectif_mode || 'manuel');
  const [manuel, setManuel] = useState(compte.objectif_manuel ? String(compte.objectif_manuel) : '');
  const [uniteTaille, setUniteTaille] = useState('pi');
  const tailleInitiale = compte.taille_cm || null;
  const [taille, setTaille] = useState({
    cm: tailleInitiale ? String(Math.round(tailleInitiale)) : '',
    pi: tailleInitiale ? String(Math.floor(tailleInitiale / PO / 12)) : '',
    po: tailleInitiale ? String(Math.round((tailleInitiale / PO) % 12)) : '',
  });
  const [profil, setProfil] = useState({
    sexe: compte.sexe || '',
    date_naissance: compte.date_naissance || '',
    activite: compte.activite || '',
    but: compte.but || '',
  });
  const [poidsLb, setPoidsLb] = useState('');
  const [message, setMessage] = useState({ type: 'info', texte: '' });
  const [envoi, setEnvoi] = useState(false);

  const tailleCm =
    uniteTaille === 'cm'
      ? versNombre(taille.cm)
      : versNombre(taille.pi) != null
        ? ((versNombre(taille.pi) || 0) * 12 + (versNombre(taille.po) || 0)) * PO
        : null;
  const poidsSaisiKg = versNombre(poidsLb) ? versNombre(poidsLb) * LB : null;
  const poidsKg = poidsSaisiKg || compte.dernier_poids_kg;
  const calcul = calculerObjectif({ ...profil, taille_cm: tailleCm }, poidsKg);

  const champ = (cle) => ({ value: profil[cle], onChange: (e) => setProfil((p) => ({ ...p, [cle]: e.target.value })) });

  async function enregistrer(e) {
    e.preventDefault();
    setMessage({ type: 'info', texte: '' });
    setEnvoi(true);
    try {
      if (mode === 'manuel') {
        const n = versNombre(manuel);
        await api('/api/compte', { methode: 'PATCH', corps: { objectif_mode: 'manuel', objectif_kcal: n ? Math.round(n) : null } });
        setMessage({ type: 'succes', texte: 'Objectif enregistré.' });
      } else {
        if (!calcul) throw new Error('Remplissez tous les champs pour calculer votre objectif.');
        if (poidsSaisiKg) {
          await api('/api/sante/poids', { methode: 'POST', corps: { mesure_le: versIso(), poids_kg: Math.round(poidsSaisiKg * 100) / 100 } });
        }
        await api('/api/compte', {
          methode: 'PATCH',
          corps: {
            objectif_mode: 'auto',
            sexe: profil.sexe,
            date_naissance: profil.date_naissance,
            taille_cm: Math.round(tailleCm * 10) / 10,
            activite: profil.activite,
            but: profil.but,
          },
        });
        setPoidsLb('');
        setMessage({ type: 'succes', texte: `Objectif automatique activé : ${nombreFr(calcul.kcal)} kcal par jour.` });
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
            placeholder="Ex. : 1800"
            value={manuel}
            onChange={(e) => setManuel(e.target.value)}
            aria-label="Objectif en kcal"
          />
          <span className="champ__aide">kcal par jour</span>
        </div>
      ) : (
        <div className="pile">
          <p className="champ__aide">
            Calculé selon votre âge, taille, poids et activité, puis <strong>recalculé tout seul</strong> à chaque nouvelle
            pesée (Samsung Health, VeSync ou saisie dans Santé).
          </p>
          <div className="formulaire__ligne">
            <label className="champ">
              <span className="champ__libelle">Sexe</span>
              <select className="champ__saisie" required {...champ('sexe')}>
                <option value="">Choisir</option>
                <option value="femme">Femme</option>
                <option value="homme">Homme</option>
              </select>
            </label>
            <label className="champ">
              <span className="champ__libelle">Date de naissance</span>
              <input className="champ__saisie" type="date" required max={versIso()} {...champ('date_naissance')} />
            </label>
          </div>
          <div className="formulaire__ligne">
            <div className="champ">
              <span className="champ__libelle">Taille</span>
              <div className="champ__groupe">
                {uniteTaille === 'cm' ? (
                  <input className="champ__saisie" inputMode="decimal" required placeholder="165" value={taille.cm} onChange={(e) => setTaille((t) => ({ ...t, cm: e.target.value }))} aria-label="Taille en centimètres" />
                ) : (
                  <>
                    <input className="champ__saisie" inputMode="numeric" required placeholder="5" value={taille.pi} onChange={(e) => setTaille((t) => ({ ...t, pi: e.target.value }))} aria-label="Pieds" />
                    <input className="champ__saisie" inputMode="numeric" placeholder="5" value={taille.po} onChange={(e) => setTaille((t) => ({ ...t, po: e.target.value }))} aria-label="Pouces" />
                  </>
                )}
                <select className="champ__saisie champ__saisie--unite" value={uniteTaille} onChange={(e) => setUniteTaille(e.target.value)} aria-label="Unité de taille">
                  <option value="pi">pi / po</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>
            <label className="champ">
              <span className="champ__libelle">Poids (lb)</span>
              <input
                className="champ__saisie"
                inputMode="decimal"
                required={!compte.dernier_poids_kg}
                placeholder={compte.dernier_poids_kg ? nombreFr(enLb(compte.dernier_poids_kg), 1) : 'Ex. : 150'}
                value={poidsLb}
                onChange={(e) => setPoidsLb(e.target.value)}
              />
              <span className="champ__aide">
                {compte.dernier_poids_kg
                  ? `Dernière pesée : ${nombreFr(enLb(compte.dernier_poids_kg), 1)} lb. Laissez vide pour l'utiliser.`
                  : 'Enregistré aussi dans Santé.'}
              </span>
            </label>
          </div>
          <label className="champ">
            <span className="champ__libelle">Niveau d&apos;activité</span>
            <select className="champ__saisie" required {...champ('activite')}>
              <option value="">Choisir</option>
              {ACTIVITES.map((a) => <option key={a.valeur} value={a.valeur}>{a.libelle}</option>)}
            </select>
          </label>
          <label className="champ">
            <span className="champ__libelle">Mon but</span>
            <select className="champ__saisie" required {...champ('but')}>
              <option value="">Choisir</option>
              {BUTS.map((b) => <option key={b.valeur} value={b.valeur}>{b.libelle}</option>)}
            </select>
          </label>
          {calcul && (
            <div className="objectif__resultat">
              <span className="objectif__nombre">{nombreFr(calcul.kcal)} kcal</span>
              <span className="champ__aide">
                par jour · métabolisme de base {nombreFr(calcul.metabolisme)} kcal · dépense estimée {nombreFr(calcul.depense)} kcal
              </span>
            </div>
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
      <p className="champ__aide">
        Utilisé dans l&apos;accueil, le menu de la semaine et le widget. Les pas sont dans <Link href="/sante">Santé</Link>.
      </p>
    </form>
  );
}
