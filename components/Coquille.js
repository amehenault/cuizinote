'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Bot,
  BookOpen,
  CalendarDays,
  ChefHat,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Refrigerator,
  Settings,
  Apple,
  UsersRound,
} from 'lucide-react';
import { api } from '@/lib/client';

// bureau : visible seulement dans le menu latéral (ordinateur). Sur téléphone, ces pages
// sont accessibles par des boutons dans les pages (Inventaire, Recettes, Accueil).
const LIENS = [
  { href: '/', libelle: 'Accueil', Icone: LayoutDashboard },
  { href: '/recettes', libelle: 'Recettes', Icone: BookOpen },
  { href: '/communaute', libelle: 'Communauté', Icone: UsersRound, bureau: true },
  { href: '/planificateur', libelle: 'Semaine', Icone: CalendarDays },
  { href: '/inventaire', libelle: 'Inventaire', Icone: Refrigerator },
  { href: '/aliments', libelle: 'Aliments', Icone: Apple, bureau: true },
  { href: '/assistant', libelle: 'Assistant', Icone: Bot, bureau: true },
  { href: '/sante', libelle: 'Santé', Icone: HeartPulse },
  { href: '/parametres', libelle: 'Paramètres', Icone: Settings },
];

export default function Coquille({ nom, children }) {
  const chemin = usePathname();
  // Page Aliments ouverte depuis Recettes ou Inventaire : cette section reste surlignée sur téléphone.
  const de = useSearchParams().get('de');

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
          {LIENS.map(({ href, libelle, Icone, bureau }) => {
            const actif = href === '/' ? chemin === '/' : chemin.startsWith(href);
            const dansSection = !actif && chemin.startsWith('/aliments') && href === `/${de}`;
            return (
              <li key={href} className={`nav__element${bureau ? ' nav__element--bureau' : ''}`}>
                <Link
                  href={href}
                  className={`nav__lien${actif ? ' nav__lien--actif' : ''}${dansSection ? ' nav__lien--section' : ''}`}
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
          <button type="button" className="bouton bouton--fantome bouton--petit nav__deconnexion" onClick={deconnecter}>
            <LogOut size={16} aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      </nav>
      <main className="app__contenu">{children}</main>
    </div>
  );
}
