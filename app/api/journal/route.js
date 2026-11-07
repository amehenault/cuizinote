import { z } from 'zod';
import { q1 } from '@/lib/db';
import { ErreurHttp, lireCorps, ok, route } from '@/lib/http';
import { KCAL_RECETTE, listerJournal } from '@/lib/planification';
import { schemaJournal } from '@/lib/schemas';

export const GET = route(async ({ requete, utilisateur }) => {
  const jour = z.iso.date().safeParse(requete.nextUrl.searchParams.get('jour'));
  if (!jour.success) throw new ErreurHttp(400, 'Date invalide');
  return ok(await listerJournal(utilisateur.id, jour.data));
});

/** Ajoute ce qui vient d'être mangé. Les calories sont calculées ici, sauf si elles sont fournies. */
export const POST = route(async ({ requete, utilisateur }) => {
  const d = await lireCorps(requete, schemaJournal);
  let libelle = d.libelle;
  let kcal = d.kcal;
  let grammes = d.grammes;

  if (d.recette_id) {
    const r = await q1(
      `SELECT r.titre, (${KCAL_RECETTE})::float AS kcal_portion FROM recettes r WHERE r.id = $1 AND r.utilisateur_id = $2`,
      [d.recette_id, utilisateur.id]
    );
    if (!r) throw new ErreurHttp(400, 'Recette invalide');
    libelle = libelle || r.titre;
    if (kcal == null && r.kcal_portion != null) kcal = r.kcal_portion * d.portions;
  } else if (d.aliment_id) {
    const a = await q1(
      'SELECT nom, kcal_100g::float, portion_g::float FROM aliments WHERE id = $1',
      [d.aliment_id]
    );
    if (!a) throw new ErreurHttp(400, 'Aliment invalide');
    libelle = libelle || a.nom;
    grammes = grammes ?? a.portion_g ?? 100;
    if (kcal == null && a.kcal_100g != null) kcal = (a.kcal_100g * grammes) / 100 * d.portions;
  }

  const ligne = await q1(
    `INSERT INTO journal (utilisateur_id, jour, moment, libelle, recette_id, aliment_id, portions, grammes, kcal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [utilisateur.id, d.jour, d.moment, libelle, d.recette_id, d.recette_id ? null : d.aliment_id, d.portions, grammes,
      kcal == null ? null : Math.round(kcal)]
  );
  return ok(ligne, 201);
});
