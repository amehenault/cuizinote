import { z } from 'zod';
import { q } from '@/lib/db';
import { lireCorps, ok, route } from '@/lib/http';
import { clesRangement } from '@/lib/rangement';

/** Rangements par défaut de la personne : { cle: emplacement }. */
export const GET = route(async ({ utilisateur }) => {
  const lignes = await q('SELECT cle, emplacement FROM rangements WHERE utilisateur_id = $1', [utilisateur.id]);
  return ok(Object.fromEntries(lignes.map((l) => [l.cle, l.emplacement])));
});

const schema = z.object({
  aliment_id: z.uuid().nullish(),
  nom: z.string().trim().max(200).nullish(),
  emplacement: z.enum(['frigo', 'congelateur', 'garde-manger']),
});

/** Enregistre le rangement par défaut d'un produit. */
export const PUT = route(async ({ requete, utilisateur }) => {
  const p = await lireCorps(requete, schema);
  const cles = clesRangement(p);
  if (cles.length) {
    await q(
      `INSERT INTO rangements (utilisateur_id, cle, emplacement) SELECT $1, unnest($2::text[]), $3
       ON CONFLICT (utilisateur_id, cle) DO UPDATE SET emplacement = EXCLUDED.emplacement, modifie_le = now()`,
      [utilisateur.id, cles, p.emplacement]
    );
  }
  return ok({ ok: true });
});
