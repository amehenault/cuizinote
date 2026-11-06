import { redirect } from 'next/navigation';
import { utilisateurCourant } from '@/lib/auth';
import FormulaireAuth from '@/components/FormulaireAuth';

export const metadata = { title: 'Inscription' };

export default async function PageInscription() {
  if (await utilisateurCourant()) redirect('/');
  return <FormulaireAuth mode="inscription" />;
}
