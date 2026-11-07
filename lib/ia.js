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

  // Nom de modèle nettoyé : il est inséré dans l'URL.
  const modele = (process.env.GEMINI_MODELE || 'gemini-flash-latest').replace(/[^a-z0-9.-]/gi, '');
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), 50000);
  try {
    const reponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
      method: 'POST',
      signal: controleur.signal,
      headers: { 'x-goog-api-key': cle, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${CONSIGNES}\n\n${contexte}` }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      }),
    });
    if (reponse.status === 429) throw new ErreurHttp(429, "Limite gratuite de l'IA atteinte, réessayez dans un moment");
    if (!reponse.ok) {
      console.error('Gemini', reponse.status, (await reponse.text()).slice(0, 500));
      throw new ErreurHttp(502, "L'assistant est indisponible pour le moment");
    }
    const donnees = await reponse.json();
    const brut = (donnees.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim() || '{}';
    try {
      return JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      return { message: brut, recettes: [] };
    }
  } catch (e) {
    if (e instanceof ErreurHttp) throw e;
    throw new ErreurHttp(502, "L'assistant est indisponible pour le moment");
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Traduit en français des noms de produits alimentaires (Gemini).
 * Les noms déjà en français sont rendus tels quels ; les marques ne sont pas traduites.
 * Retourne un tableau de même longueur ; en cas d'échec, les noms d'origine.
 */
export async function traduireNoms(noms) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle || !noms.length) return noms;
  const modele = (process.env.GEMINI_MODELE || 'gemini-flash-latest').replace(/[^a-z0-9.-]/gi, '');
  const consignes = `Tu traduis des noms de produits alimentaires d'épicerie en français québécois naturel, comme sur un emballage canadien.
Règles : garde les noms de marque, les chiffres et les formats tels quels ; si un nom est déjà en français, rends-le identique ;
première lettre en majuscule, le reste en minuscules sauf les marques. Réponds UNIQUEMENT par un tableau JSON de chaînes,
dans le même ordre et de la même longueur que la liste reçue.`;
  try {
    const reponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'x-goog-api-key': cle, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: consignes }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(noms) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      }),
    });
    if (!reponse.ok) return noms;
    const donnees = await reponse.json();
    const brut = (donnees.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const liste = JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!Array.isArray(liste) || liste.length !== noms.length) return noms;
    return liste.map((t, i) => (typeof t === 'string' && t.trim() ? t.trim().slice(0, 200) : noms[i]));
  } catch {
    return noms;
  }
}
