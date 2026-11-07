import 'server-only';
import { ErreurHttp } from './http';

const CONSIGNES = `Tu es l'assistant culinaire de Cuizinote. Tu réponds toujours en français québécois standard, sans emoji.
Tu proposes des idées de repas réalistes en priorité avec les aliments disponibles de l'utilisateur.
Tu réponds UNIQUEMENT avec un objet JSON valide de cette forme :
{
  "message": "courte réponse à l'utilisateur",
  "recettes": [
    {
      "titre": "texte",
      "description": "une ou deux phrases",
      "portions": 4,
      "temps_preparation": 15,
      "temps_cuisson": 30,
      "ingredients": ["200 g de poulet", "..."],
      "etapes": ["Étape 1...", "..."],
      "kcal_portion": 450,
      "proteines_portion": 30,
      "glucides_portion": 40,
      "lipides_portion": 15,
      "etiquettes": ["souper", "poulet"],
      "manquants": ["ingrédients à acheter"]
    }
  ]
}
Propose entre 1 et 3 recettes. Les valeurs nutritives sont des estimations par portion.`;

/** Appelle Google Gemini (offre gratuite) et retourne la réponse JSON. */
export async function demanderIdees({ demande, inventaire, historique = [] }) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) throw new ErreurHttp(503, "L'assistant n'est pas configuré (GEMINI_API_KEY manquant)");

  const lignes = inventaire.map((i) => {
    const quantite = i.quantite ? ` (${i.quantite} ${i.unite || ''})` : '';
    const expiration = i.expire_le ? ` expire le ${i.expire_le}` : '';
    return `- ${i.nom}${quantite} [${i.emplacement}]${expiration}`;
  });
  const contexte = lignes.length
    ? `Aliments disponibles :\n${lignes.join('\n')}`
    : "L'utilisateur n'a pas partagé son inventaire.";

  const contents = [
    ...historique.slice(-6).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: demande }] },
  ];

  const brut = await appelerGemini({
    systemInstruction: { parts: [{ text: `${CONSIGNES}\n\n${contexte}` }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 4000, responseMimeType: 'application/json' },
  });
  if (brut == null) throw new ErreurHttp(502, "L'assistant est indisponible pour le moment. Réessayez dans un instant.");
  try {
    return JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}');
  } catch {
    return { message: brut, recettes: [] };
  }
}

/**
 * Appel Gemini robuste : réflexion désactivée (réponse en quelques secondes au lieu de dizaines),
 * délai par tentative, puis modèles de secours si le modèle choisi échoue ou est trop lent.
 * Retourne le texte de la réponse, ou null si tout a échoué (l'erreur est écrite dans les journaux).
 * Lève une ErreurHttp 429 si la limite gratuite est atteinte.
 */
async function appelerGemini(corps, { delaiMs = 25000, budgetMs = 55000 } = {}) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) return null;
  // Nom de modèle nettoyé : il est inséré dans l'URL.
  const choisi = (process.env.GEMINI_MODELE || 'gemini-2.5-flash').replace(/[^a-z0-9.-]/gi, '');
  const modeles = [...new Set([choisi, 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])];
  const debut = Date.now();
  let limite = false;

  for (const modele of modeles) {
    for (const sansReflexion of [true, false]) {
      const restant = budgetMs - (Date.now() - debut);
      if (restant < 3000) break;
      const generationConfig = { ...corps.generationConfig };
      if (sansReflexion) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      try {
        const reponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(Math.min(delaiMs, restant)),
          headers: { 'x-goog-api-key': cle, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...corps, generationConfig }),
        });
        if (reponse.ok) {
          const donnees = await reponse.json();
          const texte = (donnees.candidates?.[0]?.content?.parts || [])
            .filter((p) => !p.thought)
            .map((p) => p.text || '')
            .join('')
            .trim();
          if (texte) return texte;
          console.error(`Gemini ${modele} : réponse vide`, JSON.stringify(donnees).slice(0, 300));
          break;
        }
        const detail = (await reponse.text()).slice(0, 400);
        console.error(`Gemini ${modele} (${sansReflexion ? 'sans réflexion' : 'normal'}) : ${reponse.status} ${detail}`);
        if (reponse.status === 429) {
          limite = true;
          break; // essayer le modèle suivant (quota séparé)
        }
        // Option de réflexion refusée par ce modèle : on réessaie sans l'option.
        if (reponse.status === 400 && sansReflexion && /think/i.test(detail)) continue;
        break; // modèle introuvable ou erreur : modèle suivant
      } catch (e) {
        console.error(`Gemini ${modele} : ${e.name === 'TimeoutError' ? 'délai dépassé' : e.message}`);
        break;
      }
    }
  }
  if (limite) throw new ErreurHttp(429, "Limite gratuite de l'IA atteinte, réessayez dans un moment");
  return null;
}

/**
 * Traduit en français des noms de produits alimentaires (Gemini).
 * Les noms déjà en français sont rendus tels quels ; les marques ne sont pas traduites.
 * Retourne un tableau de même longueur ; en cas d'échec, les noms d'origine.
 */
export async function traduireNoms(noms) {
  if (!process.env.GEMINI_API_KEY || !noms.length) return noms;
  const consignes = `Tu traduis des noms de produits alimentaires d'épicerie en français québécois naturel, comme sur un emballage canadien.
Règles : garde les noms de marque, les chiffres et les formats tels quels ; si un nom est déjà en français, rends-le identique ;
première lettre en majuscule, le reste en minuscules sauf les marques. Réponds UNIQUEMENT par un tableau JSON de chaînes,
dans le même ordre et de la même longueur que la liste reçue.`;
  try {
    const brut = await appelerGemini(
      {
        systemInstruction: { parts: [{ text: consignes }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(noms) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      },
      { delaiMs: 15000, budgetMs: 18000 }
    );
    if (!brut) return noms;
    const liste = JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!Array.isArray(liste) || liste.length !== noms.length) return noms;
    return liste.map((t, i) => (typeof t === 'string' && t.trim() ? t.trim().slice(0, 200) : noms[i]));
  } catch {
    return noms;
  }
}
