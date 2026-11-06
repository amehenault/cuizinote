import { headers } from 'next/headers';
import '@/styles/base.css';
import '@/styles/disposition.css';
import '@/styles/composants.css';
import '@/styles/pages.css';

export const metadata = {
  title: { default: 'Cuizinote', template: '%s | Cuizinote' },
  description: 'Recettes, nutrition, inventaire, planification de repas et suivi santé.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icone.svg', apple: '/icone.svg' },
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2f6b4f',
};

export default async function RootLayout({ children }) {
  // Lecture des en-têtes : force le rendu dynamique pour que le nonce CSP soit appliqué.
  await headers();
  return (
    <html lang="fr-CA">
      <body>{children}</body>
    </html>
  );
}
