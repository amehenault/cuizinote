import { z } from 'zod';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';
import { listerJournal } from '@/lib/planification';

export const GET = route(async ({ requete, utilisateur }) => {
  // La date du jour vient du navigateur pour respecter le fuseau horaire de l'utilisateur.
  const jour = z.iso.date().safeParse(requete.nextUrl.searchParams.get('jour'));
  if (!jour.success) throw new ErreurHttp(400, 'Date invalide');

  const [journal, poids, pas, expirent, totaux] = await Promise.all([
    listerJournal(utilisateur.id, jour.data),
    q(
      `SELECT mesure_le, poids_kg::float, source FROM poids WHERE utilisateur_id = $1 ORDER BY mesure_le DESC LIMIT 2`,
      [utilisateur.id]
    ),
    q(
      `SELECT to_char(jour, 'YYYY-MM-DD') AS jour, nombre, source FROM pas
        WHERE utilisateur_id = $1 AND jour > $2::date - 7 AND jour <= $2::date ORDER BY jour`,
      [utilisateur.id, jour.data]
    ),
    q(
      `SELECT id, nom, emplacement, to_char(expire_le, 'YYYY-MM-DD') AS expire_le FROM inventaire
        WHERE utilisateur_id = $1 AND expire_le IS NOT NULL AND expire_le <= $2::date + 3
        ORDER BY expire_le LIMIT 10`,
      [utilisateur.id, jour.data]
    ),
    q1(
      `SELECT (SELECT count(*) FROM recettes WHERE utilisateur_id = $1)::int AS recettes,
              (SELECT count(*) FROM aliments WHERE utilisateur_id = $1)::int AS aliments,
              (SELECT count(*) FROM inventaire WHERE utilisateur_id = $1)::int AS inventaire,
              (SELECT count(*) FROM epicerie WHERE utilisateur_id = $1 AND NOT coche)::int AS epicerie`,
      [utilisateur.id]
    ),
  ]);

  return ok({
    utilisateur: { nom: utilisateur.nom, objectif_kcal: utilisateur.objectif_kcal },
    journal,
    poids,
    pas,
    expirent,
    totaux,
  });
});
