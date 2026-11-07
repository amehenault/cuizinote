// Lecture des données envoyées par une application passerelle Android (Health Connect / Samsung Health).
// Formats acceptés :
//  - Life Dashboard Companion : daily_totals[{ date, steps }], weight[{ kilograms, time }]
//  - HC Webhook : steps[{ count, start_time, end_time }], weight[{ kilograms, time }]
//  - Format Cuizinote : pas[{ jour, nombre }], poids[{ mesure_le, poids_kg }]

export const FUSEAU_DEFAUT = 'America/Toronto';
const MAX = 20000;

export function fuseauValide(fuseau) {
  if (typeof fuseau !== 'string' || fuseau.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuseau });
    return fuseau;
  } catch {
    return null;
  }
}

/** Jour local (AAAA-MM-JJ) d'un instant dans un fuseau horaire. */
export function jourLocal(date, fuseau) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const estJour = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function instant(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v > 1e12 ? v : v * 1000);
  if (typeof v !== 'string' || v.length > 40) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nombre(v) {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const tableau = (v) => (Array.isArray(v) ? v.slice(0, MAX) : []);

export function lireReception(corps) {
  const fuseau = fuseauValide(corps?.timezone) || FUSEAU_DEFAUT;
  const resultat = { fuseau, test: corps?.test === true, pasJours: new Map(), intervalles: [], poids: [], parSource: {} };
  if (!corps || typeof corps !== 'object') return resultat;

  // Totaux quotidiens (prioritaires : déjà dédoublonnés par Health Connect)
  for (const t of tableau(corps.daily_totals)) {
    const n = nombre(t?.steps);
    if (estJour(t?.date) && n != null && n >= 0) resultat.pasJours.set(t.date, Math.min(Math.round(n), 200000));
  }
  for (const p of tableau(corps.pas)) {
    const n = nombre(p?.nombre);
    if (estJour(p?.jour) && n != null && n >= 0) resultat.pasJours.set(p.jour, Math.min(Math.round(n), 200000));
  }

  // Plusieurs compteurs (téléphone, Samsung Health, montre) : total de chaque source par jour.
  // Health Connect ne garde qu'une source selon sa priorité ; on retient le compteur le plus élevé.
  for (const s of tableau(corps.steps)) {
    const debut = instant(s?.start_time);
    const fin = instant(s?.end_time) || debut;
    const n = nombre(s?.count);
    if (!debut || !fin || n == null || n < 0 || fin < debut) continue;
    const jour = jourLocal(new Date((debut.getTime() + fin.getTime()) / 2), fuseau);
    const source = typeof s?.source === 'string' ? s.source.slice(0, 120) : 'inconnue';
    resultat.parSource[jour] ??= {};
    resultat.parSource[jour][source] = (resultat.parSource[jour][source] || 0) + Math.round(n);
  }
  // Le maximum ne fait jamais baisser le total quotidien envoyé par Health Connect.
  for (const [jour, sources] of Object.entries(resultat.parSource)) {
    const meilleur = Math.min(Math.max(...Object.values(sources)), 200000);
    if (resultat.pasJours.has(jour) && meilleur > resultat.pasJours.get(jour)) resultat.pasJours.set(jour, meilleur);
  }

  // Intervalles bruts : utilisés seulement pour les jours sans total quotidien
  for (const s of tableau(corps.steps)) {
    const debut = instant(s?.start_time);
    const fin = instant(s?.end_time) || debut;
    const n = nombre(s?.count);
    if (!debut || !fin || n == null || n < 0 || fin < debut) continue;
    // Le milieu de l'intervalle évite d'attribuer un total « minuit UTC » à la veille.
    const jour = jourLocal(new Date((debut.getTime() + fin.getTime()) / 2), fuseau);
    if (resultat.pasJours.has(jour)) continue;
    resultat.intervalles.push({ debut: debut.toISOString(), fin: fin.toISOString(), jour, nombre: Math.min(Math.round(n), 200000) });
  }

  for (const w of [...tableau(corps.weight), ...tableau(corps.poids)]) {
    const kg = nombre(w?.kilograms ?? w?.poids_kg ?? w?.kg);
    const quand = instant(w?.time ?? w?.mesure_le);
    if (kg == null || kg < 20 || kg > 400 || !quand) continue;
    resultat.poids.push({ mesure_le: quand.toISOString(), poids_kg: Math.round(kg * 100) / 100 });
  }
  return resultat;
}

/** Résumé compact d'un envoi, conservé pour le diagnostic (jamais l'envoi complet). */
export function resumerEnvoi(corps, donnees) {
  const extrait = (v) => (Array.isArray(v) ? { total: v.length, derniers: v.slice(-15) } : undefined);
  const parJour = {};
  for (const i of donnees.intervalles) parJour[i.jour] = (parJour[i.jour] || 0) + i.nombre;
  const resume = {
    cles: corps && typeof corps === 'object' ? Object.keys(corps).slice(0, 30) : [],
    timezone_recu: typeof corps?.timezone === 'string' ? corps.timezone.slice(0, 64) : null,
    fuseau_utilise: donnees.fuseau,
    test: donnees.test,
    daily_totals: extrait(corps?.daily_totals),
    steps: extrait(corps?.steps),
    pas: extrait(corps?.pas),
    retenu: {
      totaux_quotidiens: Object.fromEntries([...donnees.pasJours].slice(-10)),
      intervalles_par_jour: parJour,
      pesees: donnees.poids.length,
      par_source: Object.fromEntries(Object.entries(donnees.parSource).slice(-4)),
    },
  };
  // Garde-fou de taille : on retire les extraits si le résumé devient trop gros.
  if (JSON.stringify(resume).length > 20000) {
    for (const k of ['daily_totals', 'steps', 'pas']) if (resume[k]) resume[k] = { total: resume[k].total };
  }
  return resume;
}
