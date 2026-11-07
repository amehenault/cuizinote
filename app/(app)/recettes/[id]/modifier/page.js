'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, Message } from '@/components/Elements';
import FormulaireRecette from '@/components/FormulaireRecette';

export default function PageModifierRecette({ params }) {
  const { id } = use(params);
  const [recette, setRecette] = useState(null);
  const [erreur, setErreur] = useState('');
  const routeur = useRouter();
  const depuisFiche = useSearchParams().get('de') === 'fiche';

  useEffect(() => {
    api(`/api/recettes/${id}`).then(setRecette).catch((e) => setErreur(e.message));
  }, [id]);

  return (
    <>
      {depuisFiche ? (
        <button type="button" className="bouton bouton--fantome" style={{ alignSelf: 'flex-start' }} onClick={() => routeur.back()}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour
        </button>
      ) : (
        <Link href={`/recettes/${id}`} className="bouton bouton--fantome" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour
        </Link>
      )}
      <EntetePage titre="Modifier la recette" sousTitre={recette?.titre} />
      <Message type="erreur">{erreur}</Message>
      {!recette && !erreur && <Chargement />}
      {recette && <FormulaireRecette initial={recette} recetteId={id} retourArriere={depuisFiche} />}
    </>
  );
}
