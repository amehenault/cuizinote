import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { MOMENTS } from '@/lib/schemas';

const schemaModification = z.object({
  jour: z.iso.date().optional(),
  moment: z.enum(MOMENTS).optional(),
  portions: z.number().positive().max(100).optional(),
  grammes: z.number().min(0).max(10000).nullable().optional(),
  mange: z.boolean().optional(),
});

export const PATCH = route(async ({ requete, utilisateur, params }) => {
  const d = await lireCorps(requete, schemaModification);
  const ligne = await q1(
    `UPDATE planification SET
        jour = coalesce($1, jour), moment = coalesce($2, moment), portions = coalesce($3, portions),
        grammes = CASE WHEN $4::boolean THEN $5 ELSE grammes END, mange = coalesce($6, mange)
      WHERE id = $7 AND utilisateur_id = $8 RETURNING id`,
    [d.jour ?? null, d.moment ?? null, d.portions ?? null, d.grammes !== undefined, d.grammes ?? null,
      d.mange ?? null, verifierUuid(params.id), utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Repas introuvable');
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM planification WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
