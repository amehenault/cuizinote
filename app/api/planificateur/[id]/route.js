import { z } from 'zod';
import { q, q1, transaction } from '@/lib/db';
import { requeteJournalDepuisPlan } from '@/lib/planification';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';
import { MOMENTS } from '@/lib/schemas';

const schemaModification = z.object({
  jour: z.iso.date().optional(),
  moment: z.enum(MOMENTS).optional(),
  portions: z.number().positive().max(100).optional(),
  grammes: z.number().min(0).max(10000).nullable().optional(),
  mange: z.boolean().optional(),
  // Date où le repas a réellement été mangé (par défaut : le jour planifié)
  jour_mange: z.iso.date().optional(),
});

export const PATCH = route(async ({ requete, utilisateur, params }) => {
  const d = await lireCorps(requete, schemaModification);
  const id = verifierUuid(params.id);
  const avant = await q1('SELECT mange FROM planification WHERE id = $1 AND utilisateur_id = $2', [id, utilisateur.id]);
  if (!avant) throw new ErreurHttp(404, 'Repas introuvable');
  const ligne = await q1(
    `UPDATE planification SET
        jour = coalesce($1, jour), moment = coalesce($2, moment), portions = coalesce($3, portions),
        grammes = CASE WHEN $4::boolean THEN $5 ELSE grammes END, mange = coalesce($6, mange)
      WHERE id = $7 AND utilisateur_id = $8 RETURNING id`,
    [d.jour ?? null, d.moment ?? null, d.portions ?? null, d.grammes !== undefined, d.grammes ?? null,
      d.mange ?? null, id, utilisateur.id]
  );
  if (!ligne) throw new ErreurHttp(404, 'Repas introuvable');

  // Manger un repas du menu l'ajoute au journal ; l'annuler l'en retire.
  if (d.mange === true && !avant.mange) {
    await transaction([requeteJournalDepuisPlan(id, utilisateur.id, d.jour_mange ?? null)]);
  } else if (d.mange === false && avant.mange) {
    await q('DELETE FROM journal WHERE planification_id = $1 AND utilisateur_id = $2', [id, utilisateur.id]);
  }
  return ok(ligne);
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM planification WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
