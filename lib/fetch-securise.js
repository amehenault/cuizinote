import 'server-only';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { ErreurHttp } from './http';

/** Vrai si l'adresse IP est privée, locale, réservée ou de type métadonnées cloud. */
function ipInterdite(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return ipInterdite(v6.slice(7));
  return (
    v6 === '::' || v6 === '::1' ||
    v6.startsWith('fc') || v6.startsWith('fd') ||
    v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') ||
    v6.startsWith('ff')
  );
}

async function verifierUrl(brute) {
  let url;
  try {
    url = new URL(brute);
  } catch {
    throw new ErreurHttp(400, 'Lien invalide');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ErreurHttp(400, 'Seuls les liens http(s) sont acceptés');
  if (url.username || url.password) throw new ErreurHttp(400, 'Lien invalide');
  if (url.port && !['80', '443'].includes(url.port)) throw new ErreurHttp(400, 'Port non autorisé');
  const hote = url.hostname.replace(/^\[|\]$/g, '');
  if (hote === 'localhost' || hote.endsWith('.local') || hote.endsWith('.internal')) {
    throw new ErreurHttp(400, 'Adresse non autorisée');
  }
  const adresses = net.isIP(hote) ? [{ address: hote }] : await lookup(hote, { all: true }).catch(() => []);
  if (!adresses.length) throw new ErreurHttp(400, 'Site introuvable');
  if (adresses.some((a) => ipInterdite(a.address))) throw new ErreurHttp(400, 'Adresse non autorisée');
  return url;
}

/**
 * Télécharge une ressource publique en bloquant les adresses internes (SSRF),
 * en vérifiant chaque redirection, avec délai et taille maximum.
 */
export async function fetchSecurise(brute, { tailleMax = 3_000_000, delaiMs = 10000, accepte = '*/*', binaire = false } = {}) {
  let url = await verifierUrl(brute);
  for (let saut = 0; saut < 4; saut++) {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), delaiMs);
    let reponse;
    try {
      reponse = await fetch(url, {
        redirect: 'manual',
        signal: controleur.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Cuizinote/1.0; lecteur de recettes)',
          Accept: accepte,
          'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
        },
      });
    } catch {
      clearTimeout(minuterie);
      throw new ErreurHttp(502, 'Impossible de joindre le site');
    }
    if (reponse.status >= 300 && reponse.status < 400 && reponse.headers.get('location')) {
      clearTimeout(minuterie);
      url = await verifierUrl(new URL(reponse.headers.get('location'), url).toString());
      continue;
    }
    if (!reponse.ok) {
      clearTimeout(minuterie);
      if ([401, 402, 403, 429].includes(reponse.status)) {
        throw new ErreurHttp(502, 'Ce site bloque la lecture automatique. Copiez la recette à la main.');
      }
      throw new ErreurHttp(502, `Le site a répondu ${reponse.status}`);
    }
    const annonce = Number(reponse.headers.get('content-length') || 0);
    if (annonce > tailleMax) {
      clearTimeout(minuterie);
      throw new ErreurHttp(413, 'Ressource trop volumineuse');
    }
    // Lecture en flux avec plafond
    const lecteur = reponse.body.getReader();
    const morceaux = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        total += value.length;
        if (total > tailleMax) {
          await lecteur.cancel();
          throw new ErreurHttp(413, 'Ressource trop volumineuse');
        }
        morceaux.push(value);
      }
    } finally {
      clearTimeout(minuterie);
    }
    const tampon = Buffer.concat(morceaux);
    return {
      url: url.toString(),
      typeContenu: reponse.headers.get('content-type') || '',
      contenu: binaire ? tampon : tampon.toString('utf8'),
    };
  }
  throw new ErreurHttp(502, 'Trop de redirections');
}
