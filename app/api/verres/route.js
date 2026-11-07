import { q, q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { schemaVerre } from '@/lib/schemas';

/** Verres et tasses de la personne connectée (jamais ceux des autres). */
export const GET = route(async ({ utilisateur }) =>
  ok(await q('SELECT id, nom, ml::float FROM verres WHERE utilisateur_id = $1 ORDER BY ml, nom', [utilisateur.id]))
);

export const POST = route(async ({ requete, utilisateur }) => {
  const d = await lireCorps(requete, schemaVerre);
  const { total } = await q1('SELECT count(*)::int AS total FROM verres WHERE utilisateur_id = $1', [utilisateur.id]);
  if (total >= 100) throw new ErreurHttp(400, 'Maximum de 100 verres');
  return ok(
    await q1('INSERT INTO verres (utilisateur_id, nom, ml) VALUES ($1, $2, $3) RETURNING id, nom, ml::float', [utilisateur.id, d.nom, d.ml]),
    201
  );
});
