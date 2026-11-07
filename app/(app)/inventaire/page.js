'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Apple, Archive, Bot, Pencil, Plus, Refrigerator, ScanBarcode, ShoppingCart, Snowflake, Trash2, Unlink } from 'lucide-react';
import { api } from '@/lib/client';
import { EMPLACEMENTS, formaterJour, joursRestants, nombreFr } from '@/lib/dates';
import { Chargement, EntetePage, EtatVide, Message, Modale, versNombre } from '@/components/Elements';
import AjoutParScan from '@/components/AjoutParScan';
import RechercheAliment from '@/components/RechercheAliment';
import { quantiteParDefaut } from '@/lib/portion';
import { rangementPour } from '@/lib/rangement';
import QuestionRangement from '@/components/QuestionRangement';

const ICONES = { frigo: Refrigerator, congelateur: Snowflake, 'garde-manger': Archive };

function BadgeExpiration({ date }) {
  if (!date) return null;
  const jours = joursRestants(date);
  if (jours < 0) return <span className="etiquette etiquette--danger">Expiré</span>;
  if (jours === 0) return <span className="etiquette etiquette--danger">Expire aujourd&apos;hui</span>;
  if (jours <= 3) return <span className="etiquette etiquette--alerte">Expire dans {jours} j</span>;
  return null;
}

function FormulaireArticle({ initial, onEnregistre, rangements }) {
  const [emplacementTouche, setEmplacementTouche] = useState(Boolean(initial.id));
  const [a, setA] = useState({
    emplacement: initial.emplacement || 'frigo',
    nom: initial.nom || '',
    aliment_id: initial.aliment_id || null,
    aliment_nom: initial.aliment_nom || null,
    // Nouvel article, ou article sans quantité : un contenant complet par défaut (ex. : 1 × 893 ml)
    ...(initial.id && initial.quantite != null
      ? { quantite: String(initial.quantite), unite: initial.unite || '' }
      : initial.id
        ? quantiteParDefaut({ contenant_qte: initial.contenant_qte, contenant_unite: initial.contenant_unite, unite: initial.aliment_unite })
        : { quantite: initial.quantite ?? '1', unite: initial.unite ?? '' }),
    expire_le: initial.expire_le || '',
  });
  const [erreur, setErreur] = useState('');
  const champ = (cle) => ({ value: a[cle], onChange: (e) => setA({ ...a, [cle]: e.target.value }) });
  /** Nouveau produit choisi ou nom tapé : son rangement habituel. */
  const avecRangement = (suivant) => {
    const defaut = !emplacementTouche && rangementPour(rangements, suivant);
    return defaut ? { ...suivant, emplacement: defaut } : suivant;
  };

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    const corps = {
      emplacement: a.emplacement,
      nom: a.nom,
      aliment_id: a.aliment_id,
      quantite: versNombre(a.quantite),
      unite: a.unite || null,
      expire_le: a.expire_le || null,
    };
    try {
      if (initial.id) await api(`/api/inventaire/${initial.id}`, { methode: 'PUT', corps });
      else await api('/api/inventaire', { methode: 'POST', corps });
      // Rangé ailleurs que d'habitude : on proposera d'en faire le rangement par défaut.
      const habituel = rangementPour(rangements, a);
      onEnregistre(
        habituel && habituel !== a.emplacement
          ? { nom: a.nom, aliment_id: a.aliment_id, avant: habituel, apres: a.emplacement }
          : null
      );
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <form className="formulaire" onSubmit={soumettre}>
      <label className="champ">
        <span className="champ__libelle">Emplacement</span>
        <select
          className="champ__saisie"
          value={a.emplacement}
          onChange={(e) => {
            setEmplacementTouche(true);
            setA({ ...a, emplacement: e.target.value });
          }}
        >
          {EMPLACEMENTS.map((e) => <option key={e.valeur} value={e.valeur}>{e.libelle}</option>)}
        </select>
      </label>
      <label className="champ">
        <span className="champ__libelle">Nom</span>
        <input className="champ__saisie" required maxLength={200} {...champ('nom')} onBlur={() => setA((x) => avecRangement(x))} />
      </label>
      <div className="champ">
        <span className="champ__libelle">Aliment lié (facultatif)</span>
        {a.aliment_id ? (
          <div className="editeur-lignes__lie">
            <span>{a.aliment_nom || 'Aliment de la banque'}</span>
            <button type="button" className="etiquette__retirer" onClick={() => setA({ ...a, aliment_id: null, aliment_nom: null })} aria-label="Délier">
              <Unlink size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <RechercheAliment
            onChoisir={(al) => {
              const defaut = quantiteParDefaut(al);
              setA(avecRangement({
                ...a,
                aliment_id: al.id,
                aliment_nom: al.nom,
                nom: a.nom || al.nom,
                // Quantité encore vide ou par défaut : on met un contenant complet de cet aliment
                ...(!a.unite && (a.quantite === '' || a.quantite === '1') ? defaut : {}),
              }));
            }}
          />
        )}
      </div>
      <div className="formulaire__ligne">
        <label className="champ">
          <span className="champ__libelle">Quantité</span>
          <input className="champ__saisie" inputMode="decimal" {...champ('quantite')} />
        </label>
        <label className="champ">
          <span className="champ__libelle">Unité</span>
          <input className="champ__saisie" placeholder="g, ml, unités..." maxLength={30} {...champ('unite')} />
        </label>
        <label className="champ">
          <span className="champ__libelle">Date d&apos;expiration</span>
          <input className="champ__saisie" type="date" {...champ('expire_le')} />
        </label>
      </div>
      <Message type="erreur">{erreur}</Message>
      <div className="formulaire__actions">
        <button type="submit" className="bouton bouton--principal">Enregistrer</button>
      </div>
    </form>
  );
}

export default function PageInventaire() {
  const [articles, setArticles] = useState(null);
  const [onglet, setOnglet] = useState('frigo');
  const [modale, setModale] = useState(null); // { type: 'scan' | 'formulaire', article }
  const [erreur, setErreur] = useState('');
  const [rangements, setRangements] = useState({});
  const [question, setQuestion] = useState(null);
  const chargerRangements = () => api('/api/inventaire/rangements').then(setRangements).catch(() => {});

  const charger = () => api('/api/inventaire').then(setArticles).catch((e) => setErreur(e.message));
  const [completion, setCompletion] = useState('');

  /** Formats de contenant (Open Food Facts) et quantités vides : complétés automatiquement. */
  async function completer() {
    let total = 0;
    let formats = 0;
    try {
      let precedent = Infinity;
      for (let tour = 0; tour < 40; tour += 1) {
        const r = await api('/api/inventaire/completer', { methode: 'POST' });
        total += r.quantites;
        formats += r.trouves;
        if (r.quantites) charger();
        if (r.restant) setCompletion(`Recherche du format de vos produits... (${r.restant} restant${r.restant > 1 ? 's' : ''})`);
        // Fini, ou plus de progrès (service indisponible) : on réessaiera à la prochaine visite.
        if (!r.restant || r.restant >= precedent) break;
        precedent = r.restant;
      }
    } catch {
      // Service indisponible : on réessaiera à la prochaine visite.
    }
    const morceaux = [];
    if (formats) morceaux.push(`${formats} format${formats > 1 ? 's' : ''} de contenant trouvé${formats > 1 ? 's' : ''}`);
    if (total) morceaux.push(`${total} quantité${total > 1 ? 's' : ''} complétée${total > 1 ? 's' : ''}`);
    setCompletion(morceaux.length ? `${morceaux.join(' ; ')}.`.replace(/^./, (c) => c.toUpperCase()) : '');
  }


  useEffect(() => {
    charger();
    chargerRangements();
    completer();
  }, []);

  async function supprimer(a) {
    if (!window.confirm(`Retirer « ${a.nom} » de l'inventaire ?`)) return;
    await api(`/api/inventaire/${a.id}`, { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    charger();
  }

  function enregistre(questionRangement) {
    setModale(null);
    charger();
    chargerRangements(); // un premier rangement devient le rangement par défaut
    if (questionRangement) setQuestion(questionRangement);
  }

  const visibles = (articles || []).filter((a) => a.emplacement === onglet);

  return (
    <>
      <EntetePage titre="Inventaire" sousTitre="Ce qu'il y a dans votre frigo, votre congélateur et votre garde-manger">
        <Link href="/epicerie" className="bouton bouton--secondaire">
          <ShoppingCart size={16} aria-hidden="true" />
          Épicerie
        </Link>
        <Link href="/aliments?de=inventaire" className="bouton bouton--secondaire">
          <Apple size={16} aria-hidden="true" />
          Aliments
        </Link>
        <Link href="/assistant" className="bouton bouton--accent">
          <Bot size={16} aria-hidden="true" />
          Idées de repas
        </Link>
        <button type="button" className="bouton bouton--secondaire" onClick={() => setModale({ type: 'scan' })}>
          <ScanBarcode size={16} aria-hidden="true" />
          Scanner
        </button>
        <button type="button" className="bouton bouton--principal" onClick={() => setModale({ type: 'formulaire', article: { emplacement: onglet } })}>
          <Plus size={16} aria-hidden="true" />
          Ajouter
        </button>
      </EntetePage>

      <div className="onglets" role="tablist">
        {EMPLACEMENTS.map((e) => {
          const Icone = ICONES[e.valeur];
          const total = (articles || []).filter((a) => a.emplacement === e.valeur).length;
          return (
            <button
              key={e.valeur}
              type="button"
              role="tab"
              aria-selected={onglet === e.valeur}
              className={`onglets__bouton${onglet === e.valeur ? ' onglets__bouton--actif' : ''}`}
              onClick={() => setOnglet(e.valeur)}
            >
              <Icone size={16} aria-hidden="true" />
              {e.libelle}
              <span className="onglets__compte">{total}</span>
            </button>
          );
        })}
      </div>

      <Message type="erreur">{erreur}</Message>
      <Message type="info">{completion}</Message>
      {!articles && !erreur && <Chargement />}
      {articles && visibles.length === 0 && (
        <EtatVide Icone={ICONES[onglet]} titre="Rien ici pour le moment">
          <p>Ajoutez des articles à la main ou en scannant leur code-barres.</p>
        </EtatVide>
      )}
      {visibles.length > 0 && (
        <div className="carte">
          <ul className="liste">
            {visibles.map((a) => (
              <li key={a.id} className="liste__element">
                <div className="liste__principal">
                  <p className="liste__titre">{a.nom}</p>
                  {a.marque && <p className="liste__marque-texte">{a.marque}</p>}
                  <p className="liste__detail">
                    {[a.quantite != null && `${nombreFr(a.quantite, 2)} ${a.unite || ''}`.trim(),
                      a.expire_le && `Expire le ${formaterJour(a.expire_le, { day: 'numeric', month: 'long', year: 'numeric' })}`]
                      .filter(Boolean)
                      .join(' · ') || `Ajouté le ${formaterJour(a.ajoute_le, { day: 'numeric', month: 'long' })}`}
                  </p>
                </div>
                <BadgeExpiration date={a.expire_le} />
                <div className="liste__actions">
                  <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => setModale({ type: 'formulaire', article: a })} aria-label={`Modifier ${a.nom}`}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer(a)} aria-label={`Retirer ${a.nom}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modale titre="Scanner un produit" ouverte={modale?.type === 'scan'} onFermer={() => setModale(null)}>
        <AjoutParScan
          onEnregistre={(aliment) =>
            setModale({ type: 'formulaire', article: { emplacement: rangementPour(rangements, { aliment_id: aliment.id, nom: aliment.nom }) || onglet, nom: aliment.nom, aliment_id: aliment.id, aliment_nom: aliment.nom, ...quantiteParDefaut(aliment) } })
          }
        />
      </Modale>
      <Modale
        titre={modale?.article?.id ? 'Modifier l\'article' : 'Ajouter à l\'inventaire'}
        ouverte={modale?.type === 'formulaire'}
        onFermer={() => setModale(null)}
      >
        {modale?.type === 'formulaire' && <FormulaireArticle key={modale.article.id || 'nouveau'} initial={modale.article} onEnregistre={enregistre} rangements={rangements} />}
      </Modale>
      <QuestionRangement
        question={question}
        onFin={(enregistre) => {
          setQuestion(null);
          if (enregistre) chargerRangements();
        }}
      />
    </>
  );
}
