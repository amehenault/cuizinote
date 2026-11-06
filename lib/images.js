import 'server-only';
import { q1 } from './db';
import { ErreurHttp } from './http';

export const TAILLE_MAX_IMAGE = 2_500_000;

/** Détecte le type réel d'une image à partir de ses premiers octets (pas du nom ni de l'en-tête). */
export function detecterType(tampon) {
  if (tampon.length < 12) return null;
  if (tampon[0] === 0xff && tampon[1] === 0xd8 && tampon[2] === 0xff) return 'image/jpeg';
  if (tampon.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (tampon.toString('ascii', 0, 4) === 'RIFF' && tampon.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function enregistrerImage(utilisateurId, tampon) {
  if (tampon.length > TAILLE_MAX_IMAGE) throw new ErreurHttp(413, 'Image trop volumineuse (2,5 Mo maximum)');
  const type = detecterType(tampon);
  if (!type) throw new ErreurHttp(415, 'Format accepté : JPEG, PNG ou WebP');
  const ligne = await q1(
    'INSERT INTO images (utilisateur_id, type_mime, donnees) VALUES ($1, $2, $3) RETURNING id',
    [utilisateurId, type, tampon.toString('base64')]
  );
  return ligne.id;
}
