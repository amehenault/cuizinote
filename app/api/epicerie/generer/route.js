import { z } from 'zod';
import { q } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';

/**
 * Ajoute à la liste les ingrédients des repas planifiés sur la période,
 * sauf ceux déjà présents dans l'inventaire ou déjà sur la liste.
 */
export const POST = route(async ({ requete, utilisateur }) => {
  const { debut, fin } = await lireCorps(requete, z.object({ debut: z.iso.date(), fin: z.iso.date() }));
  const ajouts = await q(
    `WITH besoins AS (
       SELECT ri.texte AS nom, 'Recettes' AS rayon
         FROM planification p JOIN recette_ingredients ri ON ri.recette_id = p.recette_id
        WHERE p.utilisateur_id = $1 AND p.jour BETWEEN $2 AND $3
       UNION
       SELECT a.nom, 'Aliments' FROM planification p JOIN aliments a ON a.id = p.aliment_id
        WHERE p.utilisateur_id = $1 AND p.jour BETWEEN $2 AND $3
     )
     INSERT INTO epicerie (utilisateur_id, nom, rayon)
     SELECT DISTINCT ON (lower(b.nom)) $1, b.nom, b.rayon FROM besoins b
      WHERE NOT EXISTS (
              SELECT 1 FROM inventaire i
               WHERE i.utilisateur_id = $1 AND length(i.nom) >= 3
                 AND position(lower(i.nom) IN lower(b.nom)) > 0)
        AND NOT EXISTS (
              SELECT 1 FROM epicerie e
               WHERE e.utilisateur_id = $1 AND NOT e.coche AND lower(e.nom) = lower(b.nom))
     RETURNING id`,
    [utilisateur.id, debut, fin]
  );
  return ok({ ajoutes: ajouts.length });
});
