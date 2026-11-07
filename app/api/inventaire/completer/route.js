import { q } from '@/lib/db';
import { ok, route } from '@/lib/http';
import { estimerContenants } from '@/lib/ia';
import { limiter } from '@/lib/limite';
import { produitParCodeBarre } from '@/lib/openfoodfacts';

export const maxDuration = 60;

const LOT_OFF = 12;
const EN_PARALLELE = 4;
const LOT_IA = 40;

// Produits de la personne : ceux qu'elle a ajoutés à la banque et ceux de son inventaire.
const MES_PRODUITS = `(a.utilisateur_id = $1 OR a.id IN (SELECT aliment_id FROM inventaire WHERE utilisateur_id = $1))`;
const A_CHERCHER_OFF = `${MES_PRODUITS} AND a.code_barre IS NOT NULL AND a.contenant_qte IS NULL AND a.contenant_verifie_le IS NULL`;
const A_ESTIMER = `${MES_PRODUITS} AND a.contenant_qte IS NULL AND a.contenant_estime_le IS NULL
  AND (a.code_barre IS NULL OR a.contenant_verifie_le IS NOT NULL)`;
const ARTICLES_A_ESTIMER = `utilisateur_id = $1 AND aliment_id IS NULL AND format_estime_le IS NULL
  AND (quantite IS NULL OR quantite = 1) AND coalesce(unite, '') = ''`;

/** « × 893 ml », « × 1,89 L », « × 2 kg » (même présentation que lib/portion.js). */
function libelle(qte, unite) {
  const nombre = (n) => Number(n).toLocaleString('fr-CA', { maximumFractionDigits: 2 });
  return qte >= 1000 ? `× ${nombre(qte / 1000)} ${unite === 'ml' ? 'L' : 'kg'}` : `× ${nombre(qte)} ${unite}`;
}

/**
 * Complète automatiquement l'inventaire de la personne :
 * 1. format du contenant de ses produits par code-barres (Open Food Facts), une fois par produit ;
 * 2. sinon, format habituel estimé par l'IA (nom et marque), une fois par produit ;
 * 3. quantités vides : un contenant complet (1 × 893 ml), ou 1 si le format reste inconnu.
 * Traite un lot par appel ; le navigateur rappelle tant qu'il en reste.
 */
export const POST = route(async ({ utilisateur }) => {
  await limiter(`completer:${utilisateur.id}`, 200, 3600);
  const u = utilisateur.id;
  let trouves = 0;
  let estimes = 0;
  let erreur = null;

  // 1. Open Food Facts
  const parCode = await q(`SELECT a.id, a.code_barre FROM aliments a WHERE ${A_CHERCHER_OFF} ORDER BY a.cree_le LIMIT ${LOT_OFF}`, [u]);
  for (let i = 0; i < parCode.length; i += EN_PARALLELE) {
    const resultats = await Promise.all(
      parCode.slice(i, i + EN_PARALLELE).map((a) =>
        produitParCodeBarre(a.code_barre, { traduire: false })
          .then((p) => ({ a, p, reussi: true }))
          .catch((e) => {
            // Code-barres refusé : inutile de réessayer. Sinon (service indisponible), on réessaiera.
            if (e?.statut === 400) return { a, p: null, reussi: true };
            erreur = `Open Food Facts : ${e?.message || e}`;
            return { a, reussi: false };
          })
      )
    );
    for (const { a, p, reussi } of resultats) {
      if (!reussi) continue;
      if (p?.contenant_qte) trouves += 1;
      await q(
        `UPDATE aliments SET contenant_qte = coalesce(contenant_qte, $2), contenant_unite = coalesce(contenant_unite, $3),
                contenant_verifie_le = now() WHERE id = $1`,
        [a.id, p?.contenant_qte ?? null, p?.contenant_qte ? p.contenant_unite : null]
      );
    }
  }

  // 2. Estimation par l'IA : produits sans code-barres ou inconnus d'Open Food Facts
  if (!parCode.length) {
    const sansFormat = await q(`SELECT a.id, a.nom, a.marque FROM aliments a WHERE ${A_ESTIMER} ORDER BY a.cree_le LIMIT ${LOT_IA}`, [u]);
    if (sansFormat.length) {
      const formats = await estimerContenants(sansFormat);
      if (!formats) erreur = 'Estimation des formats indisponible pour le moment';
      else {
        estimes += formats.filter(Boolean).length;
        await q(
          `UPDATE aliments a SET contenant_qte = coalesce(a.contenant_qte, t.qte), contenant_unite = coalesce(a.contenant_unite, t.unite),
                  contenant_estime_le = now()
             FROM unnest($1::uuid[], $2::numeric[], $3::text[]) AS t(id, qte, unite) WHERE a.id = t.id`,
          [sansFormat.map((a) => a.id), formats.map((f) => f?.qte ?? null), formats.map((f) => f?.unite ?? null)]
        );
      }
    } else {
      // Articles d'inventaire non liés à un produit : format estimé d'après leur nom
      const articles = await q(`SELECT id, nom FROM inventaire WHERE ${ARTICLES_A_ESTIMER} ORDER BY ajoute_le LIMIT ${LOT_IA}`, [u]);
      if (articles.length) {
        const formats = await estimerContenants(articles);
        if (!formats) erreur = 'Estimation des formats indisponible pour le moment';
        else {
          estimes += formats.filter(Boolean).length;
          await q(
            `UPDATE inventaire i SET format_estime_le = now(),
                    quantite = CASE WHEN t.unite IS NULL THEN i.quantite ELSE 1 END, unite = coalesce(t.unite, i.unite)
               FROM unnest($1::uuid[], $2::text[]) AS t(id, unite) WHERE i.id = t.id AND i.utilisateur_id = $3`,
            [articles.map((a) => a.id), formats.map((f) => (f ? libelle(f.qte, f.unite) : null)), u]
          );
        }
      }
    }
  }

  // 3. Quantités vides ou « 1 » sans unité : un contenant complet du produit lié
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
    [u]
  );
  const uns = await q('UPDATE inventaire SET quantite = 1 WHERE utilisateur_id = $1 AND quantite IS NULL RETURNING id', [u]);

  const [{ restant }] = await q(
    `SELECT (SELECT count(*) FROM aliments a WHERE ${A_CHERCHER_OFF})::int
          + (SELECT count(*) FROM aliments a WHERE ${A_ESTIMER})::int
          + (SELECT count(*) FROM inventaire WHERE ${ARTICLES_A_ESTIMER})::int AS restant`,
    [u]
  );
  return ok({ trouves, estimes, erreur, quantites: completes.length + uns.length, restant });
});
