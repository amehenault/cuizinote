// Lecture CSV minimale (guillemets, virgules ou points-virgules).
export function lireCsv(texte) {
  const lignes = [];
  let ligne = [];
  let champ = '';
  let guillemets = false;
  const premiere = texte.split('\n').find((l) => l.trim() && !/^\uFEFF?com\.samsung/.test(l)) || '';
  const sep = (premiere.match(/;/g) || []).length > (premiere.match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); ligne = []; champ = ''; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.map((l) => l.map((v) => v.replace(/^\uFEFF/, '').trim())).filter((l) => l.some(Boolean));
}

function dateLocale(valeur) {
  if (!valeur) return null;
  if (/^\d{12,13}$/.test(valeur)) return new Date(Number(valeur));
  const d = new Date(valeur.replace(/\//g, '-').replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Export VeSync (application VeSync > balance > exporter les données) :
 * détecte la colonne date et la colonne poids (kg ou lb).
 */
export function lirePoidsVesync(texte) {
  const lignes = lireCsv(texte);
  const iEntete = lignes.findIndex((l) => l.some((c) => /poids|weight/i.test(c)));
  if (iEntete < 0) return [];
  const entete = lignes[iEntete].map((c) => c.toLowerCase());
  const iDate = entete.findIndex((c) => /date|time|heure/.test(c));
  const iPoids = entete.findIndex((c) => /poids|weight/.test(c));
  const iGras = entete.findIndex((c) => /fat|gras/.test(c) && !/free|visc/.test(c));
  const enLivres = /lb/.test(entete[iPoids]);
  const resultat = [];
  for (const l of lignes.slice(iEntete + 1)) {
    const date = dateLocale(l[iDate]);
    let poids = parseFloat(String(l[iPoids]).replace(',', '.').replace(/[^\d.]/g, ''));
    if (!date || !poids) continue;
    if (enLivres || /lb/i.test(l[iPoids])) poids = poids * 0.45359237;
    const gras = iGras >= 0 ? parseFloat(String(l[iGras]).replace(',', '.')) : NaN;
    if (poids < 20 || poids > 400) continue;
    resultat.push({
      mesure_le: date.toISOString(),
      poids_kg: Math.round(poids * 100) / 100,
      gras_pct: Number.isFinite(gras) && gras > 0 && gras < 80 ? gras : null,
    });
  }
  return resultat;
}

/**
 * Export Samsung Health (Paramètres > Télécharger les données personnelles) :
 * fichier com.samsung.shealth.step_daily_trend.*.csv ou pedometer_day_summary.
 */
export function lirePasSamsung(texte) {
  const lignes = lireCsv(texte);
  const iEntete = lignes.findIndex((l) => l.some((c) => /(^|\.)count$|step_count|^steps?$|^pas$/i.test(c)));
  if (iEntete < 0) return [];
  const entete = lignes[iEntete].map((c) => c.toLowerCase().replace(/^.*\./, ''));
  const iPas = entete.findIndex((c) => ['step_count', 'count', 'steps', 'step', 'pas'].includes(c));
  const iJour = ['day_time', 'date', 'jour', 'create_time', 'start_time'].map((n) => entete.indexOf(n)).find((i) => i >= 0);
  const iSource = entete.indexOf('source_type');
  const parJour = new Map();
  for (const l of lignes.slice(iEntete + 1)) {
    const date = dateLocale(l[iJour]);
    const nombre = parseInt(l[iPas], 10);
    if (!date || !Number.isFinite(nombre) || nombre < 0) continue;
    // day_time Samsung = minuit UTC du jour concerné
    const jour = date.toISOString().slice(0, 10);
    const source = iSource >= 0 ? l[iSource] : null;
    const actuel = parJour.get(jour);
    // source_type -2 = total fusionné de tous les appareils : prioritaire
    if (source === '-2') parJour.set(jour, { nombre, prioritaire: true });
    else if (!actuel || (!actuel.prioritaire && nombre > actuel.nombre)) parJour.set(jour, { nombre, prioritaire: false });
  }
  return [...parJour].map(([jour, v]) => ({ jour, nombre: Math.min(v.nombre, 200000) }));
}
