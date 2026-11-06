import { createHash } from 'node:crypto';
import { q, q1 } from '@/lib/db';
import { ErreurHttp, ok, route } from '@/lib/http';
import { adresseIp, limiter } from '@/lib/limite';
import { lireReception } from '@/lib/sante-reception';

export const maxDuration = 30;

/** Clé personnelle : en-tête « Authorization: Bearer ... » ou « X-Api-Key ». */
function lireCle(requete) {
  const auth = requete.headers.get('authorization') || '';
  const cle = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : (requete.headers.get('x-api-key') || '').trim();
  return /^czs_[A-Za-z0-9_-]{40,60}$/.test(cle) ? cle : null;
}

const unique = (liste, cle) => [...new Map(liste.map((x) => [cle(x), x])).values()];

/**
 * Point de réception appelé par l'application passerelle Android.
 * Pas de cookie ici : l'accès repose uniquement sur la clé personnelle (empreinte stockée en base).
 */
export const POST = route(async ({ requete }) => {
  const ip = await adresseIp();
  const cle = lireCle(requete);
  if (!cle) {
    await limiter(`reception-ip:${ip}`, 30, 3600);
    throw new ErreurHttp(401, 'Clé absente ou invalide');
  }
  const utilisateur = await q1('SELECT id FROM utilisateurs WHERE jeton_sante = $1', [
    createHash('sha256').update(cle).digest('hex'),
  ]);
  if (!utilisateur) {
    await limiter(`reception-ip:${ip}`, 30, 3600);
    throw new ErreurHttp(401, 'Clé absente ou invalide');
  }
  await limiter(`reception:${utilisateur.id}`, 300, 3600);

  const texte = await requete.text();
  if (texte.length > 8_000_000) throw new ErreurHttp(413, 'Envoi trop volumineux');
  let corps;
  try {
    corps = JSON.parse(texte);
  } catch {
    throw new ErreurHttp(400, 'JSON invalide');
  }

  const donnees = lireReception(corps);
  const id = utilisateur.id;
  await q('UPDATE utilisateurs SET synchro_sante_le = now() WHERE id = $1', [id]);
  if (donnees.test) return ok({ ok: true, message: 'Connexion à Cuizinote réussie' });

  // 1. Totaux quotidiens : remplacent la valeur du jour (le total du jour en cours augmente au fil des envois)
  const jours = [...donnees.pasJours];
  if (jours.length) {
    await q(
      `INSERT INTO pas (utilisateur_id, jour, nombre, source)
       SELECT $1, t.j, t.n, 'health-connect' FROM unnest($2::date[], $3::int[]) AS t(j, n)
       ON CONFLICT (utilisateur_id, jour) DO UPDATE SET nombre = EXCLUDED.nombre, source = EXCLUDED.source`,
      [id, jours.map(([j]) => j), jours.map(([, n]) => n)]
    );
  }

  // 2. Intervalles bruts : dédoublonnés, puis total recalculé pour chaque jour touché
  const intervalles = unique(donnees.intervalles, (i) => `${i.debut}|${i.fin}`);
  if (intervalles.length) {
    await q(
      `INSERT INTO pas_intervalles (utilisateur_id, debut, fin, jour, nombre)
       SELECT $1, t.d, t.f, t.j, t.n FROM unnest($2::timestamptz[], $3::timestamptz[], $4::date[], $5::int[]) AS t(d, f, j, n)
       ON CONFLICT (utilisateur_id, debut, fin) DO UPDATE SET nombre = EXCLUDED.nombre, jour = EXCLUDED.jour`,
      [id, intervalles.map((i) => i.debut), intervalles.map((i) => i.fin), intervalles.map((i) => i.jour), intervalles.map((i) => i.nombre)]
    );
    const touches = [...new Set(intervalles.map((i) => i.jour))];
    await q(
      `INSERT INTO pas (utilisateur_id, jour, nombre, source)
       SELECT $1, j, least((SELECT coalesce(sum(nombre), 0) FROM pas_intervalles WHERE utilisateur_id = $1 AND jour = j), 200000), 'health-connect'
         FROM unnest($2::date[]) AS j
       ON CONFLICT (utilisateur_id, jour) DO UPDATE SET nombre = EXCLUDED.nombre, source = EXCLUDED.source`,
      [id, touches]
    );
  }

  // 3. Pesées
  const poids = unique(donnees.poids, (p) => p.mesure_le);
  if (poids.length) {
    await q(
      `INSERT INTO poids (utilisateur_id, mesure_le, poids_kg, source)
       SELECT $1, t.m, t.p, 'health-connect' FROM unnest($2::timestamptz[], $3::numeric[]) AS t(m, p)
       ON CONFLICT (utilisateur_id, mesure_le) DO UPDATE SET poids_kg = EXCLUDED.poids_kg`,
      [id, poids.map((p) => p.mesure_le), poids.map((p) => p.poids_kg)]
    );
  }

  return ok({ ok: true, jours_de_pas: jours.length + new Set(intervalles.map((i) => i.jour)).size, pesees: poids.length });
}, { public: true });
