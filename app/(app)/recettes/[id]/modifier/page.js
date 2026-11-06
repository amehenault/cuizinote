'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Chargement, EntetePage, Message } from '@/components/Elements';
import FormulaireRecette from '@/components/FormulaireRecette';

export default function PageModifierRecette({ params }) {
  const { id } = use(params);
  const [recette, setRecette] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api(`/api/recettes/${id}`).then(setRecette).catch((e) => setErreur(e.message));
  }, [id]);

  return (
    <>
      <EntetePage titre="Modifier la recette" sousTitre={recette?.titre} />
      <Message type="erreur">{erreur}</Message>
      {!recette && !erreur && <Chargement />}
      {recette && <FormulaireRecette initial={recette} recetteId={id} />}
    </>
  );
}
