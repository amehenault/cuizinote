'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Apple, Archive, Bot, Pencil, Plus, Refrigerator, ScanBarcode, ShoppingCart, Snowflake, Trash2, Unlink } from 'lucide-react';
import { api } from '@/lib/client';
import { EMPLACEMENTS, formaterJour, joursRestants, nombreFr } from '@/lib/dates';
import { Chargement, EntetePage, EtatVide, Message, Modale, versNombre } from '@/components/Elements';
import AjoutParScan from '@/components/AjoutParScan';
import RechercheAliment from '@/components/RechercheAliment';

const ICONES = { frigo: Refrigerator, congelateur: Snowflake, 'garde-manger': Archive };

function BadgeExpiration({ date }) {
  if (!date) return null;
  const jours = joursRestants(date);
  if (jours < 0) return <span className="etiquette etiquette--danger">Expiré</span>;
  if (jours === 0) return <span className="etiquette etiquette--danger">Expire aujourd&apos;hui</span>;
  if (jours <= 3) return <span className="etiquette etiquette--alerte">Expire dans {jours} j</span>;
  return null;
}

function FormulaireArticle({ initial, onEnregistre }) {
  const [a, setA] = useState({
    emplacement: initial.emplacement || 'frigo',
    nom: initial.nom || '',
    aliment_id: initial.aliment_id || null,
    aliment_nom: initial.aliment_nom || null,
    quantite: initial.quantite == null ? '' : String(initial.quantite),
    unite: initial.unite || '',
    expire_le: initial.expire_le || '',
  });
  const [erreur, setErreur] = useState('');
  const champ = (cle) => ({ value: a[cle], onChange: (e) => setA({ ...a, [cle]: e.target.value }) });

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
      onEnregistre();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <form className="formulaire" onSubmit={soumettre}>
      <label className="champ">
        <span className="champ__libelle">Emplacement</span>
        <select className="champ__saisie" {...champ('emplacement')}>
          {EMPLACEMENTS.map((e) => <option key={e.valeur} value={e.valeur}>{e.libelle}</option>)}
        </select>
      </label>
      <label className="champ">
        <span className="champ__libelle">Nom</span>
        <input className="champ__saisie" required maxLength={200} {...champ('nom')} />
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
          <RechercheAliment onChoisir={(al) => setA({ ...a, aliment_id: al.id, aliment_nom: al.nom, nom: a.nom || al.nom })} />
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

  const charger = () => api('/api/inventaire').then(setArticles).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
  }, []);

  async function supprimer(a) {
    await api(`/api/inventaire/${a.id}`, { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    charger();
  }

  function enregistre() {
    setModale(null);
    charger();
  }

  const visibles = (articles || []).filter((a) => a.emplacement === onglet);

  return (
    <>
      <EntetePage titre="Inventaire" sousTitre="Ce qu'il y a dans votre frigo, votre congélateur et votre garde-manger">
        <Link href="/epicerie" className="bouton bouton--secondaire">
          <ShoppingCart size={16} aria-hidden="true" />
          Épicerie
        </Link>
        <Link href="/aliments" className="bouton bouton--secondaire">
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
            setModale({ type: 'formulaire', article: { emplacement: onglet, nom: aliment.nom, aliment_id: aliment.id, aliment_nom: aliment.nom } })
          }
        />
      </Modale>
      <Modale
        titre={modale?.article?.id ? 'Modifier l\'article' : 'Ajouter à l\'inventaire'}
        ouverte={modale?.type === 'formulaire'}
        onFermer={() => setModale(null)}
      >
        {modale?.type === 'formulaire' && <FormulaireArticle key={modale.article.id || 'nouveau'} initial={modale.article} onEnregistre={enregistre} />}
      </Modale>
    </>
  );
}
