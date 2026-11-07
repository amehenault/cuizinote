'use client';

import { useCallback, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, Message } from './Elements';
import FormulaireAliment from './FormulaireAliment';
import ScanneurCodeBarre from './ScanneurCodeBarre';

/**
 * Scanne un code-barres. Un produit trouvé dans Open Food Facts est ajouté
 * automatiquement à la banque d'aliments, puis peut être corrigé.
 */
export default function AjoutParScan({ onEnregistre }) {
  const [etape, setEtape] = useState('scan');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');

  const detecte = useCallback(async (code) => {
    setEtape('recherche');
    setErreur('');
    try {
      const r = await api(`/api/aliments/code-barre/${code}`);
      if (r.provenance === 'openfoodfacts') {
        const enregistre = await api('/api/aliments', { methode: 'POST', corps: r.aliment });
        setResultat({ provenance: 'ajoute', aliment: enregistre });
      } else if (r.provenance === 'introuvable') {
        setErreur("Produit introuvable dans Open Food Facts. Entrez les valeurs de l'étiquette (onglet « 1 portion »).");
        setResultat({ provenance: 'manuel', aliment: r.aliment });
      } else {
        setResultat(r);
      }
    } catch (e) {
      setErreur(`${e.message}. Saisissez les valeurs vous-même pour l'ajouter à votre banque.`);
      setResultat({ provenance: 'manuel', aliment: { code_barre: code } });
    }
    setEtape('formulaire');
  }, []);

  if (etape === 'scan') return <ScanneurCodeBarre onDetecte={detecte} />;
  if (etape === 'recherche') return <Chargement texte="Recherche du produit..." />;

  const dejaEnregistre = Boolean(resultat.aliment.id);

  return (
    <div className="pile">
      {resultat.provenance === 'banque' && <Message type="info">Ce produit est déjà dans votre banque. Vous pouvez corriger ses valeurs.</Message>}
      {resultat.provenance === 'ajoute' && (
        <Message type="succes">Produit ajouté à votre banque d&apos;aliments. Vérifiez les valeurs avec l&apos;étiquette.</Message>
      )}
      <Message type="alerte">{erreur}</Message>
      <FormulaireAliment key={resultat.aliment.id || 'nouveau'} initial={resultat.aliment} onEnregistre={onEnregistre} />
      <div className="rangee rangee--espacee">
        <button type="button" className="bouton bouton--fantome" onClick={() => { setResultat(null); setEtape('scan'); }}>
          <RotateCcw size={16} aria-hidden="true" />
          Scanner un autre produit
        </button>
        {dejaEnregistre && (
          <button type="button" className="bouton bouton--secondaire" onClick={() => onEnregistre(resultat.aliment)}>
            <Check size={16} aria-hidden="true" />
            Utiliser tel quel
          </button>
        )}
      </div>
    </div>
  );
}
