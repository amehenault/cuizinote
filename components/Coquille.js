'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  BookOpen,
  CalendarDays,
  ChefHat,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Refrigerator,
  ShoppingCart,
  Apple,
} from 'lucide-react';
import { api } from '@/lib/client';

const LIENS = [
  { href: '/', libelle: 'Accueil', Icone: LayoutDashboard },
  { href: '/recettes', libelle: 'Recettes', Icone: BookOpen },
  { href: '/planificateur', libelle: 'Semaine', Icone: CalendarDays },
  { href: '/inventaire', libelle: 'Inventaire', Icone: Refrigerator },
  { href: '/epicerie', libelle: 'Épicerie', Icone: ShoppingCart },
  { href: '/aliments', libelle: 'Aliments', Icone: Apple },
  { href: '/assistant', libelle: 'Assistant', Icone: Bot },
  { href: '/sante', libelle: 'Santé', Icone: HeartPulse },
];

export default function Coquille({ nom, children }) {
  const chemin = usePathname();

  async function deconnecter() {
    await api('/api/auth/deconnexion', { methode: 'POST' }).catch(() => {});
    window.location.assign('/connexion');
  }

  return (
    <div className="app">
      <nav className="nav" aria-label="Navigation principale">
        <Link href="/" className="nav__marque">
          <ChefHat size={26} aria-hidden="true" />
          Cuizinote
        </Link>
        <ul className="nav__liste">
          {LIENS.map(({ href, libelle, Icone }) => {
            const actif = href === '/' ? chemin === '/' : chemin.startsWith(href);
            return (
              <li key={href} className="nav__element">
                <Link
                  href={href}
                  className={`nav__lien${actif ? ' nav__lien--actif' : ''}`}
                  aria-current={actif ? 'page' : undefined}
                >
                  <Icone size={20} aria-hidden="true" />
                  <span className="nav__libelle">{libelle}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="nav__pied">
          <p className="nav__utilisateur">Connecté : {nom}</p>
          <button type="button" className="bouton bouton--fantome bouton--petit" onClick={deconnecter}>
            <LogOut size={16} aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      </nav>
      <main className="app__contenu">{children}</main>
    </div>
  );
}
