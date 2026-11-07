import { ok, route } from '@/lib/http';
import { propositionsEnAttente } from '@/lib/versions-aliments';

/** Nouvelles versions de produits modifiés par d'autres personnes, en attente de ma réponse. */
export const GET = route(async ({ utilisateur }) => ok(await propositionsEnAttente(utilisateur.id)));
