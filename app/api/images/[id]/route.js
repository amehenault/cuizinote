import { q1 } from '@/lib/db';
import { ErreurHttp, route, verifierUuid } from '@/lib/http';

export const GET = route(async ({ utilisateur, params }) => {
  // Visible par sa propriétaire, ou par tous si elle illustre un aliment commun ou une recette publiée.
  const image = await q1(
    `SELECT i.type_mime, i.donnees FROM images i
      WHERE i.id = $1
        AND (i.utilisateur_id = $2
             OR EXISTS (SELECT 1 FROM aliments a WHERE a.image_id = i.id)
             OR EXISTS (SELECT 1 FROM recettes r WHERE r.image_id = i.id AND r.publiee))`,
    [verifierUuid(params.id), utilisateur.id]
  );
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
