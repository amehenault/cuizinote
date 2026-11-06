'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, Bot, CalendarDays, Flame, Footprints, Plus, Scale, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/client';
import { EMPLACEMENTS, MOMENTS, formaterJour, joursRestants, nombreFr, versIso } from '@/lib/dates';
import { Chargement, EntetePage, Message } from '@/components/Elements';

export default function PageAccueil() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const jour = versIso();

  useEffect(() => {
    api(`/api/tableau-de-bord?jour=${jour}`).then(setDonnees).catch((e) => setErreur(e.message));
  }, [jour]);

  if (erreur) return <Message type="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;

  const { utilisateur, repas, poids, pas, expirent, totaux } = donnees;
  const kcal = repas.reduce((s, r) => s + (r.kcal || 0), 0);
  const kcalManges = repas.filter((r) => r.mange).reduce((s, r) => s + (r.kcal || 0), 0);
  const pasDuJour = pas.find((p) => p.jour === jour)?.nombre;
  const objectif = utilisateur.objectif_kcal;
  const libelleEmplacement = (v) => EMPLACEMENTS.find((e) => e.valeur === v)?.libelle;

  return (
    <div className="pile pile--large">
      <EntetePage titre={`Bonjour ${utilisateur.nom}`} sousTitre={formaterJour(jour)}>
        <Link href="/recettes/nouvelle" className="bouton bouton--principal">
          <Plus size={16} aria-hidden="true" />
          Nouvelle recette
        </Link>
        <Link href="/assistant" className="bouton bouton--accent">
          <Bot size={16} aria-hidden="true" />
          Idées de repas
        </Link>
      </EntetePage>

      <div className="grille grille--stats">
        <div className="stat">
          <span className="stat__libelle"><Flame size={16} aria-hidden="true" />Calories planifiées</span>
          <span className="stat__valeur">{nombreFr(kcal)}</span>
          <span className="stat__note">{objectif ? `sur ${nombreFr(objectif)} kcal · ${nombreFr(kcalManges)} mangées` : `${nombreFr(kcalManges)} kcal mangées`}</span>
          {objectif > 0 && (
            <div className="jauge">
              <div className={`jauge__remplissage${kcal > objectif ? ' jauge__remplissage--depasse' : ''}`} style={{ width: `${Math.min(100, (kcal / objectif) * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="stat">
          <span className="stat__libelle"><Scale size={16} aria-hidden="true" />Poids</span>
          <span className="stat__valeur">{poids[0] ? `${nombreFr(poids[0].poids_kg, 1)} kg` : '-'}</span>
          {poids[1] && (
            <span className="stat__note">
              {poids[0].poids_kg - poids[1].poids_kg > 0 ? '+' : ''}{nombreFr(poids[0].poids_kg - poids[1].poids_kg, 1)} kg depuis la pesée précédente
            </span>
          )}
        </div>
        <div className="stat">
          <span className="stat__libelle"><Footprints size={16} aria-hidden="true" />Pas aujourd&apos;hui</span>
          <span className="stat__valeur">{pasDuJour != null ? nombreFr(pasDuJour) : '-'}</span>
          <span className="stat__note">
            {pas.length ? `Moyenne 7 jours : ${nombreFr(pas.reduce((s, p) => s + p.nombre, 0) / pas.length)}` : 'Importez vos pas dans Santé'}
          </span>
        </div>
        <div className="stat">
          <span className="stat__libelle"><ShoppingCart size={16} aria-hidden="true" />Épicerie</span>
          <span className="stat__valeur">{totaux.epicerie}</span>
          <span className="stat__note">article{totaux.epicerie > 1 ? 's' : ''} à acheter</span>
        </div>
      </div>

      <div className="grille grille--deux">
        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre"><CalendarDays size={18} aria-hidden="true" />Menu du jour</h2>
            <Link href="/planificateur" className="bouton bouton--fantome bouton--petit">Planificateur</Link>
          </div>
          <div className="carte__corps">
            {repas.length === 0 ? (
              <p className="champ__aide">Aucun repas planifié aujourd&apos;hui.</p>
            ) : (
              MOMENTS.map((m) => {
                const liste = repas.filter((r) => r.moment === m.valeur);
                if (!liste.length) return null;
                return (
                  <div key={m.valeur} className="semaine__moment">
                    <span className="semaine__moment-titre">{m.libelle}</span>
                    {liste.map((r) => (
                      <div key={r.id} className={`semaine__repas${r.mange ? ' semaine__repas--mange' : ''}`}>
                        {r.recette_id ? (
                          <Link href={`/recettes/${r.recette_id}`} className="semaine__repas-nom">{r.recette_titre}</Link>
                        ) : (
                          <span className="semaine__repas-nom">{r.aliment_nom || r.libelle}</span>
                        )}
                        {r.kcal != null && <span className="semaine__repas-kcal">{nombreFr(r.kcal)} kcal</span>}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="carte">
          <div className="carte__entete">
            <h2 className="carte__titre"><AlertTriangle size={18} aria-hidden="true" />À consommer bientôt</h2>
            <Link href="/inventaire" className="bouton bouton--fantome bouton--petit">Inventaire</Link>
          </div>
          <div className="carte__corps">
            {expirent.length === 0 ? (
              <p className="champ__aide">Rien n&apos;expire dans les 3 prochains jours.</p>
            ) : (
              <ul className="liste">
                {expirent.map((a) => {
                  const j = joursRestants(a.expire_le);
                  return (
                    <li key={a.id} className="liste__element">
                      <div className="liste__principal">
                        <p className="liste__titre">{a.nom}</p>
                        <p className="liste__detail">{libelleEmplacement(a.emplacement)}</p>
                      </div>
                      <span className={`etiquette ${j <= 0 ? 'etiquette--danger' : 'etiquette--alerte'}`}>
                        {j < 0 ? 'Expiré' : j === 0 ? 'Aujourd\'hui' : `${j} j`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grille grille--stats">
        <Link href="/recettes" className="stat">
          <span className="stat__libelle"><BookOpen size={16} aria-hidden="true" />Recettes</span>
          <span className="stat__valeur">{totaux.recettes}</span>
        </Link>
        <Link href="/aliments" className="stat">
          <span className="stat__libelle">Aliments en banque</span>
          <span className="stat__valeur">{totaux.aliments}</span>
        </Link>
        <Link href="/inventaire" className="stat">
          <span className="stat__libelle">Articles en inventaire</span>
          <span className="stat__valeur">{totaux.inventaire}</span>
        </Link>
      </div>
    </div>
  );
}
