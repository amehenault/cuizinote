import { q1 } from '@/lib/db';
import { ErreurHttp, route, verifierUuid } from '@/lib/http';

export const GET = route(async ({ utilisateur, params }) => {
  const image = await q1('SELECT type_mime, donnees FROM images WHERE id = $1 AND utilisateur_id = $2', [
    verifierUuid(params.id),
    utilisateur.id,
  ]);
  if (!image) throw new ErreurHttp(404, 'Image introuvable');
  return new Response(Buffer.from(image.donnees, 'base64'), {
    headers: {
      'Content-Type': image.type_mime,
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
});
