import { q, q1 } from '@/lib/db';
import { estAdmin } from '@/lib/admin';
import { ErreurHttp, ok, route } from '@/lib/http';

// Quota gratuit de Google Gemini : partagé par toute l'application, remis à zéro chaque jour à minuit, heure du Pacifique.
// Google ne permet pas de lire le quota exact : on compte nos propres appels, comparés à 20 par modèle (GEMINI_LIMITE_MODELE_JOUR).
// Offre gratuite (AI Studio, nov. 2026) : 20 requêtes par jour pour chacun des 3 modèles Flash utilisés.
const PAR_MODELE = Math.max(Number(process.env.GEMINI_LIMITE_MODELE_JOUR) || 20, 1);
const NB_MODELES = 3;

export const GET = route(async ({ utilisateur }) => {
  if (!estAdmin(utilisateur)) throw new ErreurHttp(403, 'Réservé à l’administratrice');
  const limite = PAR_MODELE * NB_MODELES;
  const ligne = await q1(
    `WITH bornes AS (
       SELECT date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles' AS debut,
              (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') + interval '1 day') AT TIME ZONE 'America/Los_Angeles' AS fin
     )
     SELECT b.debut, b.fin,
            count(a.id) FILTER (WHERE a.statut = 200)::int AS utilisees,
            coalesce(max(a.cree_le) FILTER (WHERE a.statut = 999) > coalesce(max(a.cree_le) FILTER (WHERE a.statut = 200), '-infinity'), false) AS epuise
       FROM bornes b LEFT JOIN ia_appels a ON a.cree_le >= b.debut
      GROUP BY b.debut, b.fin`
  );
  const sources = await q(
    `SELECT coalesce(source, 'autre') AS source, count(*)::int AS total FROM ia_appels
      WHERE statut = 200 AND cree_le >= $1 GROUP BY 1 ORDER BY 2 DESC`,
    [ligne.debut]
  );
  // Par modèle : succès du jour, ou plein si Google a répondu « limite du jour atteinte ».
  const modeles = await q(
    `SELECT modele, count(*) FILTER (WHERE statut = 200)::int AS succes, bool_or(statut = 430) AS plein
       FROM ia_appels WHERE cree_le >= $1 AND modele <> 'tous' GROUP BY modele`,
    [ligne.debut]
  );
  const utilisees = Math.min(
    modeles.reduce((t, m) => t + (m.plein ? PAR_MODELE : Math.min(m.succes, PAR_MODELE)), 0),
    limite
  );
  const pourcentage = ligne.epuise ? 100 : Math.round((utilisees / limite) * 100);
  return ok({ utilisees, limite, pourcentage, epuise: ligne.epuise, reinitialisation: ligne.fin, sources });
});
