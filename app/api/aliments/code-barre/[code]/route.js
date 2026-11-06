import { q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { produitParCodeBarre } from '@/lib/openfoodfacts';
import { COLONNES_ALIMENT } from '@/lib/colonnes';

export const GET = route(async ({ utilisateur, params }) => {
  const code = String(params.code || '');
  if (!/^[0-9]{6,14}$/.test(code)) throw new ErreurHttp(400, 'Code-barres invalide');

  const connu = await q1(`SELECT ${COLONNES_ALIMENT} FROM aliments WHERE utilisateur_id = $1 AND code_barre = $2`, [
    utilisateur.id,
    code,
  ]);
  if (connu) return ok({ provenance: 'banque', aliment: connu });

  await limiter(`code-barre:${utilisateur.id}`, 120, 3600);
  const produit = await produitParCodeBarre(code);
  if (!produit) throw new ErreurHttp(404, 'Produit introuvable dans Open Food Facts');
  return ok({ provenance: 'openfoodfacts', aliment: produit });
});
