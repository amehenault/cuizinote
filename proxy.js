import { NextResponse } from 'next/server';

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

export function proxy(requete) {
  const { pathname } = requete.nextUrl;

  // API : refus des requêtes qui modifient des données depuis une autre origine (CSRF).
  if (pathname.startsWith('/api/')) {
    if (!METHODES_SURES.has(requete.method)) {
      const origine = requete.headers.get('origin');
      const hote = requete.headers.get('x-forwarded-host') || requete.headers.get('host');
      let valide = false;
      try {
        valide = !!origine && new URL(origine).host === hote;
      } catch {
        valide = false;
      }
      if (!valide) return NextResponse.json({ erreur: 'Origine refusée' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Pages : politique de sécurité du contenu stricte avec nonce unique par requête.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://images.openfoodfacts.org",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    dev ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ');

  const entetes = new Headers(requete.headers);
  entetes.set('x-nonce', nonce);
  entetes.set('Content-Security-Policy', csp);
  const reponse = NextResponse.next({ request: { headers: entetes } });
  reponse.headers.set('Content-Security-Policy', csp);
  return reponse;
}

export const config = {
  matcher: [
    '/api/:path*',
    {
      source: '/((?!api/|_next/static|_next/image|favicon.ico|icone.svg|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
