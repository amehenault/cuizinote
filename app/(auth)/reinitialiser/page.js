import FormulaireMotDePasse from '@/components/FormulaireMotDePasse';

export const metadata = { title: 'Nouveau mot de passe', referrer: 'no-referrer' };

export default async function PageReinitialiser({ searchParams }) {
  const { jeton } = await searchParams;
  const valide = typeof jeton === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(jeton);
  return <FormulaireMotDePasse mode="nouveau" jeton={valide ? jeton : ''} />;
}
