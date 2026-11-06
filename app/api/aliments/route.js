import { COLONNES_ALIMENT } from '@/lib/colonnes';
import { q, q1 } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaAliment } from '@/lib/schemas';

export const GET = route(async ({ requete, utilisateur }) => {
  const recherche = (requete.nextUrl.searchParams.get('q') || '').slice(0, 100);
  return ok(
    await q(
      `SELECT ${COLONNES_ALIMENT} FROM aliments
        WHERE utilisateur_id = $1 AND ($2 = '' OR nom ILIKE '%' || $2 || '%' OR marque ILIKE '%' || $2 || '%' OR code_barre = $2)
        ORDER BY nom LIMIT ${recherche ? 30 : 500}`,
      [utilisateur.id, recherche.replace(/[%_\\]/g, '\\$&')]
    )
  );
});

export const POST = route(async ({ requete, utilisateur }) => {
  const a = await lireCorps(requete, schemaAliment);
  const ligne = await q1(
    `INSERT INTO aliments (utilisateur_id, nom, marque, code_barre, kcal_100g, proteines_100g, glucides_100g,
            lipides_100g, fibres_100g, sucres_100g, sel_100g, portion_g, image_url, unite)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (utilisateur_id, code_barre) DO UPDATE SET
       nom = EXCLUDED.nom, marque = EXCLUDED.marque, kcal_100g = EXCLUDED.kcal_100g,
       proteines_100g = EXCLUDED.proteines_100g, glucides_100g = EXCLUDED.glucides_100g,
       lipides_100g = EXCLUDED.lipides_100g, fibres_100g = EXCLUDED.fibres_100g,
       sucres_100g = EXCLUDED.sucres_100g, sel_100g = EXCLUDED.sel_100g,
       portion_g = EXCLUDED.portion_g, image_url = EXCLUDED.image_url, unite = EXCLUDED.unite
     RETURNING ${COLONNES_ALIMENT}`,
    [utilisateur.id, a.nom, a.marque, a.code_barre, a.kcal_100g, a.proteines_100g, a.glucides_100g,
      a.lipides_100g, a.fibres_100g, a.sucres_100g, a.sel_100g, a.portion_g, a.image_url, a.unite]
  );
  return ok(ligne, 201);
});
