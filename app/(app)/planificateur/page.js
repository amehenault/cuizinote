'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ListChecks, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/client';
import { ajouterJours, debutSemaine } from '@/lib/dates';
import { EntetePage, Message } from '@/components/Elements';
import MenuSemaine from '@/components/MenuSemaine';

export default function PagePlanificateur({ searchParams }) {
  const params = use(searchParams);
  // ?semaine=AAAA-MM-JJ ouvre directement cette semaine (ex. : « Planifier les repas » ouvre la suivante)
  const semaine = /^\d{4}-\d{2}-\d{2}$/.test(params?.semaine || '') ? debutSemaine(params.semaine) : debutSemaine();
  const [debutAffiche, setDebutAffiche] = useState(semaine);
  const [message, setMessage] = useState({ type: 'info', texte: '' });

  async function genererEpicerie() {
    const debut = debutAffiche;
    const fin = ajouterJours(debut, 6);
    try {
      const { ajoutes } = await api('/api/epicerie/generer', { methode: 'POST', corps: { debut, fin } });
      setMessage({
        type: 'succes',
        texte: ajoutes
          ? `${ajoutes} article(s) ajouté(s) à la liste d'épicerie (ce qui est déjà dans l'inventaire est ignoré).`
          : 'Rien à ajouter : tout est déjà dans votre inventaire ou votre liste.',
      });
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    }
  }

  return (
    <div className="pile">
      <EntetePage titre="Planifier les repas" sousTitre="Construisez votre menu, puis générez votre liste d'épicerie">
        <button type="button" className="bouton bouton--principal" onClick={genererEpicerie}>
          <ShoppingCart size={16} aria-hidden="true" />
          Générer l&apos;épicerie
        </button>
        <Link href="/epicerie" className="bouton bouton--secondaire">
          <ListChecks size={16} aria-hidden="true" />
          Liste d&apos;épicerie
        </Link>
      </EntetePage>
      <Message type={message.type}>{message.texte}</Message>
      <MenuSemaine key={semaine} debutInitial={semaine} onSemaine={setDebutAffiche} />
    </div>
  );
}
