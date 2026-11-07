import { z } from 'zod';
import { q, q1, transaction } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route, verifierUuid } from '@/lib/http';

const schemaNom = z.object({ nom: z.string().trim().min(1).max(40) });

/** Renomme une étiquette. Si le nouveau nom existe déjà, les deux étiquettes sont fusionnées. */
export const PUT = route(async ({ requete, utilisateur, params }) => {
  const id = verifierUuid(params.id);
  const nom = (await lireCorps(requete, schemaNom)).nom.toLowerCase();
  const actuelle = await q1('SELECT id, nom FROM etiquettes WHERE id = $1 AND utilisateur_id = $2', [id, utilisateur.id]);
  if (!actuelle) throw new ErreurHttp(404, 'Introuvable');
  if (actuelle.nom === nom) return ok({ ok: true });

  const cible = await q1('SELECT id FROM etiquettes WHERE utilisateur_id = $1 AND nom = $2', [utilisateur.id, nom]);
  if (!cible) {
    await q('UPDATE etiquettes SET nom = $1 WHERE id = $2 AND utilisateur_id = $3', [nom, id, utilisateur.id]);
    return ok({ ok: true });
  }
  await transaction([
    [
      `INSERT INTO recette_etiquettes (recette_id, etiquette_id)
       SELECT recette_id, $2 FROM recette_etiquettes WHERE etiquette_id = $1 ON CONFLICT DO NOTHING`,
      [id, cible.id],
    ],
    ['DELETE FROM etiquettes WHERE id = $1 AND utilisateur_id = $2', [id, utilisateur.id]],
  ]);
  return ok({ ok: true, fusionnee: true });
});

export const DELETE = route(async ({ utilisateur, params }) => {
  await q('DELETE FROM etiquettes WHERE id = $1 AND utilisateur_id = $2', [verifierUuid(params.id), utilisateur.id]);
  return ok({ ok: true });
});
