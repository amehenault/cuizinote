'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Calculator, Download, Link2, Pencil, Plus, Save, ScanBarcode, Trash2, Unlink } from 'lucide-react';
import { api } from '@/lib/client';
import { Etoiles, Message, Modale, versNombre } from './Elements';
import AjoutParScan from './AjoutParScan';
import FormulaireAliment from './FormulaireAliment';
import RechercheAliment from './RechercheAliment';
import SaisieEtiquettes from './SaisieEtiquettes';
import TeleversementImage from './TeleversementImage';
import { resumeCalories } from '@/lib/portion';
import { estHuile, grammesDeMesure, grammesParMl, groupesPour, mesureDepuisTexte } from '@/lib/mesures';

/** Mesure de départ d'un aliment lié : celle du texte (« 2 c. à soupe »), sinon 1 spray pour une huile. */
function mesureDeDepart(texte, aliment) {
  if (!grammesParMl(aliment)) return '';
  return mesureDepuisTexte(texte) || (estHuile(aliment.nom ?? aliment.aliment_nom) ? 'spray:1' : '');
}
import SelecteurMesure from './SelecteurMesure';

/** Produit lié avec une portion d'étiquette : la quantité est un nombre de portions. */
const enPortions = (ing) => Boolean(ing.aliment_id && ing.portion_g);

/** Quantité saisie -> grammes (ou ml) utilisés pour le calcul des calories. */
function enGrammes(ing) {
  if (ing.aliment_id && ing.mesure) return grammesDeMesure(ing.mesure, ing);
  const q = versNombre(ing.grammes);
  if (q == null) return null;
  return enPortions(ing) ? q * ing.portion_g : q;
}

const texte = (v) => (v == null ? '' : String(v));

function etatInitial(r = {}) {
  return {
    titre: r.titre || '',
    description: r.description || '',
    portions: texte(r.portions ?? 4),
    temps_preparation: texte(r.temps_preparation),
    temps_cuisson: texte(r.temps_cuisson),
    etapes: r.etapes?.length ? r.etapes : [''],
    source_url: r.source_url || '',
    image_id: r.image_id || null,
    note: r.note || 0,
    commentaires: r.commentaires || '',
    kcal_portion: texte(r.kcal_portion),
    proteines_portion: texte(r.proteines_portion),
    glucides_portion: texte(r.glucides_portion),
    lipides_portion: texte(r.lipides_portion),
    nutrition_manuelle: Boolean(r.nutrition_manuelle),
    // Publiée dans la communauté par défaut
    publiee: r.publiee ?? true,
    ingredients: (r.ingredients?.length ? r.ingredients : [{ texte: '' }]).map((i) => ({
      texte: i.texte || '',
      aliment_id: i.aliment_id || null,
      aliment_nom: i.aliment_nom || null,
      kcal_100g: i.kcal_100g ?? null,
      proteines_100g: i.proteines_100g ?? null,
      glucides_100g: i.glucides_100g ?? null,
      lipides_100g: i.lipides_100g ?? null,
      unite: i.unite || 'g',
      portion_g: i.portion_g ?? null,
      portion_texte: i.portion_texte || null,
      kcal: texte(i.kcal_libre),
      mesure: i.mesure || (i.aliment_id && grammesParMl(i) ? mesureDepuisTexte(i.texte) || '' : ''),
      // Affiché en nombre de portions de l'étiquette quand c'est possible
      grammes:
        i.aliment_id && i.portion_g && i.grammes != null
          ? texte(Math.round((i.grammes / i.portion_g) * 100) / 100)
          : texte(i.grammes),
    })),
    etiquettes: r.etiquettes || [],
  };
}

function deplacer(liste, index, direction) {
  const cible = index + direction;
  if (cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  return copie;
}

export default function FormulaireRecette({ initial, recetteId = null, permettreImport = false, retourArriere = false }) {
  const routeur = useRouter();
  const [r, setR] = useState(() => etatInitial(initial));
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [lien, setLien] = useState('');
  const [importation, setImportation] = useState({ enCours: false, message: '', type: 'info' });

  const [scanOuvert, setScanOuvert] = useState(false);
  const [alimentEdite, setAlimentEdite] = useState(null);

  const maj = (cle, valeur) => setR((x) => ({ ...x, [cle]: valeur }));

  /** Ajoute une ligne d'ingrédient déjà liée à un produit de la banque. */
  function ajouterProduit(a) {
    const ligne = {
      texte: a.portion_texte ? `${a.portion_texte} ${a.nom}` : a.nom,
      aliment_id: a.id,
      aliment_nom: a.nom,
      kcal_100g: a.kcal_100g,
      proteines_100g: a.proteines_100g ?? null,
      glucides_100g: a.glucides_100g ?? null,
      lipides_100g: a.lipides_100g ?? null,
      unite: a.unite || 'g',
      portion_g: a.portion_g ?? null,
      portion_texte: a.portion_texte || null,
      grammes: a.portion_g ? '1' : '100',
      mesure: mesureDeDepart(a.portion_texte, a),
    };
    setR((x) => {
      const liste = [...x.ingredients];
      const derniere = liste[liste.length - 1];
      if (derniere && !derniere.texte.trim() && !derniere.aliment_id) liste.pop();
      return { ...x, ingredients: [...liste, ligne] };
    });
  }

  async function modifierProduit(id) {
    try {
      setAlimentEdite(await api(`/api/aliments/${id}`));
    } catch (e) {
      setErreur(e.message);
    }
  }

  /** Après modification d'un produit, met à jour toutes les lignes qui l'utilisent. */
  function produitModifie(a) {
    setR((x) => ({
      ...x,
      ingredients: x.ingredients.map((i) =>
        i.aliment_id === a.id
          ? { ...i, aliment_nom: a.nom, kcal_100g: a.kcal_100g, proteines_100g: a.proteines_100g, glucides_100g: a.glucides_100g, lipides_100g: a.lipides_100g, unite: a.unite, portion_g: a.portion_g ?? null, portion_texte: a.portion_texte || null }
          : i
      ),
    }));
    setAlimentEdite(null);
  }
  const champ = (cle) => ({ value: r[cle], onChange: (e) => maj(cle, e.target.value) });

  const majIngredient = (i, changements) =>
    setR((x) => ({ ...x, ingredients: x.ingredients.map((ing, j) => (j === i ? { ...ing, ...changements } : ing)) }));

  // Calcul en direct des calories à partir des ingrédients liés à la banque d'aliments
  const calcul = useMemo(() => {
    const lies = r.ingredients.filter((i) => i.aliment_id && enGrammes(i) != null && i.kcal_100g != null);
    const libres = r.ingredients.filter((i) => !i.aliment_id && versNombre(i.kcal) != null);
    if (!lies.length && !libres.length) return null;
    const portions = versNombre(r.portions) || 1;
    const somme = (cle) => lies.reduce((t, i) => t + ((i[cle] ?? 0) * enGrammes(i)) / 100, 0) / portions;
    const total =
      lies.reduce((t, i) => t + (i.kcal_100g * enGrammes(i)) / 100, 0) + libres.reduce((t, i) => t + versNombre(i.kcal), 0);
    return {
      total: Math.round(total),
      parPortion: Math.round(total / portions),
      proteines: Math.round(somme('proteines_100g') * 10) / 10,
      glucides: Math.round(somme('glucides_100g') * 10) / 10,
      lipides: Math.round(somme('lipides_100g') * 10) / 10,
      lies: lies.length + libres.length,
    };
  }, [r.ingredients, r.portions]);

  /** Passer en saisie manuelle part des valeurs calculées si les champs sont vides. */
  function basculerNutrition(manuelle) {
    setR((x) => ({
      ...x,
      nutrition_manuelle: manuelle,
      ...(manuelle && calcul
        ? {
            kcal_portion: x.kcal_portion || texte(calcul.parPortion),
            proteines_portion: x.proteines_portion || texte(calcul.proteines),
            glucides_portion: x.glucides_portion || texte(calcul.glucides),
            lipides_portion: x.lipides_portion || texte(calcul.lipides),
          }
        : {}),
    }));
  }

  async function importer(e) {
    e.preventDefault();
    if (!lien.trim()) return;
    setImportation({ enCours: true, message: '', type: 'info' });
    try {
      const brouillon = await api('/api/recettes/import', { methode: 'POST', corps: { url: lien.trim() } });
      setR(etatInitial({ ...brouillon, note: r.note, commentaires: r.commentaires }));
      setImportation({
        enCours: false,
        type: brouillon.complet ? 'succes' : 'alerte',
        message: brouillon.complet
          ? 'Recette importée. Vérifiez les champs puis enregistrez.'
          : 'Seuls le titre et la description ont pu être lus sur cette page. Complétez la recette à la main.',
      });
    } catch (err) {
      setImportation({ enCours: false, type: 'erreur', message: err.message });
    }
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const corps = {
        titre: r.titre,
        description: r.description || null,
        portions: versNombre(r.portions) || 1,
        temps_preparation: versNombre(r.temps_preparation),
        temps_cuisson: versNombre(r.temps_cuisson),
        etapes: r.etapes.map((s) => s.trim()).filter(Boolean),
        source_url: r.source_url || null,
        image_id: r.image_id,
        note: r.note || null,
        commentaires: r.commentaires || null,
        kcal_portion: versNombre(r.kcal_portion),
        proteines_portion: versNombre(r.proteines_portion),
        glucides_portion: versNombre(r.glucides_portion),
        lipides_portion: versNombre(r.lipides_portion),
        nutrition_manuelle: r.nutrition_manuelle,
        publiee: r.publiee,
        ingredients: r.ingredients
          .filter((i) => i.texte.trim())
          .map((i) => ({
            texte: i.texte.trim(),
            aliment_id: i.aliment_id,
            grammes: i.aliment_id ? enGrammes(i) : null,
            kcal: i.aliment_id ? null : versNombre(i.kcal),
            mesure: i.aliment_id && i.mesure ? i.mesure : null,
          })),
        etiquettes: r.etiquettes,
      };
      for (const cle of ['temps_preparation', 'temps_cuisson']) if (corps[cle] != null) corps[cle] = Math.round(corps[cle]);
      const { id } = recetteId
        ? await api(`/api/recettes/${recetteId}`, { methode: 'PUT', corps })
        : await api('/api/recettes', { methode: 'POST', corps });
      // Ouvert depuis la fiche : on y retourne (sans empiler l'historique), sinon on l'ouvre.
      if (retourArriere) routeur.back();
      else routeur.push(`/recettes/${id}`);
      routeur.refresh();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="pile pile--large">
      {permettreImport && (
        <section className="carte carte--accent">
          <div className="carte__corps">
            <h2 className="carte__titre">
              <Link2 size={18} aria-hidden="true" />
              Importer depuis un lien
            </h2>
            <p className="champ__aide">
              Collez l&apos;adresse d&apos;une page de recette : titre, ingrédients, étapes, photo et valeurs nutritives sont récupérés automatiquement.
            </p>
            <form className="importeur" onSubmit={importer}>
              <input
                className="champ__saisie importeur__champ"
                type="url"
                placeholder="https://..."
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                aria-label="Lien de la recette"
              />
              <button type="submit" className="bouton bouton--principal" disabled={importation.enCours}>
                <Download size={16} aria-hidden="true" />
                {importation.enCours ? 'Importation...' : 'Importer'}
              </button>
            </form>
            <Message type={importation.type}>{importation.message}</Message>
          </div>
        </section>
      )}

      <form className="formulaire" onSubmit={soumettre}>
        <div className="grille grille--deux">
          <div className="pile">
            <label className="champ">
              <span className="champ__libelle">Titre</span>
              <input className="champ__saisie" required maxLength={200} {...champ('titre')} />
            </label>
            <label className="champ">
              <span className="champ__libelle">Description</span>
              <textarea className="champ__saisie champ__saisie--zone" maxLength={5000} {...champ('description')} />
            </label>
            <div className="formulaire__ligne">
              <label className="champ">
                <span className="champ__libelle">Portions</span>
                <input className="champ__saisie" inputMode="decimal" required {...champ('portions')} />
              </label>
              <label className="champ">
                <span className="champ__libelle">Préparation (min)</span>
                <input className="champ__saisie" inputMode="numeric" {...champ('temps_preparation')} />
              </label>
              <label className="champ">
                <span className="champ__libelle">Cuisson (min)</span>
                <input className="champ__saisie" inputMode="numeric" {...champ('temps_cuisson')} />
              </label>
            </div>
          </div>
          <div className="pile">
            <span className="champ__libelle">Photo</span>
            <TeleversementImage imageId={r.image_id} onChange={(id) => maj('image_id', id)} />
          </div>
        </div>

        <div className="champ">
          <label className="champ__libelle" htmlFor="etiquettes">Étiquettes</label>
          <SaisieEtiquettes valeur={r.etiquettes} onChange={(v) => maj('etiquettes', v)} />
          <p className="champ__aide">Des étiquettes s'ajoutent automatiquement selon les ingrédients, à l'enregistrement.</p>
        </div>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre">Ingrédients</h2>
          </div>
          <div className="carte__corps">
            <p className="champ__aide">
              Liez un ingrédient à un produit de votre banque et indiquez la quantité (en portions de l&apos;étiquette, ex. : 2 pour 2 x « 2 c. à soupe »). Pour un ingrédient libre, entrez directement ses calories (kcal) pour toute la recette.
            </p>
            <div className="editeur-lignes">
              {r.ingredients.map((ing, i) => (
                <div key={i} className="editeur-lignes__ligne">
                  <div className="editeur-lignes__champs editeur-lignes__champs--ingredient">
                    <input
                      className="champ__saisie champ__saisie--compact"
                      placeholder="Ex. : 2 poitrines de poulet"
                      value={ing.texte}
                      maxLength={300}
                      onChange={(e) => majIngredient(i, { texte: e.target.value })}
                      aria-label={`Ingrédient ${i + 1}`}
                    />
                    {ing.aliment_id ? (
                      <div className="editeur-lignes__lie">
                        <span>
                          {ing.aliment_nom}
                          {resumeCalories(ing) && ` · ${resumeCalories(ing)}`}
                        </span>
                        <button
                          type="button"
                          className="etiquette__retirer"
                          onClick={() => modifierProduit(ing.aliment_id)}
                          aria-label={`Modifier les calories de ${ing.aliment_nom}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="etiquette__retirer"
                          onClick={() => majIngredient(i, { aliment_id: null, aliment_nom: null, kcal_100g: null, proteines_100g: null, glucides_100g: null, lipides_100g: null, portion_g: null, portion_texte: null, mesure: '' })}
                          aria-label="Délier l'aliment"
                        >
                          <Unlink size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <RechercheAliment
                        compact
                        placeholder="Lier un aliment"
                        onChoisir={(a) =>
                          majIngredient(i, {
                            aliment_id: a.id,
                            aliment_nom: a.nom,
                            kcal_100g: a.kcal_100g,
                            proteines_100g: a.proteines_100g ?? null,
                            glucides_100g: a.glucides_100g ?? null,
                            lipides_100g: a.lipides_100g ?? null,
                            unite: a.unite || 'g',
                            portion_g: a.portion_g ?? null,
                            portion_texte: a.portion_texte || null,
                            texte: ing.texte || a.nom,
                            grammes: a.portion_g ? '1' : ing.grammes || '100',
                            mesure: mesureDeDepart(ing.texte, a),
                          })
                        }
                      />
                    )}
                    {ing.aliment_id && grammesParMl(ing) ? (
                      <div className="rangee" style={{ flexWrap: 'nowrap', gap: 'var(--espace-1)' }}>
                        <SelecteurMesure
                          valeur={ing.mesure || ''}
                          onChange={(cle) => majIngredient(i, { mesure: cle })}
                          libelle={`Mesure de l'ingrédient ${i + 1}`}
                          groupes={groupesPour(ing)}
                          equivalent={ing.mesure && enGrammes(ing) != null ? `≈ ${Math.round(enGrammes(ing))} ${ing.unite || 'g'}` : null}
                          detailManuel={enPortions(ing) ? `Nombre de portions de l’étiquette (1 = ${ing.portion_texte || `${ing.portion_g} ${ing.unite || 'g'}`})` : `Quantité en ${ing.unite || 'g'}`}
                        />
                        {!ing.mesure && (
                          <input
                            className="champ__saisie champ__saisie--compact"
                            style={{ maxWidth: '6rem' }}
                            inputMode="decimal"
                            placeholder={enPortions(ing) ? 'portions' : ing.unite || 'g'}
                            value={ing.grammes}
                            onChange={(e) => majIngredient(i, { grammes: e.target.value })}
                            aria-label={enPortions(ing) ? `Nombre de portions de l'ingrédient ${i + 1}` : `Quantité de l'ingrédient ${i + 1}`}
                          />
                        )}
                      </div>
                    ) : ing.aliment_id ? (
                    <input
                      className="champ__saisie champ__saisie--compact"
                      inputMode="decimal"
                      placeholder={enPortions(ing) ? 'portions' : ing.unite || 'g / ml'}
                      title={enPortions(ing) ? `Nombre de portions (1 = ${ing.portion_texte || ing.portion_g + ' ' + (ing.unite || 'g')})` : 'Quantité en grammes ou ml'}
                      value={ing.grammes}
                      onChange={(e) => majIngredient(i, { grammes: e.target.value })}
                      aria-label={enPortions(ing) ? `Nombre de portions de l'ingrédient ${i + 1}` : `Quantité de l'ingrédient ${i + 1}`}
                    />
                    ) : (
                      <input
                        className="champ__saisie champ__saisie--compact"
                        inputMode="decimal"
                        placeholder="kcal"
                        title="Calories de cet ingrédient pour toute la recette"
                        value={ing.kcal ?? ''}
                        onChange={(e) => majIngredient(i, { kcal: e.target.value })}
                        aria-label={`Calories de l'ingrédient ${i + 1}`}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="bouton bouton--fantome bouton--icone"
                    onClick={() => setR((x) => ({ ...x, ingredients: x.ingredients.filter((_, j) => j !== i) }))}
                    aria-label={`Supprimer l'ingrédient ${i + 1}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <div className="editeur-lignes__ajout">
              <RechercheAliment placeholder="Ajouter un produit de ma banque" onChoisir={ajouterProduit} />
              <button type="button" className="bouton bouton--secondaire" onClick={() => setScanOuvert(true)}>
                <ScanBarcode size={16} aria-hidden="true" />
                Scanner un produit
              </button>
            </div>
            <div className="rangee rangee--espacee">
              <button
                type="button"
                className="bouton bouton--secondaire bouton--petit"
                onClick={() => setR((x) => ({ ...x, ingredients: [...x.ingredients, { texte: '', aliment_id: null, grammes: '', kcal: '' }] }))}
              >
                <Plus size={14} aria-hidden="true" />
                Ajouter un ingrédient libre
              </button>
              {calcul && (
                <span className="etiquette">
                  <Calculator size={12} aria-hidden="true" />
                  {calcul.parPortion} kcal/portion ({calcul.lies} ingrédient{calcul.lies > 1 ? 's' : ''} compté{calcul.lies > 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre">Étapes</h2>
          </div>
          <div className="carte__corps">
            <div className="editeur-lignes">
              {r.etapes.map((etape, i) => (
                <div key={i} className="editeur-lignes__ligne">
                  <div className="editeur-lignes__champs">
                    <span className="editeur-lignes__numero">Étape {i + 1}</span>
                    <textarea
                      className="champ__saisie"
                      rows={2}
                      value={etape}
                      maxLength={5000}
                      onChange={(e) => setR((x) => ({ ...x, etapes: x.etapes.map((s, j) => (j === i ? e.target.value : s)) }))}
                      aria-label={`Étape ${i + 1}`}
                    />
                  </div>
                  <div className="pile pile--serre">
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => maj('etapes', deplacer(r.etapes, i, -1))} aria-label="Monter">
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => maj('etapes', deplacer(r.etapes, i, 1))} aria-label="Descendre">
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="bouton bouton--fantome bouton--icone"
                      onClick={() => maj('etapes', r.etapes.filter((_, j) => j !== i))}
                      aria-label={`Supprimer l'étape ${i + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <button type="button" className="bouton bouton--secondaire bouton--petit" onClick={() => maj('etapes', [...r.etapes, ''])}>
                <Plus size={14} aria-hidden="true" />
                Ajouter une étape
              </button>
            </div>
          </div>
        </section>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre">Valeurs nutritives par portion</h2>
          </div>
          <div className="carte__corps">
            <label className="interrupteur">
              <input
                type="checkbox"
                className="interrupteur__case"
                checked={!r.nutrition_manuelle}
                onChange={(ev) => basculerNutrition(!ev.target.checked)}
              />
              <span className="interrupteur__piste" aria-hidden="true" />
              <span className="interrupteur__texte">Calcul automatique</span>
            </label>
            <p className="champ__aide">
              {r.nutrition_manuelle
                ? 'Saisie manuelle : vos valeurs ci-dessous sont utilisées partout, même si des ingrédients sont liés.'
                : calcul
                  ? `Calculé automatiquement à partir de ${calcul.lies} ingrédient${calcul.lies > 1 ? 's' : ''} (produits liés et calories saisies). Désactivez le calcul pour entrer vos propres valeurs.`
                  : 'Les valeurs se calculent seules quand vous liez des ingrédients à votre banque. En attendant, les valeurs ci-dessous (saisies ou importées) sont utilisées.'}
            </p>
            <div className="formulaire__ligne">
              {[
                ['kcal_portion', 'Calories (kcal)', calcul?.parPortion],
                ['proteines_portion', 'Protéines (g)', calcul?.proteines],
                ['glucides_portion', 'Glucides (g)', calcul?.glucides],
                ['lipides_portion', 'Lipides (g)', calcul?.lipides],
              ].map(([cle, libelle, calcule]) => {
                const automatique = !r.nutrition_manuelle && calcul;
                return (
                  <label key={cle} className="champ">
                    <span className="champ__libelle">{libelle}</span>
                    <input
                      className="champ__saisie"
                      inputMode="decimal"
                      readOnly={Boolean(automatique)}
                      value={automatique ? texte(calcule) : r[cle]}
                      onChange={(ev) => maj(cle, ev.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre">Mon avis</h2>
          </div>
          <div className="carte__corps">
            <div className="champ">
              <span className="champ__libelle">Note</span>
              <Etoiles valeur={r.note} onChange={(n) => maj('note', n)} taille={24} />
            </div>
            <label className="champ">
              <span className="champ__libelle">Commentaires et astuces</span>
              <textarea className="champ__saisie champ__saisie--zone" maxLength={10000} {...champ('commentaires')} />
            </label>
            <label className="champ">
              <span className="champ__libelle">Source</span>
              <input className="champ__saisie" type="url" placeholder="https://..." {...champ('source_url')} />
            </label>
          </div>
        </section>

        <label className="champ--case publication">
          <input type="checkbox" checked={r.publiee} onChange={(e) => maj('publiee', e.target.checked)} />
          <span>
            <strong>Publier dans la communauté</strong>
            <span className="champ__aide"> : les autres membres pourront voir cette recette et l&apos;ajouter à leurs recettes.</span>
          </span>
        </label>

        <Message type="erreur">{erreur}</Message>
        <div className="formulaire__actions">
          <button type="button" className="bouton bouton--secondaire" onClick={() => routeur.back()}>
            Annuler
          </button>
          <button type="submit" className="bouton bouton--principal" disabled={envoi}>
            <Save size={16} aria-hidden="true" />
            {envoi ? 'Enregistrement...' : 'Enregistrer la recette'}
          </button>
        </div>
      </form>

      <Modale titre="Scanner un produit" ouverte={scanOuvert} onFermer={() => setScanOuvert(false)}>
        {scanOuvert && (
          <AjoutParScan
            onEnregistre={(a) => {
              ajouterProduit(a);
              setScanOuvert(false);
            }}
          />
        )}
      </Modale>
      <Modale titre="Modifier le produit" ouverte={!!alimentEdite} onFermer={() => setAlimentEdite(null)}>
        {alimentEdite && <FormulaireAliment key={alimentEdite.id} initial={alimentEdite} onEnregistre={produitModifie} />}
      </Modale>
    </div>
  );
}
