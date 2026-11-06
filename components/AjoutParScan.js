'use client';

import { useCallback, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, Message } from './Elements';
import FormulaireAliment from './FormulaireAliment';
import ScanneurCodeBarre from './ScanneurCodeBarre';

/** Scanner un code-barres, récupérer les valeurs nutritives, vérifier puis enregistrer l'aliment. */
export default function AjoutParScan({ onEnregistre }) {
  const [etape, setEtape] = useState('scan');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');

  const detecte = useCallback(async (code) => {
    setEtape('recherche');
    setErreur('');
    try {
      const r = await api(`/api/aliments/code-barre/${code}`);
      setResultat(r);
    } catch (e) {
      setErreur(`${e.message}. Vous pouvez saisir les valeurs vous-même.`);
      setResultat({ provenance: 'manuel', aliment: { code_barre: code } });
    }
    setEtape('formulaire');
  }, []);

  if (etape === 'scan') return <ScanneurCodeBarre onDetecte={detecte} />;
  if (etape === 'recherche') return <Chargement texte="Recherche du produit..." />;

  return (
    <div className="pile">
      {resultat.provenance === 'banque' && <Message type="info">Cet aliment est déjà dans votre banque.</Message>}
      {resultat.provenance === 'openfoodfacts' && <Message type="succes">Produit trouvé dans Open Food Facts. Vérifiez les valeurs.</Message>}
      <Message type="alerte">{erreur}</Message>
      <FormulaireAliment initial={resultat.aliment} onEnregistre={onEnregistre} />
      <button type="button" className="bouton bouton--fantome" onClick={() => { setResultat(null); setEtape('scan'); }}>
        <RotateCcw size={16} aria-hidden="true" />
        Scanner un autre produit
      </button>
    </div>
  );
}
