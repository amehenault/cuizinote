import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';

const schemaModification = z.object({
  coche: z.boolean().optional(),
  nom: z.string().trim().min(1).max(200).optional(),
  quantite: z.string().trim().max(60).nullable().optional(),
});

export const PATCH = route(async ({ requete, utilisateur, params }) => {
  const d = await lireCorps(requete, schemaModification);
  const ligne = await q1(
    `UPDATE epicerie SET coche = coalesce($1, coche), nom = coalesce($2, nom),
            quantite = CASE WHEN $3::boolean THEN $4 ELSE quantite END
      WHERE id = $5 AND utilisateur_id = $6 RETURNING id, nom, quantite, rayon, coche`,
    [d.coche ?? null, d.nom ?? null, d.quantite !== undefined, d.quantite || null, verifierUuid(params.id), utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Article introuvable');
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM epicerie WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
