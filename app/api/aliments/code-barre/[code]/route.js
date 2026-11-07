import { q, q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';
import { limiter } from '@/lib/limite';
import { produitParCodeBarre } from '@/lib/openfoodfacts';
import { formatParUpcitemdb } from '@/lib/upcitemdb';
import { COLONNES_ALIMENT } from '@/lib/colonnes';

/** Format du contenant dans UPCitemdb (autre base de codes-barres), ou null. Ne bloque jamais le scan. */
const formatUpc = (code) => formatParUpcitemdb(code).catch(() => null);

export const GET = route(async ({ utilisateur, params }) => {
  const code = String(params.code || '');
  if (!/^[0-9]{6,14}$/.test(code)) throw new ErreurHttp(400, 'Code-barres invalide');

  const connu = await q1(`SELECT ${COLONNES_ALIMENT} FROM aliments WHERE code_barre = $1`, [
    code,
  ]);
  if (connu) {
    // Produit sans format du contenant : on le complète avec Open Food Facts, sinon UPCitemdb.
    if (connu.contenant_qte == null) {
      const produit = await produitParCodeBarre(code, { traduire: false }).catch(() => null);
      const contenant = produit?.contenant_qte ? produit : await formatUpc(code);
      if (contenant?.contenant_qte) {
        await q('UPDATE aliments SET contenant_qte = $1, contenant_unite = $2 WHERE id = $3', [
          contenant.contenant_qte,
          contenant.contenant_unite,
          connu.id,
        ]);
        connu.contenant_qte = contenant.contenant_qte;
        connu.contenant_unite = contenant.contenant_unite;
      }
    }
    return ok({ provenance: 'banque', aliment: connu });
  }

  await limiter(`code-barre:${utilisateur.id}`, 120, 3600);
  const produit = await produitParCodeBarre(code);
  if (!produit) {
    // Inconnu d'Open Food Facts : la personne entre les valeurs, mais le format peut quand même être trouvé.
    const contenant = await formatUpc(code);
    return ok({ provenance: 'introuvable', aliment: { code_barre: code, ...(contenant || {}) } });
  }
  if (!produit.contenant_qte) Object.assign(produit, (await formatUpc(code)) || {});
  return ok({ provenance: 'openfoodfacts', aliment: produit });
});
