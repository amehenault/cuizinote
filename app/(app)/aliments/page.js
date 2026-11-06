'use client';

import { useEffect, useState } from 'react';
import { Apple, Pencil, Plus, ScanBarcode, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { nombreFr } from '@/lib/dates';
import { Chargement, EntetePage, EtatVide, Message, Modale } from '@/components/Elements';
import AjoutParScan from '@/components/AjoutParScan';
import FormulaireAliment from '@/components/FormulaireAliment';

export default function PageAliments() {
  const [aliments, setAliments] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [modale, setModale] = useState(null); // { type: 'scan' | 'formulaire', aliment? }
  const [erreur, setErreur] = useState('');

  const charger = () => api('/api/aliments').then(setAliments).catch((e) => setErreur(e.message));
  useEffect(() => {
    charger();
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
      <EntetePage titre="Banque d'aliments" sousTitre="Valeurs nutritives utilisées pour calculer vos repas">
        <button type="button" className="bouton bouton--principal" onClick={() => setModale({ type: 'scan' })}>
          <ScanBarcode size={16} aria-hidden="true" />
          Scanner
        </button>
        <button type="button" className="bouton bouton--secondaire" onClick={() => setModale({ type: 'formulaire', aliment: {} })}>
          <Plus size={16} aria-hidden="true" />
          Ajouter
        </button>
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
                {a.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="aliment__vignette" src={a.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span className="aliment__vignette aliment__vignette--vide"><Apple size={20} aria-hidden="true" /></span>
                )}
                <div className="liste__principal">
                  <p className="liste__titre">{a.nom}</p>
                  <p className="liste__detail">
                    {[a.marque, a.kcal_100g != null && `${nombreFr(a.kcal_100g)} kcal/100 g`,
                      a.proteines_100g != null && `P ${nombreFr(a.proteines_100g, 1)} g`,
                      a.glucides_100g != null && `G ${nombreFr(a.glucides_100g, 1)} g`,
                      a.lipides_100g != null && `L ${nombreFr(a.lipides_100g, 1)} g`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="liste__actions">
                  <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => setModale({ type: 'formulaire', aliment: a })} aria-label={`Modifier ${a.nom}`}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="bouton bouton--fantome bouton--icone" onClick={() => supprimer(a)} aria-label={`Supprimer ${a.nom}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modale titre="Scanner un code-barres" ouverte={modale?.type === 'scan'} onFermer={() => { setModale(null); charger(); }}>
        <AjoutParScan onEnregistre={enregistre} />
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
