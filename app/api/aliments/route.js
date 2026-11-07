import { COLONNES_ALIMENT } from '@/lib/colonnes';
import { q, q1 } from '@/lib/db';
import { verifierImage } from '@/lib/images';
import { lireCorps, ok, route } from '@/lib/http';
import { schemaAliment } from '@/lib/schemas';

// Banque d'aliments commune à tous les utilisateurs. « mien » : la personne connectée l'a ajouté.
export const GET = route(async ({ requete, utilisateur }) => {
  const recherche = (requete.nextUrl.searchParams.get('q') || '').slice(0, 100);
  return ok(
    await q(
      `SELECT ${COLONNES_ALIMENT}, (utilisateur_id = $1) AS mien, (traduit_le IS NULL) AS a_traduire FROM aliments
        WHERE ($2 = '' OR nom ILIKE '%' || $2 || '%' OR marque ILIKE '%' || $2 || '%' OR code_barre = $2)
        ORDER BY nom LIMIT ${recherche ? 30 : 2000}`,
      [utilisateur.id, recherche.replace(/[%_\\]/g, '\\$&')]
    )
  );
});

export const POST = route(async ({ requete, utilisateur }) => {
  const a = await lireCorps(requete, schemaAliment);
  await verifierImage(utilisateur.id, a.image_id);
  // Code-barres déjà connu dans la banque commune : on met à jour la fiche existante.
  const ligne = await q1(
    `INSERT INTO aliments (utilisateur_id, nom, marque, code_barre, kcal_100g, proteines_100g, glucides_100g,
            lipides_100g, fibres_100g, sucres_100g, sel_100g, portion_g, image_url, unite, portion_texte, sodium_100g, image_id, contenant_qte, contenant_unite, traduit_le)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now())
     ON CONFLICT (code_barre) DO UPDATE SET
       nom = EXCLUDED.nom, marque = EXCLUDED.marque, kcal_100g = EXCLUDED.kcal_100g,
       proteines_100g = EXCLUDED.proteines_100g, glucides_100g = EXCLUDED.glucides_100g,
       lipides_100g = EXCLUDED.lipides_100g, fibres_100g = EXCLUDED.fibres_100g,
       sucres_100g = EXCLUDED.sucres_100g, sel_100g = EXCLUDED.sel_100g,
       portion_g = EXCLUDED.portion_g, image_url = EXCLUDED.image_url, unite = EXCLUDED.unite,
       portion_texte = EXCLUDED.portion_texte, sodium_100g = EXCLUDED.sodium_100g,
       image_id = coalesce(EXCLUDED.image_id, aliments.image_id),
       contenant_qte = coalesce(EXCLUDED.contenant_qte, aliments.contenant_qte),
       contenant_unite = coalesce(EXCLUDED.contenant_unite, aliments.contenant_unite), traduit_le = now()
     RETURNING ${COLONNES_ALIMENT}, (utilisateur_id = $1) AS mien`,
    [utilisateur.id, a.nom, a.marque, a.code_barre, a.kcal_100g, a.proteines_100g, a.glucides_100g,
      a.lipides_100g, a.fibres_100g, a.sucres_100g, a.sel_100g, a.portion_g, a.image_url, a.unite, a.portion_texte,
      a.sodium_100g, a.image_id, a.contenant_qte, a.contenant_qte ? a.contenant_unite || a.unite : null]
  );
  return ok(ligne, 201);
});
