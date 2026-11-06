import { q, q1 } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaEpicerie } from '@/lib/schemas';

export const GET = route(async ({ utilisateur }) =>
  ok(
    await q(
      `SELECT id, nom, quantite, rayon, coche FROM epicerie WHERE utilisateur_id = $1
        ORDER BY coche, rayon NULLS LAST, cree_le LIMIT 1000`,
      [utilisateur.id]
    )
  )
);

export const POST = route(async ({ requete, utilisateur }) => {
  const e = await lireCorps(requete, schemaEpicerie);
  const ligne = await q1(
    `INSERT INTO epicerie (utilisateur_id, nom, quantite, rayon) VALUES ($1,$2,$3,$4)
     RETURNING id, nom, quantite, rayon, coche`,
    [utilisateur.id, e.nom, e.quantite, e.rayon]
  );
  return ok(ligne, 201);
});

/** Supprime les articles cochés. */
export const DELETE = route(async ({ utilisateur }) => {
  await q('DELETE FROM epicerie WHERE utilisateur_id = $1 AND coche', [utilisateur.id]);
  return ok({ ok: true });
});
