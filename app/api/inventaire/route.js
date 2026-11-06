import { COLONNES_INVENTAIRE } from '@/lib/colonnes';
import { q, q1 } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaInventaire } from '@/lib/schemas';

export const GET = route(async ({ utilisateur }) =>
  ok(
    await q(
      `SELECT i.id, i.emplacement, i.nom, i.aliment_id, i.quantite::float, i.unite,
              to_char(i.expire_le, 'YYYY-MM-DD') AS expire_le, to_char(i.ajoute_le, 'YYYY-MM-DD') AS ajoute_le,
              a.marque, a.nom AS aliment_nom
         FROM inventaire i LEFT JOIN aliments a ON a.id = i.aliment_id
        WHERE i.utilisateur_id = $1
        ORDER BY i.expire_le NULLS LAST, i.nom LIMIT 1000`,
      [utilisateur.id]
    )
  )
);

export const POST = route(async ({ requete, utilisateur }) => {
  const i = await lireCorps(requete, schemaInventaire);
  const ligne = await q1(
    `INSERT INTO inventaire (utilisateur_id, emplacement, nom, aliment_id, quantite, unite, expire_le)
     VALUES ($1, $2, $3,
             (SELECT id FROM aliments WHERE id = $4 AND utilisateur_id = $1),
             $5, $6, $7)
     RETURNING ${COLONNES_INVENTAIRE}`,
    [utilisateur.id, i.emplacement, i.nom, i.aliment_id, i.quantite, i.unite, i.expire_le]
  );
  return ok(ligne, 201);
});
