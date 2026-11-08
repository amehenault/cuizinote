import 'server-only';
import { z } from 'zod';
import { q, q1 } from './db';
import { listerPlanification } from './planification';
import { grammesDeMesure, mesureDepuisTexte } from './mesures';
import { clesRangement } from './rangement';
import { enregistrerRecette, etiqueterRecette, listerRecettes, obtenirRecette } from './recettes';
import { COLONNES_ALIMENT } from './colonnes';
import { EMPLACEMENTS, MOMENTS, schemaAliment, schemaEpicerie, schemaInventaire, schemaPlanification, schemaRecette } from './schemas';

/**
 * Serveur MCP personnel (Model Context Protocol) : Claude lit l'inventaire et les recettes,
 * et peut planifier un repas ou remplir la liste d'épicerie. Transport HTTP « streamable », sans état.
 */

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Cuizinote : application de recettes, d'inventaire (frigo, congélateur, garde-manger) et de planification de repas.
Tu peux : lire l'inventaire, les recettes et le planificateur ; ajouter, modifier ou retirer des articles d'inventaire ;
créer de nouvelles recettes dans Cuizinote (creer_recette, par exemple à partir d'une idée que tu as proposée) ;
planifier des repas ; ajouter des articles à la liste d'épicerie ; chercher des produits dans la banque d'aliments
et en créer de nouveaux (creer_aliment) quand un ingrédient n'y est pas, pour que ses calories soient calculées.
Pour proposer des idées de repas, lis d'abord l'inventaire (outil inventaire) et les recettes existantes (outil recettes) ;
privilégie les aliments qui expirent bientôt. Les moments de repas sont : ${MOMENTS.join(', ')}.
Chaque article d'inventaire et chaque recette a un id : utilise-le pour planifier, modifier ou retirer.
Un article d'inventaire lié à la banque d'aliments (aliment_id) peut être planifié directement (planifier_repas avec aliment_id).
Avant de modifier l'inventaire, créer une recette, planifier un repas ou remplir l'épicerie, confirme avec la personne.`;

const OUTILS = [
  {
    name: 'inventaire',
    title: 'Inventaire',
    description: "Articles en inventaire (frigo, congélateur, garde-manger) : id, aliment_id (banque d'aliments), quantité, date d'expiration ; les plus pressés en premier.",
    inputSchema: {
      type: 'object',
      properties: {
        emplacements: { type: 'array', items: { type: 'string', enum: EMPLACEMENTS }, description: 'Filtre (par défaut : tous).' },
      },
    },
    annotations: { readOnlyHint: true },
    schema: z.object({ emplacements: z.array(z.enum(EMPLACEMENTS)).optional() }),
    async executer(u, { emplacements }) {
      const liste = emplacements?.length ? emplacements : EMPLACEMENTS;
      return q(
        `SELECT i.id, i.aliment_id, coalesce(i.nom, a.nom) AS nom, a.marque, i.emplacement, i.quantite::float, i.unite,
                to_char(i.expire_le, 'YYYY-MM-DD') AS expire_le
           FROM inventaire i LEFT JOIN aliments a ON a.id = i.aliment_id
          WHERE i.utilisateur_id = $1 AND i.emplacement = ANY($2::text[])
          ORDER BY i.expire_le NULLS LAST, i.nom LIMIT 1000`,
        [u.id, liste]
      );
    },
  },
  {
    name: 'recettes',
    title: 'Mes recettes',
    description: 'Liste des recettes (id, titre, étiquettes, calories par portion, temps). Recherche facultative dans le titre et la description.',
    inputSchema: {
      type: 'object',
      properties: {
        recherche: { type: 'string', description: 'Mot à chercher (ex. : poulet).' },
        etiquette: { type: 'string', description: "Nom exact d'une étiquette." },
      },
    },
    annotations: { readOnlyHint: true },
    schema: z.object({ recherche: z.string().max(100).optional(), etiquette: z.string().max(60).optional() }),
    async executer(u, { recherche = '', etiquette = '' }) {
      const liste = await listerRecettes(u.id, { recherche, etiquette });
      return liste.map((r) => ({
        id: r.id,
        titre: r.titre,
        etiquettes: r.etiquettes,
        portions: r.portions,
        kcal_portion: r.kcal,
        minutes: (r.temps_preparation || 0) + (r.temps_cuisson || 0) || null,
        note: r.note || null,
      }));
    },
  },
  {
    name: 'recette',
    title: "Détail d'une recette",
    description: "Ingrédients, étapes et valeurs nutritives d'une recette (id fourni par l'outil recettes).",
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true },
    schema: z.object({ id: z.uuid() }),
    async executer(u, { id }) {
      const r = await obtenirRecette(u.id, id);
      return {
        id: r.id,
        titre: r.titre,
        description: r.description,
        portions: r.portions,
        temps_preparation: r.temps_preparation,
        temps_cuisson: r.temps_cuisson,
        etiquettes: r.etiquettes,
        ingredients: r.ingredients.map((i) => i.texte),
        etapes: r.etapes,
        par_portion: { kcal: r.kcal, proteines: r.proteines, glucides: r.glucides, lipides: r.lipides },
        commentaires: r.commentaires,
      };
    },
  },
  {
    name: 'planificateur',
    title: 'Planificateur',
    description: 'Repas déjà planifiés entre deux dates (AAAA-MM-JJ, 62 jours au plus).',
    inputSchema: {
      type: 'object',
      properties: { debut: { type: 'string', format: 'date' }, fin: { type: 'string', format: 'date' } },
      required: ['debut', 'fin'],
    },
    annotations: { readOnlyHint: true },
    schema: z.object({ debut: z.iso.date(), fin: z.iso.date() }),
    async executer(u, { debut, fin }) {
      if ((new Date(fin) - new Date(debut)) / 86400000 > 62) throw new Error('Période trop longue (62 jours au plus)');
      const liste = await listerPlanification(u.id, debut, fin);
      return liste.map((p) => ({
        jour: p.jour,
        moment: p.moment,
        repas: p.recette_titre || p.aliment_nom || p.libelle,
        recette_id: p.recette_id,
        portions: p.portions,
        kcal: p.kcal,
        mange: p.mange,
      }));
    },
  },
  {
    name: 'planifier_repas',
    title: 'Planifier un repas',
    description: "Ajoute un repas au planificateur : une recette (recette_id), un aliment de la banque ou de l'inventaire (aliment_id, grammes facultatifs) ou une idée libre (libelle).",
    inputSchema: {
      type: 'object',
      properties: {
        jour: { type: 'string', format: 'date' },
        moment: { type: 'string', enum: MOMENTS },
        recette_id: { type: 'string', description: 'Recette existante (prioritaire).' },
        aliment_id: { type: 'string', description: "Aliment de la banque (ex. : aliment_id d'un article d'inventaire)." },
        grammes: { type: 'number', description: "Avec aliment_id : grammes ou ml par portion (par défaut : la portion de l'étiquette)." },
        libelle: { type: 'string', description: 'Nom du repas, si ce n’est pas une recette enregistrée.' },
        portions: { type: 'number', description: 'Par défaut : 1.' },
      },
      required: ['jour', 'moment'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    schema: schemaPlanification,
    async executer(u, d) {
      if (d.recette_id) {
        const r = await q1('SELECT 1 FROM recettes WHERE id = $1 AND utilisateur_id = $2', [d.recette_id, u.id]);
        if (!r) throw new Error('Recette introuvable');
      }
      const alimentId = d.recette_id ? null : d.aliment_id;
      if (alimentId && !(await q1('SELECT 1 FROM aliments WHERE id = $1', [alimentId]))) throw new Error('Aliment introuvable');
      await q(
        `INSERT INTO planification (utilisateur_id, jour, moment, recette_id, aliment_id, libelle, portions, grammes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [u.id, d.jour, d.moment, d.recette_id, alimentId, d.recette_id || alimentId ? null : d.libelle, d.portions, alimentId ? d.grammes : null]
      );
      return { ok: true, message: `Ajouté au planificateur : ${d.jour}, ${d.moment}.` };
    },
  },
  {
    name: 'ajouter_epicerie',
    title: "Ajouter à la liste d'épicerie",
    description: "Ajoute des articles à la liste d'épicerie (50 au plus).",
    inputSchema: {
      type: 'object',
      properties: {
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: { nom: { type: 'string' }, quantite: { type: 'string' }, rayon: { type: 'string' } },
            required: ['nom'],
          },
        },
      },
      required: ['articles'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    schema: z.object({ articles: z.array(schemaEpicerie).min(1).max(50) }),
    async executer(u, { articles }) {
      await q(
        `INSERT INTO epicerie (utilisateur_id, nom, quantite, rayon)
         SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[])`,
        [u.id, articles.map((a) => a.nom), articles.map((a) => a.quantite ?? null), articles.map((a) => a.rayon ?? null)]
      );
      return { ok: true, ajoutes: articles.length };
    },
  },
  {
    name: 'rechercher_aliments',
    title: "Banque d'aliments",
    description: "Cherche des produits dans la banque d'aliments (id, nom, marque, calories, portion de l'étiquette) pour les lier à une recette, à l'inventaire ou au planificateur.",
    inputSchema: { type: 'object', properties: { recherche: { type: 'string' } }, required: ['recherche'] },
    annotations: { readOnlyHint: true },
    schema: z.object({ recherche: z.string().trim().min(1).max(100) }),
    async executer(u, { recherche }) {
      return q(
        `SELECT id, nom, marque, unite, kcal_100g::float, portion_texte, portion_g::float
           FROM aliments WHERE cz_norm(nom) LIKE '%' || cz_norm($1) || '%' OR cz_norm(marque) LIKE '%' || cz_norm($1) || '%'
          ORDER BY length(nom), nom LIMIT 30`,
        [recherche.replace(/[%_\\]/g, '\\$&')]
      );
    },
  },
  {
    name: 'creer_aliment',
    title: "Créer un aliment dans la banque",
    description:
      "Ajoute un produit à la banque d'aliments (valeurs nutritives pour 100 g, ou 100 ml si unite = ml). Cherche d'abord avec rechercher_aliments pour éviter les doublons. Si le code-barre existe déjà, la fiche existante est retournée sans être modifiée.",
    inputSchema: {
      type: 'object',
      properties: {
        nom: { type: 'string' },
        marque: { type: 'string' },
        code_barre: { type: 'string', description: '6 à 14 chiffres, facultatif.' },
        unite: { type: 'string', enum: ['g', 'ml'], description: 'Base des valeurs : 100 g (défaut) ou 100 ml pour un liquide.' },
        kcal_100g: { type: 'number' },
        proteines_100g: { type: 'number' },
        glucides_100g: { type: 'number' },
        lipides_100g: { type: 'number' },
        fibres_100g: { type: 'number' },
        sucres_100g: { type: 'number' },
        sodium_100g: { type: 'number', description: 'En grammes.' },
        portion_texte: { type: 'string', description: "Portion de l'étiquette en mesure de cuisine (ex. : « 2 c. à soupe », « 1/4 tasse »)." },
        portion_g: { type: 'number', description: 'Poids (ou ml) de cette portion.' },
        contenant_qte: { type: 'number', description: 'Format du contenant (ex. : 400).' },
        contenant_unite: { type: 'string', enum: ['g', 'kg', 'ml', 'L', 'lb'] },
      },
      required: ['nom', 'kcal_100g'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    schema: schemaAliment.omit({ image_id: true, image_url: true }),
    async executer(u, a) {
      if (a.code_barre) {
        const existant = await q1(`SELECT ${COLONNES_ALIMENT} FROM aliments WHERE code_barre = $1`, [a.code_barre]);
        if (existant) return { ok: true, deja_existant: true, aliment: existant };
      }
      const ligne = await q1(
        `INSERT INTO aliments (utilisateur_id, nom, marque, code_barre, kcal_100g, proteines_100g, glucides_100g, lipides_100g,
                fibres_100g, sucres_100g, sel_100g, sodium_100g, portion_g, unite, portion_texte, contenant_qte, contenant_unite, traduit_le)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
         RETURNING id, nom, marque, unite, kcal_100g::float, portion_texte, portion_g::float`,
        [u.id, a.nom, a.marque, a.code_barre, a.kcal_100g, a.proteines_100g, a.glucides_100g, a.lipides_100g, a.fibres_100g,
          a.sucres_100g, a.sel_100g, a.sodium_100g, a.portion_g, a.unite, a.portion_texte, a.contenant_qte,
          a.contenant_qte ? a.contenant_unite || a.unite : null]
      );
      return { ok: true, aliment: ligne, message: `Aliment « ${a.nom} » ajouté à la banque.` };
    },
  },
  {
    name: 'ajouter_inventaire',
    title: "Ajouter à l'inventaire",
    description: "Ajoute des articles à l'inventaire (20 au plus). aliment_id facultatif (banque d'aliments).",
    inputSchema: {
      type: 'object',
      properties: {
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nom: { type: 'string' },
              emplacement: { type: 'string', enum: EMPLACEMENTS },
              aliment_id: { type: 'string' },
              quantite: { type: 'number' },
              unite: { type: 'string', description: 'Ex. : « × 400 g », « sachets ».' },
              expire_le: { type: 'string', format: 'date' },
            },
            required: ['nom', 'emplacement'],
          },
        },
      },
      required: ['articles'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    schema: z.object({ articles: z.array(schemaInventaire).min(1).max(20) }),
    async executer(u, { articles }) {
      const ajoutes = [];
      for (const i of articles) {
        const ligne = await q1(
          `INSERT INTO inventaire (utilisateur_id, emplacement, nom, aliment_id, quantite, unite, expire_le)
           VALUES ($1, $2, $3, (SELECT id FROM aliments WHERE id = $4), $5, $6, $7) RETURNING id, aliment_id, nom, emplacement`,
          [u.id, i.emplacement, i.nom, i.aliment_id, i.quantite, i.unite, i.expire_le]
        );
        await q(`INSERT INTO rangements (utilisateur_id, cle, emplacement) SELECT $1, unnest($2::text[]), $3 ON CONFLICT DO NOTHING`, [
          u.id,
          clesRangement({ aliment_id: ligne.aliment_id, nom: ligne.nom }),
          ligne.emplacement,
        ]);
        ajoutes.push(ligne);
      }
      return { ok: true, ajoutes };
    },
  },
  {
    name: 'modifier_inventaire',
    title: "Modifier un article d'inventaire",
    description: "Change la quantité, l'emplacement, la date d'expiration, l'unité ou le nom d'un article (id de l'outil inventaire). Seuls les champs fournis changent.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        nom: { type: 'string' },
        emplacement: { type: 'string', enum: EMPLACEMENTS },
        quantite: { type: 'number' },
        unite: { type: 'string' },
        expire_le: { type: ['string', 'null'], format: 'date' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: z.object({
      id: z.uuid(),
      nom: z.string().trim().min(1).max(200).optional(),
      emplacement: z.enum(EMPLACEMENTS).optional(),
      quantite: z.number().min(0).max(100000).optional(),
      unite: z.string().trim().max(30).optional(),
      expire_le: z.iso.date().nullable().optional(),
    }),
    async executer(u, d) {
      const ligne = await q1(
        `UPDATE inventaire SET nom = coalesce($3, nom), emplacement = coalesce($4, emplacement), quantite = coalesce($5, quantite),
                unite = coalesce($6, unite), expire_le = CASE WHEN $7 THEN $8::date ELSE expire_le END
          WHERE id = $1 AND utilisateur_id = $2
          RETURNING id, nom, emplacement, quantite::float, unite, to_char(expire_le, 'YYYY-MM-DD') AS expire_le`,
        [d.id, u.id, d.nom ?? null, d.emplacement ?? null, d.quantite ?? null, d.unite ?? null, d.expire_le !== undefined, d.expire_le ?? null]
      );
      if (!ligne) throw new Error('Article introuvable');
      return { ok: true, article: ligne };
    },
  },
  {
    name: 'retirer_inventaire',
    title: "Retirer de l'inventaire",
    description: "Retire des articles de l'inventaire (ex. : utilisés ou jetés), par leurs id.",
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
    schema: z.object({ ids: z.array(z.uuid()).min(1).max(50) }),
    async executer(u, { ids }) {
      const lignes = await q('DELETE FROM inventaire WHERE utilisateur_id = $1 AND id = ANY($2::uuid[]) RETURNING nom', [u.id, ids]);
      return { ok: true, retires: lignes.map((l) => l.nom) };
    },
  },
  {
    name: 'creer_recette',
    title: 'Créer une recette',
    description:
      "Enregistre une nouvelle recette (privée). Ingrédients : texte (« 1 tasse de riz »), et aliment_id facultatif pour lier un produit de la banque (calories calculées).",
    inputSchema: {
      type: 'object',
      properties: {
        titre: { type: 'string' },
        description: { type: 'string' },
        portions: { type: 'number' },
        temps_preparation: { type: 'integer', description: 'Minutes.' },
        temps_cuisson: { type: 'integer', description: 'Minutes.' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: { texte: { type: 'string' }, aliment_id: { type: 'string' } },
            required: ['texte'],
          },
        },
        etapes: { type: 'array', items: { type: 'string' } },
        etiquettes: { type: 'array', items: { type: 'string' } },
        kcal_portion: { type: 'number', description: 'Estimation si aucun ingrédient lié.' },
        commentaires: { type: 'string' },
      },
      required: ['titre', 'ingredients', 'etapes'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    schema: schemaRecette.extend({
      ingredients: z.array(z.object({ texte: z.string().trim().min(1).max(300), aliment_id: z.uuid().nullish() })).max(150).default([]),
      publiee: z.boolean().default(false),
    }),
    async executer(u, d) {
      // Mesure et grammes d'un ingrédient lié : d'après le texte et la portion de l'étiquette.
      const ids = d.ingredients.map((i) => i.aliment_id).filter(Boolean);
      const aliments = ids.length
        ? await q('SELECT id, nom, unite, portion_g::float, portion_texte FROM aliments WHERE id = ANY($1::uuid[])', [ids])
        : [];
      const ingredients = d.ingredients.map((i) => {
        const a = aliments.find((x) => x.id === i.aliment_id);
        if (!a) return { texte: i.texte, aliment_id: null, grammes: null, kcal: null, mesure: null };
        const mesure = mesureDepuisTexte(i.texte);
        const grammes = mesure ? grammesDeMesure(mesure, a) : null;
        return { texte: i.texte, aliment_id: a.id, grammes: grammes ?? a.portion_g ?? 100, kcal: null, mesure: grammes ? mesure : null };
      });
      const id = await enregistrerRecette(u.id, { ...d, ingredients });
      await etiqueterRecette(u.id, id).catch(() => {});
      return { ok: true, id, message: `Recette « ${d.titre} » créée.` };
    },
  },
];

const reponse = (id, result) => ({ jsonrpc: '2.0', id, result });
const erreur = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Traite un message JSON-RPC. Retourne null pour une notification (aucune réponse). */
export async function traiterMessage(utilisateur, m) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return erreur(m?.id, -32600, 'Requête invalide');
  if (m.id === undefined) return null;

  switch (m.method) {
    case 'initialize': {
      const demandee = m.params?.protocolVersion;
      return reponse(m.id, {
        protocolVersion: VERSIONS.includes(demandee) ? demandee : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'cuizinote', title: 'Cuizinote', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return reponse(m.id, {});
    case 'tools/list':
      return reponse(m.id, { tools: OUTILS.map(({ schema, executer, ...outil }) => outil) });
    case 'tools/call': {
      const outil = OUTILS.find((o) => o.name === m.params?.name);
      if (!outil) return erreur(m.id, -32602, `Outil inconnu : ${m.params?.name}`);
      const args = outil.schema.safeParse(m.params?.arguments ?? {});
      if (!args.success) {
        const p = args.error.issues[0];
        return reponse(m.id, { isError: true, content: [{ type: 'text', text: `Argument invalide : ${p?.path?.join('.') || ''} ${p?.message || ''}` }] });
      }
      try {
        const resultat = await outil.executer(utilisateur, args.data);
        return reponse(m.id, { content: [{ type: 'text', text: JSON.stringify(resultat) }] });
      } catch (e) {
        return reponse(m.id, { isError: true, content: [{ type: 'text', text: e.message || 'Erreur' }] });
      }
    }
    default:
      return erreur(m.id, -32601, `Méthode inconnue : ${m.method}`);
  }
}
