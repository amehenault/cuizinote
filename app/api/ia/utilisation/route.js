import { q1 } from '@/lib/db';
import { ok, route } from '@/lib/http';

// Quota gratuit de Google Gemini : partagé par toute l'application, remis à zéro chaque jour à minuit, heure du Pacifique.
// Google ne permet pas de lire le quota exact : on compte nos propres appels, comparés à GEMINI_LIMITE_JOUR.
// Offre gratuite (AI Studio, nov. 2026) : 20 requêtes par jour pour chacun des 3 modèles Flash utilisés.
const LIMITE_PAR_DEFAUT = 60;

export const GET = route(async () => {
  const limite = Math.max(Number(process.env.GEMINI_LIMITE_JOUR) || LIMITE_PAR_DEFAUT, 1);
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
  const utilisees = ligne.utilisees;
  const pourcentage = ligne.epuise ? 100 : Math.min(Math.round((utilisees / limite) * 100), 100);
  return ok({ utilisees, limite, pourcentage, epuise: ligne.epuise, reinitialisation: ligne.fin });
});
