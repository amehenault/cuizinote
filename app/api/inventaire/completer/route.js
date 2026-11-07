import { q } from '@/lib/db';
import { ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { produitParCodeBarre } from '@/lib/openfoodfacts';

export const maxDuration = 60;

const LOT = 12;
const EN_PARALLELE = 4;

// Produits de la personne : ceux qu'elle a ajoutés à la banque et ceux de son inventaire.
const MES_PRODUITS = `(a.utilisateur_id = $1 OR a.id IN (SELECT aliment_id FROM inventaire WHERE utilisateur_id = $1))`;

/**
 * Complète automatiquement :
 * 1. le format du contenant de ses produits (Open Food Facts, par code-barres), une seule fois par produit ;
 * 2. les quantités vides de son inventaire : un contenant complet (1 × 893 ml).
 * Traite un lot par appel ; le navigateur rappelle tant qu'il en reste.
 */
export const POST = route(async ({ utilisateur }) => {
  await limiter(`completer:${utilisateur.id}`, 120, 3600);
  const aliments = await q(
    `SELECT a.id, a.code_barre FROM aliments a
      WHERE ${MES_PRODUITS} AND a.code_barre IS NOT NULL
        AND a.contenant_qte IS NULL AND a.contenant_verifie_le IS NULL
      ORDER BY a.cree_le LIMIT ${LOT}`,
    [utilisateur.id]
  );

  let trouves = 0;
  for (let i = 0; i < aliments.length; i += EN_PARALLELE) {
    const lot = aliments.slice(i, i + EN_PARALLELE);
    const resultats = await Promise.all(
      lot.map((a) => produitParCodeBarre(a.code_barre).then((p) => ({ a, p, ok: true })).catch(() => ({ a, ok: false })))
    );
    for (const { a, p, ok: reussi } of resultats) {
      // Open Food Facts indisponible : on réessaiera à la prochaine visite.
      if (!reussi) continue;
      if (p?.contenant_qte) trouves += 1;
      await q(
        `UPDATE aliments SET contenant_qte = coalesce(contenant_qte, $2), contenant_unite = coalesce(contenant_unite, $3),
                contenant_verifie_le = now() WHERE id = $1`,
        [a.id, p?.contenant_qte ?? null, p?.contenant_qte ? p.contenant_unite : null]
      );
    }
  }

  // Quantités vides (ou « 1 » sans unité) : un contenant complet du produit lié.
  const completes = await q(
    `UPDATE inventaire i SET quantite = 1,
            unite = '× ' || CASE
              WHEN a.contenant_qte >= 1000 THEN
                replace(trim(trailing '.' FROM trim(trailing '0' FROM round(a.contenant_qte / 1000, 2)::text)), '.', ',')
                || CASE WHEN coalesce(a.contenant_unite, a.unite) = 'ml' THEN ' L' ELSE ' kg' END
              ELSE
                replace(trim(trailing '.' FROM trim(trailing '0' FROM round(a.contenant_qte, 2)::text)), '.', ',')
                || ' ' || coalesce(a.contenant_unite, a.unite)
            END
       FROM aliments a
      WHERE a.id = i.aliment_id AND i.utilisateur_id = $1 AND a.contenant_qte > 0
        AND (i.quantite IS NULL OR i.quantite = 1) AND coalesce(i.unite, '') = ''
      RETURNING i.id`,
    [utilisateur.id]
  );

  const [{ restant }] = await q(
    `SELECT count(*)::int AS restant FROM aliments a
      WHERE ${MES_PRODUITS} AND a.code_barre IS NOT NULL
        AND a.contenant_qte IS NULL AND a.contenant_verifie_le IS NULL`,
    [utilisateur.id]
  );
  // Tout est vérifié : les autres articles sans quantité comptent pour un contenant (1).
  if (!restant) {
    const uns = await q(
      'UPDATE inventaire SET quantite = 1 WHERE utilisateur_id = $1 AND quantite IS NULL RETURNING id',
      [utilisateur.id]
    );
    return ok({ trouves, quantites: completes.length + uns.length, restant });
  }
  return ok({ trouves, quantites: completes.length, restant });
});
