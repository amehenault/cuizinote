import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { MOMENTS } from '@/lib/schemas';

const schemaModification = z.object({
  kcal: z.number().min(0).max(20000).nullable().optional(),
  moment: z.enum(MOMENTS).optional(),
  libelle: z.string().trim().min(1).max(200).optional(),
});

/** Corrige les calories, le moment ou le nom d'une entrée du journal. */
export const PATCH = route(async ({ requete, utilisateur, params }) => {
  const d = await lireCorps(requete, schemaModification);
  const ligne = await q1(
    // Calories changées à la main : elles ne seront plus recalculées (kcal_manuel).
    `UPDATE journal SET kcal = CASE WHEN $1::boolean THEN $2 ELSE kcal END,
            kcal_manuel = kcal_manuel OR ($1::boolean AND $2::numeric IS DISTINCT FROM round(kcal)),
            moment = coalesce($3, moment), libelle = coalesce($4, libelle)
      WHERE id = $5 AND utilisateur_id = $6 RETURNING id`,
    [d.kcal !== undefined, d.kcal ?? null, d.moment ?? null, d.libelle ?? null, verifierUuid(params.id), utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Entrée introuvable');
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  const [ligne] = await q('DELETE FROM journal WHERE id = $1 AND utilisateur_id = $2 RETURNING planification_id', [
    verifierUuid(params.id),
    utilisateur.id,
  ]);
  // Si le repas venait du menu, il redevient « non mangé ».
  if (ligne?.planification_id) {
    await q(
      `UPDATE planification SET mange = false WHERE id = $1 AND utilisateur_id = $2
         AND NOT EXISTS (SELECT 1 FROM journal WHERE planification_id = $1)`,
      [ligne.planification_id, utilisateur.id]
    );
  }
  return ok({ ok: true });
});
