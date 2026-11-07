'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Apple, BookOpen, Bot, UsersRound } from 'lucide-react';

// Pages de la section Recettes : les onglets restent affichés sur chacune d'elles.
const ONGLETS = [
  { href: '/recettes', libelle: 'Mes recettes', Icone: BookOpen },
  { href: '/assistant', libelle: 'Assistant', Icone: Bot },
  { href: '/communaute', libelle: 'Communauté', Icone: UsersRound },
  { href: '/aliments', libelle: 'Aliments', Icone: Apple },
];

export default function OngletsRecettes() {
  const chemin = usePathname();
  return (
    <nav className="onglets onglets--section" aria-label="Section recettes">
      {ONGLETS.map(({ href, libelle, Icone }) => {
        const actif = chemin === href || chemin.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`onglets__bouton${actif ? ' onglets__bouton--actif' : ''}`}
            aria-current={actif ? 'page' : undefined}
          >
            <Icone size={16} aria-hidden="true" />
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
