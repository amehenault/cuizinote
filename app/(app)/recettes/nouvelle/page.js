import { EntetePage } from '@/components/Elements';
import FormulaireRecette from '@/components/FormulaireRecette';

export const metadata = { title: 'Nouvelle recette' };

export default function PageNouvelleRecette() {
  return (
    <>
      <EntetePage titre="Nouvelle recette" sousTitre="Saisissez-la à la main ou importez-la depuis un lien" />
      <FormulaireRecette permettreImport />
    </>
  );
}
