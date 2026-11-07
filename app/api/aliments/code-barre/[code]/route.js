import { q, q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { produitParCodeBarre } from '@/lib/openfoodfacts';
import { COLONNES_ALIMENT } from '@/lib/colonnes';

export const GET = route(async ({ utilisateur, params }) => {
  const code = String(params.code || '');
  if (!/^[0-9]{6,14}$/.test(code)) throw new ErreurHttp(400, 'Code-barres invalide');

  const connu = await q1(`SELECT ${COLONNES_ALIMENT} FROM aliments WHERE code_barre = $1`, [
    code,
  ]);
  if (connu) {
    // Produit scanné avant l'ajout du format du contenant : on le complète une fois avec Open Food Facts.
    if (connu.contenant_qte == null) {
      const produit = await produitParCodeBarre(code).catch(() => null);
      if (produit?.contenant_qte) {
        await q('UPDATE aliments SET contenant_qte = $1, contenant_unite = $2 WHERE id = $3', [
          produit.contenant_qte,
          produit.contenant_unite,
          connu.id,
        ]);
        connu.contenant_qte = produit.contenant_qte;
        connu.contenant_unite = produit.contenant_unite;
      }
    }
    return ok({ provenance: 'banque', aliment: connu });
  }

  await limiter(`code-barre:${utilisateur.id}`, 120, 3600);
  const produit = await produitParCodeBarre(code);
  if (!produit) throw new ErreurHttp(404, 'Produit introuvable dans Open Food Facts');
  return ok({ provenance: 'openfoodfacts', aliment: produit });
});
