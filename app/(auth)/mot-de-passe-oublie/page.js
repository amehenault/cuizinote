import FormulaireMotDePasse from '@/components/FormulaireMotDePasse';

export const metadata = { title: 'Mot de passe oublié' };

export default function PageMotDePasseOublie() {
  return <FormulaireMotDePasse mode="oubli" />;
}
