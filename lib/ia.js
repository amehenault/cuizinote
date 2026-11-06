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

/** Appelle Groq (offre gratuite, API compatible OpenAI) et retourne la réponse JSON. */
export async function demanderIdees({ demande, inventaire, historique = [] }) {
  const cle = process.env.GROQ_API_KEY;
  if (!cle) throw new ErreurHttp(503, "L'assistant n'est pas configuré (GROQ_API_KEY manquant)");

  const contexte = inventaire.length
    ? `Aliments disponibles :\n${inventaire.map((i) => `- ${i.nom}${i.quantite ? ` (${i.quantite} ${i.unite || ''})` : ''} [${i.emplacement}]${i.expire_le ? ` expire le ${i.expire_le}` : ''}`).join('\n')}`
    : "L'utilisateur n'a pas partagé son inventaire.";

  const messages = [
    { role: 'system', content: CONSIGNES },
    { role: 'system', content: contexte },
    ...historique.slice(-6),
    { role: 'user', content: demande },
  ];

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), 45000);
  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controleur.signal,
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODELE || 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });
    if (reponse.status === 429) throw new ErreurHttp(429, "Limite gratuite de l'IA atteinte, réessayez dans un moment");
    if (!reponse.ok) throw new ErreurHttp(502, "L'assistant est indisponible pour le moment");
    const donnees = await reponse.json();
    const brut = donnees.choices?.[0]?.message?.content || '{}';
    try {
      return JSON.parse(brut);
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
