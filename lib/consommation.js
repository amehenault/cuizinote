import 'server-only';
import { q, q1 } from './db';

// Ce qui est mangé (journal) est retiré de l'inventaire ; annuler le repas le remet.
// Seuls les aliments liés à la banque d'aliments (aliment_id) sont reconnus.

const FACTEURS = { g: 1, kg: 1000, ml: 1, l: 1000, lb: 453.592 };

/**
 * Quantité d'inventaire (dans l'unité de l'article) correspondant à `base` g ou ml mangés, ou null.
 * « × 893 ml » : en contenants ; « g », « kg », « L »... : directement ; « unité », « têtes »... : en portions ; sans unité : null.
 */
function versUniteInventaire(base, unite, portionG) {
  const u = String(unite || '').trim().toLowerCase().replace(',', '.');
  const contenant = u.match(/^×\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|lb)$/);
  if (contenant) {
    const taille = Number(contenant[1]) * FACTEURS[contenant[2]];
    return taille > 0 ? base / taille : null;
  }
  if (FACTEURS[u]) return base / FACTEURS[u];
  // Sans unité : souvent un paquet de format inconnu, on n'y touche pas. Unité de compte (« unité », « têtes ») : en portions.
  if (!u) return null;
  return portionG > 0 ? base / portionG : null;
}

/** Grammes (ou ml) mangés par aliment pour une entrée du journal. */
async function quantitesMangees(journalId, utilisateurId) {
  return q(
    `SELECT a.id AS aliment_id, a.portion_g::float AS portion_g, sum(x.base)::float AS base
       FROM journal j
       CROSS JOIN LATERAL (
         SELECT j.aliment_id AS aliment_id,
                coalesce(j.grammes, (SELECT portion_g FROM aliments WHERE id = j.aliment_id), 100) * j.portions AS base
          WHERE j.recette_id IS NULL AND j.aliment_id IS NOT NULL
         UNION ALL
         SELECT ri.aliment_id, ri.grammes * j.portions / nullif(r.portions, 0)
           FROM recette_ingredients ri JOIN recettes r ON r.id = ri.recette_id
          WHERE ri.recette_id = j.recette_id AND ri.aliment_id IS NOT NULL AND ri.grammes > 0
       ) x
       JOIN aliments a ON a.id = x.aliment_id
      WHERE j.id = $1 AND j.utilisateur_id = $2 AND x.base > 0
      GROUP BY a.id, a.portion_g`,
    [journalId, utilisateurId]
  );
}

/** Retire de l'inventaire ce que l'entrée du journal a consommé et le note dans l'entrée. */
export async function retirerDeInventaire(journalId, utilisateurId) {
  const dejaFait = await q1('SELECT retraits_inventaire IS NOT NULL AS fait FROM journal WHERE id = $1', [journalId]);
  if (!dejaFait || dejaFait.fait) return [];

  const retraits = [];
  for (const m of await quantitesMangees(journalId, utilisateurId)) {
    // Les articles qui expirent en premier sont utilisés d'abord.
    const articles = await q(
      `SELECT id, emplacement, nom, aliment_id, quantite::float, unite, to_char(expire_le, 'YYYY-MM-DD') AS expire_le,
              to_char(ajoute_le, 'YYYY-MM-DD') AS ajoute_le, format_estime_le
         FROM inventaire WHERE utilisateur_id = $1 AND aliment_id = $2 AND quantite > 0
        ORDER BY expire_le NULLS LAST, ajoute_le, id`,
      [utilisateurId, m.aliment_id]
    );
    let reste = m.base;
    for (const art of articles) {
      if (reste <= 0) break;
      const besoin = versUniteInventaire(reste, art.unite, m.portion_g);
      if (besoin == null) continue;
      const retire = Math.min(besoin, art.quantite);
      const nouvelle = Math.round((art.quantite - retire) * 100) / 100;
      if (nouvelle <= 0) await q('DELETE FROM inventaire WHERE id = $1', [art.id]);
      else await q('UPDATE inventaire SET quantite = $1 WHERE id = $2', [nouvelle, art.id]);
      retraits.push({ article: art, retire: art.quantite - Math.max(nouvelle, 0) });
      reste -= (reste * retire) / besoin;
    }
  }
  await q('UPDATE journal SET retraits_inventaire = $1::jsonb WHERE id = $2', [JSON.stringify(retraits), journalId]);
  return retraits;
}

/** Remet dans l'inventaire ce qu'une entrée du journal (supprimée) avait retiré. */
export async function remettreDansInventaire(retraits, utilisateurId) {
  for (const { article: a, retire } of retraits || []) {
    if (!(retire > 0)) continue;
    const maj = await q1(
      'UPDATE inventaire SET quantite = round(coalesce(quantite, 0) + $1, 2) WHERE id = $2 AND utilisateur_id = $3 RETURNING id',
      [retire, a.id, utilisateurId]
    );
    if (maj) continue;
    // L'article avait été vidé (donc supprimé) : on le recrée.
    await q(
      `INSERT INTO inventaire (id, utilisateur_id, emplacement, nom, aliment_id, quantite, unite, expire_le, ajoute_le, format_estime_le)
       VALUES ($1, $2, $3, $4, (SELECT id FROM aliments WHERE id = $5), round($6::numeric, 2), $7, $8, coalesce($9::date, current_date), $10)
       ON CONFLICT (id) DO UPDATE SET quantite = round(coalesce(inventaire.quantite, 0) + $6::numeric, 2)`,
      [a.id, utilisateurId, a.emplacement, a.nom, a.aliment_id, retire, a.unite, a.expire_le, a.ajoute_le, a.format_estime_le]
    );
  }
}
