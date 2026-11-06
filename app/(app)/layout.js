import { redirect } from 'next/navigation';
import { utilisateurCourant } from '@/lib/auth';
import Coquille from '@/components/Coquille';

export default async function AppLayout({ children }) {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) redirect('/connexion');
  return <Coquille nom={utilisateur.nom}>{children}</Coquille>;
}
