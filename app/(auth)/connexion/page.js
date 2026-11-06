import { redirect } from 'next/navigation';
import { utilisateurCourant } from '@/lib/auth';
import FormulaireAuth from '@/components/FormulaireAuth';

export const metadata = { title: 'Connexion' };

export default async function PageConnexion() {
  if (await utilisateurCourant()) redirect('/');
  return <FormulaireAuth mode="connexion" />;
}
