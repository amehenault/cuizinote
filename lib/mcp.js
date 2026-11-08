import 'server-only';
import { z } from 'zod';
import { q, q1 } from './db';
import { listerPlanification } from './planification';
import { listerRecettes, obtenirRecette } from './recettes';
import { EMPLACEMENTS, MOMENTS, schemaEpicerie, schemaPlanification } from './schemas';

/**
 * Serveur MCP personnel (Model Context Protocol) : Claude lit l'inventaire et les recettes,
 * et peut planifier un repas ou remplir la liste d'épicerie. Transport HTTP « streamable », sans état.
 */

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Cuizinote : application de recettes, d'inventaire (frigo, congélateur, garde-manger) et de planification de repas.
Pour proposer des idées de repas, lis d'abord l'inventaire (outil inventaire) et les recettes existantes (outil recettes) ;
privilégie les aliments qui expirent bientôt. Les moments de repas sont : ${MOMENTS.join(', ')}.
Avant de planifier un repas ou d'ajouter à l'épicerie, confirme avec la personne.`;

const OUTILS = [
  {
    name: 'inventaire',
    title: 'Inventaire',
    description: "Aliments en inventaire (frigo, congélateur, garde-manger) avec quantité et date d'expiration, les plus pressés en premier.",
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
        `SELECT coalesce(i.nom, a.nom) AS nom, a.marque, i.emplacement, i.quantite::float, i.unite,
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
    description: "Ajoute un repas au planificateur : une recette existante (recette_id) ou une idée libre (libelle).",
    inputSchema: {
      type: 'object',
      properties: {
        jour: { type: 'string', format: 'date' },
        moment: { type: 'string', enum: MOMENTS },
        recette_id: { type: 'string', description: 'Recette existante (prioritaire sur libelle).' },
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
      await q(
        `INSERT INTO planification (utilisateur_id, jour, moment, recette_id, libelle, portions) VALUES ($1,$2,$3,$4,$5,$6)`,
        [u.id, d.jour, d.moment, d.recette_id, d.recette_id ? null : d.libelle, d.portions]
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
