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
Propose exactement le nombre de recettes demandé (10 au maximum) ; si aucun nombre n'est demandé, propose 3 recettes.
Au-delà de 4 recettes, garde les descriptions courtes et 6 étapes au maximum par recette.
Les valeurs nutritives sont des estimations par portion.`;

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

  // Jusqu'à 10 recettes complètes : réponse longue, donc plus de jetons et un délai par tentative plus long.
  const brut = await appelerGemini(
    {
      systemInstruction: { parts: [{ text: `${CONSIGNES}\n\n${contexte}` }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 16000, responseMimeType: 'application/json' },
    },
    { delaiMs: 40000, budgetMs: 56000 }
  );
  if (brut == null) throw new ErreurHttp(502, "L'assistant est indisponible pour le moment. Réessayez dans un instant.");
  try {
    return JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}');
  } catch {
    return { message: brut, recettes: [] };
  }
}

const API = 'https://generativelanguage.googleapis.com/v1beta';
const EXCLUS = /image|tts|audio|live|embedding|robotics|computer|exp|native/i;
let modelesConnus = { liste: null, le: 0 };

/** Version numérique d'un modèle (gemini-3.1-flash -> 3.1) pour classer du plus récent au plus ancien. */
const version = (nom) => Number(nom.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);

/**
 * Modèles « flash » réellement offerts à cette clé (liste demandée à Google, gardée 1 heure).
 * Ordre : versions stables les plus récentes d'abord, flash avant flash-lite, aperçus en dernier.
 */
async function modelesDisponibles(cle) {
  if (modelesConnus.liste && Date.now() - modelesConnus.le < 3600000) return modelesConnus.liste;
  try {
    const reponse = await fetch(`${API}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': cle },
      signal: AbortSignal.timeout(5000),
    });
    if (!reponse.ok) {
      console.error(`Gemini liste des modèles : ${reponse.status}`);
      return [];
    }
    const { models = [] } = await reponse.json();
    const liste = models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((n) => /^gemini-.*flash/.test(n) && !EXCLUS.test(n))
      .sort((x, y) => {
        const apercu = Number(/preview/.test(x)) - Number(/preview/.test(y));
        if (apercu) return apercu;
        const lite = Number(/lite/.test(x)) - Number(/lite/.test(y));
        if (version(y) !== version(x)) return version(y) - version(x);
        return lite;
      });
    modelesConnus = { liste, le: Date.now() };
    console.log(`Gemini modèles disponibles : ${liste.slice(0, 6).join(', ')}`);
    return liste;
  } catch (e) {
    console.error(`Gemini liste des modèles : ${e.message}`);
    return [];
  }
}

/**
 * Réglages « réfléchir le moins possible » à essayer dans l'ordre, selon la génération du modèle.
 * Certains modèles refusent « minimal » : on passe alors à « low » (jamais à la réflexion complète, trop lente).
 */
function reglagesReflexion(modele) {
  if (reglageRetenu.has(modele)) return [reglageRetenu.get(modele)];
  if (/gemini-2\.5/.test(modele)) return [{ thinkingBudget: 0 }, null];
  if (/gemini-2\.0|gemini-1/.test(modele)) return [null];
  return [{ thinkingLevel: 'minimal' }, { thinkingLevel: 'low' }]; // Gemini 3 et suivants, alias « latest »
}

// Réglage accepté par chaque modèle, retenu pour répondre du premier coup aux appels suivants.
const reglageRetenu = new Map();

/**
 * Appel Gemini robuste : réflexion minimale (réponse en quelques secondes), délai par tentative,
 * et choix automatique parmi les modèles que Google offre réellement à la clé.
 * Retourne le texte de la réponse, ou null si tout a échoué (l'erreur est écrite dans les journaux).
 * Lève une ErreurHttp 429 si la limite gratuite est atteinte partout.
 */
async function appelerGemini(corps, { delaiMs = 20000, budgetMs = 55000 } = {}) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) return null;
  const debut = Date.now();
  const disponibles = await modelesDisponibles(cle);
  // Nom de modèle nettoyé : il est inséré dans l'URL.
  const choisi = (process.env.GEMINI_MODELE || '').replace(/[^a-z0-9.-]/gi, '');
  const modeles = [...new Set([...disponibles.slice(0, 3), choisi, 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter(Boolean))];
  let limite = false;

  for (const modele of modeles) {
    const reglages = reglagesReflexion(modele);
    for (let essai = 0; essai < reglages.length; essai += 1) {
      const reflexion = reglages[essai];
      const restant = budgetMs - (Date.now() - debut);
      if (restant < 3000) break;
      const generationConfig = { ...corps.generationConfig };
      if (reflexion) generationConfig.thinkingConfig = reflexion;
      try {
        const reponse = await fetch(`${API}/models/${modele}:generateContent`, {
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
          if (texte) {
            reglageRetenu.set(modele, reflexion);
            return texte;
          }
          console.error(`Gemini ${modele} : réponse vide ${JSON.stringify(donnees).slice(0, 300)}`);
          break;
        }
        const detail = (await reponse.text()).replace(/\s+/g, ' ').slice(0, 300);
        console.error(`Gemini ${modele} : ${reponse.status} ${detail}`);
        if (reponse.status === 429) {
          limite = true;
          break;
        }
        // Réglage de réflexion refusé par ce modèle : on essaie le réglage suivant.
        if (reponse.status === 400 && reflexion && /think/i.test(detail)) continue;
        break;
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

/**
 * Estime le format habituel du contenant complet de produits d'épicerie (au Canada),
 * quand Open Food Facts ne le donne pas. Rend, dans le même ordre, { qte, unite: 'g' | 'ml' } ou null
 * (produit en vrac, fruit ou légume à l'unité, ou format inconnu). Rend null si l'IA est indisponible.
 */
export async function estimerContenants(produits) {
  if (!process.env.GEMINI_API_KEY || !produits.length) return null;
  const consignes = `Pour chaque produit d'épicerie reçu (nom et marque, vendu au Québec), donne le format le plus courant
du contenant complet vendu en épicerie au Canada (ex. : mayonnaise Hellmann's -> 890 ml ; parmesan râpé Kraft -> 250 g ;
lait 2 % Québon en sac -> 4000 ml ; fromage à la crème -> 250 g). Convertis en grammes (g) pour les solides et en
millilitres (ml) pour les liquides. Pour un fruit, un légume, de la viande au comptoir ou un produit en vrac sans format
standard, réponds null. Réponds UNIQUEMENT par un tableau JSON de même longueur et dans le même ordre, dont chaque
élément est {"qte": nombre, "unite": "g" ou "ml"} ou null.`;
  try {
    const brut = await appelerGemini(
      {
        systemInstruction: { parts: [{ text: consignes }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(produits.map((p) => [p.nom, p.marque || ''])) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      },
      { delaiMs: 20000, budgetMs: 25000 }
    );
    if (!brut) return null;
    const liste = JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!Array.isArray(liste) || liste.length !== produits.length) return null;
    return liste.map((x) => {
      const qte = Number(x?.qte);
      return qte > 0 && qte <= 100000 && (x.unite === 'g' || x.unite === 'ml') ? { qte: Math.round(qte * 100) / 100, unite: x.unite } : null;
    });
  } catch {
    return null;
  }
}
