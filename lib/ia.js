import 'server-only';
import { q } from './db';
import { ErreurHttp } from './http';

/** Note un appel à Gemini pour la jauge du quota (ne bloque jamais l'IA en cas d'erreur). */
function noterAppel(modele, statut, source) {
  q('INSERT INTO ia_appels (modele, statut, source) VALUES ($1, $2, $3)', [modele.slice(0, 80), statut, source || null]).catch(() => {});
  if (Math.random() < 0.02) q("DELETE FROM ia_appels WHERE cree_le < now() - interval '3 days'").catch(() => {});
}

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
    { delaiMs: 40000, budgetMs: 56000, source: 'assistant' }
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

// Modèles dont la limite du jour est atteinte (jusqu'à minuit, heure du Pacifique) : on ne les essaie plus.
const epuisesJusqua = new Map();
function finDuJourPacifique() {
  const maintenant = new Date();
  const pacifique = new Date(maintenant.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const ecart = maintenant.getTime() - pacifique.getTime();
  pacifique.setHours(24, 0, 0, 0);
  return pacifique.getTime() + ecart;
}

// Réglage accepté par chaque modèle, retenu pour répondre du premier coup aux appels suivants.
const reglageRetenu = new Map();

/**
 * Appel Gemini robuste : réflexion minimale (réponse en quelques secondes), délai par tentative,
 * et choix automatique parmi les modèles que Google offre réellement à la clé.
 * Retourne le texte de la réponse, ou null si tout a échoué (l'erreur est écrite dans les journaux).
 * Lève une ErreurHttp 429 si la limite gratuite est atteinte partout.
 */
async function appelerGemini(corps, { delaiMs = 20000, budgetMs = 55000, source = null } = {}) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) return null;
  const debut = Date.now();
  const disponibles = await modelesDisponibles(cle);
  // Nom de modèle nettoyé : il est inséré dans l'URL.
  const choisi = (process.env.GEMINI_MODELE || '').replace(/[^a-z0-9.-]/gi, '');
  const modeles = [...new Set([...disponibles.slice(0, 3), choisi, 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter(Boolean))];
  let limite = false;

  for (const modele of modeles) {
    if ((epuisesJusqua.get(modele) || 0) > Date.now()) {
      limite = true;
      continue;
    }
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
        noterAppel(modele, reponse.status, source);
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
        const brutErreur = await reponse.text();
        const detail = brutErreur.replace(/\s+/g, ' ').slice(0, 300);
        console.error(`Gemini ${modele} : ${reponse.status} ${detail}`);
        if (reponse.status === 429) {
          limite = true;
          // Limite du jour (et non par minute) : notée pour la jauge, et le modèle est mis de côté jusqu'à minuit (Pacifique).
          if (/PerDay/i.test(brutErreur)) {
            noterAppel(modele, 430, source);
            epuisesJusqua.set(modele, finDuJourPacifique());
          }
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
  if (limite) {
    noterAppel('tous', 999, source); // tous les modèles ont refusé : quota probablement épuisé
    throw new ErreurHttp(429, "Limite gratuite de l'IA atteinte, réessayez dans un moment");
  }
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
      { delaiMs: 15000, budgetMs: 18000, source: 'traduction' }
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
 * Étiquetage automatique (Gemini) : pour chaque recette, 2 à 6 étiquettes.
 * Les étiquettes déjà créées par la personne sont réutilisées en priorité.
 * Retourne un tableau de même longueur (tableaux vides en cas d'échec).
 */
export async function suggererEtiquettes(recettes, existantes = [], interdites = []) {
  const vide = recettes.map(() => []);
  if (!process.env.GEMINI_API_KEY || !recettes.length) return vide;
  const consignes = `Tu classes des recettes de cuisine avec des étiquettes courtes en français québécois,
en te basant surtout sur la LISTE DES INGRÉDIENTS. Pour chaque recette, donne de 2 à 8 étiquettes.
Étiquettes à utiliser en priorité (écrites exactement ainsi) :
${JSON.stringify(existantes.slice(0, 150))}
Tu peux en créer une nouvelle seulement si aucune ne convient (1 à 3 mots).
${interdites.length ? `N'utilise JAMAIS ces étiquettes (refusées par la personne) : ${JSON.stringify(interdites.slice(0, 100))}
` : ''}Règles obligatoires :
- Viande : « Bœuf », « Poulet », « Porc » selon les viandes présentes (plusieurs si plusieurs) ;
  « Autre viande » pour toute autre viande (agneau, veau, dinde, canard, lapin, gibier, saucisse ou charcuterie d'origine inconnue) ;
  « Poisson » ou « Fruits de mer » si présents.
- « Végétarien » : aucune viande, volaille, poisson ni fruits de mer (le bouillon de poulet ou de bœuf compte comme de la viande).
  Une recette est soit « Végétarien », soit étiquetée avec sa ou ses viandes ou poissons.
- « Sans lactose » : aucun ingrédient laitier contenant du lactose (lait, crème, beurre, fromage, yogourt, crème sure, lait en poudre...).
  Les versions « sans lactose » et les laits végétaux sont permis. Dans le doute, ne mets pas « Sans lactose ».
- Autres repères : moment du repas (Déjeuner, Dîner, Souper, Collation, Dessert, Lunch) ; Légumes ; Fromage ; Pâtes ; Soupe ; Salade ;
  « Léger » : moins de 400 kcal par portion ; « Gras » : plus de 25 g de lipides par portion ;
  « Santé » : équilibrée, peu transformée, riche en légumes ou fibres ;
  « Nourrissant » : soutenant et calorique, mais avec de la bonne énergie (grains entiers, protéines, bons gras, légumineuses), pas des calories vides ;
  « Riche en protéines » : au moins 25 g de protéines par portion ; « Rapide » : 30 minutes ou moins au total.
Si la nutrition est inconnue, déduis-la prudemment des ingrédients.
Première lettre en majuscule, le reste en minuscules. Réponds UNIQUEMENT par un tableau JSON de tableaux de chaînes,
dans le même ordre et de la même longueur que la liste de recettes reçue.`;
  const donnees = recettes.map((r) => ({
    titre: r.titre,
    description: r.description ? String(r.description).slice(0, 300) : undefined,
    ingredients: (r.ingredients || []).slice(0, 40).map((i) => String(i).slice(0, 120)),
    kcal_portion: r.kcal ?? undefined,
    proteines_g: r.proteines ?? undefined,
    lipides_g: r.lipides ?? undefined,
    minutes: (r.temps_preparation || 0) + (r.temps_cuisson || 0) || undefined,
  }));
  try {
    const brut = await appelerGemini(
      {
        systemInstruction: { parts: [{ text: consignes }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(donnees) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      },
      { delaiMs: 20000, budgetMs: 25000, source: 'etiquetage' }
    );
    if (!brut) return vide;
    const liste = JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!Array.isArray(liste) || liste.length !== recettes.length) return vide;
    return liste.map((l) => (Array.isArray(l) ? l.filter((t) => typeof t === 'string' && t.trim()).slice(0, 8) : []));
  } catch {
    return vide;
  }
}

const CONSIGNES_EXTRACTION = `Tu extrais UNE recette de cuisine d'un texte (page web ou texte collé), en français.
Garde les ingrédients et les étapes tels qu'écrits (traduis en français seulement s'ils sont dans une autre langue),
avec leurs quantités. Ignore les publicités, commentaires et menus du site.
Réponds UNIQUEMENT avec un objet JSON :
{"trouve": true, "titre": "", "description": "", "portions": 4, "temps_preparation": 15, "temps_cuisson": 30,
 "ingredients": ["..."], "etapes": ["..."], "etiquettes": ["..."]}
Temps en minutes (null si inconnu). Si le texte ne contient aucune recette : {"trouve": false}.`;

/**
 * Recette lue dans un texte libre (page sans données structurées, ou texte collé) par Gemini.
 * Retourne { titre, description, portions, temps_preparation, temps_cuisson, ingredients[], etapes[], etiquettes[] } ou null.
 */
export async function extraireRecette(texte, { budgetMs = 25000 } = {}) {
  if (!process.env.GEMINI_API_KEY || !texte?.trim()) return null;
  const brut = await appelerGemini(
    {
      systemInstruction: { parts: [{ text: CONSIGNES_EXTRACTION }] },
      contents: [{ role: 'user', parts: [{ text: texte.slice(0, 30000) }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: 'application/json' },
    },
    { delaiMs: budgetMs - 2000, budgetMs, source: 'import' }
  );
  if (!brut) return null;
  let r;
  try {
    r = JSON.parse(brut.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  if (!r?.trouve || !r.titre || !Array.isArray(r.ingredients) || !r.ingredients.length) return null;
  const liste = (v, max, long) => (Array.isArray(v) ? v : []).map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, long));
  const entier = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  return {
    titre: String(r.titre).trim().slice(0, 200),
    description: r.description ? String(r.description).trim().slice(0, 5000) : null,
    portions: Math.min(Number(r.portions) > 0 ? Number(r.portions) : 1, 200),
    temps_preparation: entier(r.temps_preparation),
    temps_cuisson: entier(r.temps_cuisson),
    ingredients: liste(r.ingredients, 150, 300),
    etapes: liste(r.etapes, 100, 5000),
    etiquettes: liste(r.etiquettes, 10, 40).map((e) => e.toLowerCase()),
  };
}
