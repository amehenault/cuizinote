import Link from 'next/link';

export default function Introuvable() {
  return (
    <main className="auth">
      <div className="auth__boite">
        <h1>Page introuvable</h1>
        <p className="auth__texte">Cette page n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="bouton bouton--principal">Retour à l&apos;accueil</Link>
      </div>
    </main>
  );
}
