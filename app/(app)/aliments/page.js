'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Apple, ArrowLeft, Bot, Check, Pencil, Plus, ScanBarcode, Search, ShoppingCart, Trash2, UsersRound } from 'lucide-react';
import { api } from '@/lib/client';
import { resumeCalories } from '@/lib/portion';
import { Chargement, EntetePage, EtatVide, Message, Modale } from '@/components/Elements';
import AjoutParScan from '@/components/AjoutParScan';
import FicheAliment from '@/components/FicheAliment';
import FormulaireAliment from '@/components/FormulaireAliment';
import VignetteAliment from '@/components/VignetteAliment';
import { trouverEnInventaire } from '@/lib/disponibilite';

// Boutons de la section d'où l'on vient (Recettes ou Inventaire) : ils restent affichés ici.
const BOUTONS_SECTION = {
  recettes: [
    { href: '/recettes', libelle: 'Mes recettes', Icone: ArrowLeft },
    { href: '/assistant', libelle: 'Assistant culinaire', Icone: Bot },
    { href: '/communaute', libelle: 'Communauté', Icone: UsersRound },
  ],
  inventaire: [
    { href: '/inventaire', libelle: 'Inventaire', Icone: ArrowLeft },
    { href: '/epicerie', libelle: 'Épicerie', Icone: ShoppingCart },
    { href: '/assistant', libelle: 'Idées de repas', Icone: Bot },
  ],
};

export default function PageAliments() {
  const section = BOUTONS_SECTION[useSearchParams().get('de')] || [];
  const [aliments, setAliments] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [modale, setModale] = useState(null); // { type: 'scan' | 'formulaire', aliment? }
  const [erreur, setErreur] = useState('');
  const [inventaire, setInventaire] = useState([]);

  const charger = () => api('/api/aliments').then(setAliments).catch((e) => setErreur(e.message));
  const chargerInventaire = () => api('/api/inventaire').then(setInventaire).catch(() => {});
  useEffect(() => {
    charger();
    chargerInventaire();
  }, []);

  async function supprimer(a) {
    if (!window.confirm(`Supprimer « ${a.nom} » de la banque ?`)) return;
    await api(`/api/aliments/${a.id}`, { methode: 'DELETE' }).catch((e) => setErreur(e.message));
    charger();
  }

  function enregistre() {
    setModale(null);
    charger();
  }

  const filtres = (aliments || []).filter((a) =>
    `${a.nom} ${a.marque || ''} ${a.code_barre || ''}`.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <>
      <EntetePage titre="Banque d'aliments" sousTitre="Banque commune à tous les membres : ce que vous ajoutez ou corrigez sert à tout le monde">
        <button type="button" className="bouton bouton--principal" onClick={() => setModale({ type: 'scan' })}>
          <ScanBarcode size={16} aria-hidden="true" />
          Scanner
        </button>
        <button type="button" className="bouton bouton--secondaire" onClick={() => setModale({ type: 'formulaire', aliment: {} })}>
          <Plus size={16} aria-hidden="true" />
          Ajouter
        </button>
        {section.map(({ href, libelle, Icone }) => (
          <Link key={href} href={href} className="bouton bouton--secondaire">
            <Icone size={16} aria-hidden="true" />
            {libelle}
          </Link>
        ))}
      </EntetePage>

      <div className="filtres">
        <div className="recherche">
          <Search className="recherche__icone" size={16} aria-hidden="true" />
          <input
            className="champ__saisie recherche__saisie"
            placeholder="Rechercher un aliment, une marque ou un code"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher un aliment"
          />
        </div>
      </div>

      <Message type="erreur">{erreur}</Message>
      {!aliments && !erreur && <Chargement />}
      {aliments?.length === 0 && (
        <EtatVide Icone={Apple} titre="Votre banque est vide">
          <p>Scannez le code-barres d&apos;un produit pour récupérer ses calories automatiquement.</p>
        </EtatVide>
      )}
      {filtres.length > 0 && (
        <div className="carte">
          <ul className="liste">
            {filtres.map((a) => (
              <li key={a.id} className="liste__element">
                <VignetteAliment aliment={a} />
                <button type="button" className="liste__principal liste__bouton" onClick={() => setModale({ type: 'fiche', aliment: a })}>
                  <span className="liste__titre">
                    {a.nom}
                    {trouverEnInventaire({ aliment_id: a.id, nom: a.nom }, inventaire) && (
                      <span className="etiquette etiquette--succes liste__marque">
                        <Check size={12} aria-hidden="true" />
                        J&apos;ai
                      </span>
                    )}
                  </span>
                  <span className="liste__detail">
                    {[a.marque, resumeCalories(a)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <div className="liste__actions">
                  <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => setModale({ type: 'formulaire', aliment: a })} aria-label={`Modifier ${a.nom}`}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  {a.mien && (
                    <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer(a)} aria-label={`Supprimer ${a.nom}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modale titre="Scanner un code-barres" ouverte={modale?.type === 'scan'} onFermer={() => { setModale(null); charger(); }}>
        <AjoutParScan onEnregistre={enregistre} />
      </Modale>
      <Modale titre="Fiche de l'aliment" ouverte={modale?.type === 'fiche'} onFermer={() => setModale(null)}>
        {modale?.type === 'fiche' && (
          <FicheAliment
            aliment={modale.aliment}
            inventaire={inventaire}
            onModifier={() => setModale({ type: 'formulaire', aliment: modale.aliment })}
            onInventaireChange={chargerInventaire}
          />
        )}
      </Modale>
      <Modale
        titre={modale?.aliment?.id ? 'Modifier l\'aliment' : 'Nouvel aliment'}
        ouverte={modale?.type === 'formulaire'}
        onFermer={() => setModale(null)}
      >
        {modale?.type === 'formulaire' && <FormulaireAliment initial={modale.aliment} onEnregistre={enregistre} />}
      </Modale>
    </>
  );
}
