'use client';

import { useMemo, useRef, useState } from 'react';

const L = 640;
const H = 220;
const MARGES = { haut: 12, droite: 12, bas: 26, gauche: 40 };

function graduations(min, max, n = 4) {
  if (min === max) return [min];
  const pas = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => min + pas * i);
}

const dateCourte = (iso) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });

function TableDonnees({ points, unite, decimales }) {
  return (
    <details>
      <summary className="champ__aide">Voir les données</summary>
      <table className="tableau">
        <thead>
          <tr>
            <th className="tableau__cellule tableau__cellule--entete">Date</th>
            <th className="tableau__cellule tableau__cellule--entete tableau__cellule--nombre">{unite}</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.x}>
              <td className="tableau__cellule">{dateCourte(p.x)}</td>
              <td className="tableau__cellule tableau__cellule--nombre">
                {p.y.toLocaleString('fr-CA', { maximumFractionDigits: decimales })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Courbe à une seule série (poids). Points : [{ x: date ISO, y: nombre }]. */
export function GraphiqueLigne({ points, unite = 'kg', libelle }) {
  const svg = useRef(null);
  const [survol, setSurvol] = useState(null);

  const geo = useMemo(() => {
    if (!points.length) return null;
    const ys = points.map((p) => p.y);
    const marge = Math.max(0.5, (Math.max(...ys) - Math.min(...ys)) * 0.15);
    const yMin = Math.floor(Math.min(...ys) - marge);
    const yMax = Math.ceil(Math.max(...ys) + marge);
    const ts = points.map((p) => new Date(p.x).getTime());
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    const largeur = L - MARGES.gauche - MARGES.droite;
    const hauteur = H - MARGES.haut - MARGES.bas;
    const px = (t) => MARGES.gauche + (tMax === tMin ? largeur / 2 : ((t - tMin) / (tMax - tMin)) * largeur);
    const py = (y) => MARGES.haut + (1 - (y - yMin) / (yMax - yMin || 1)) * hauteur;
    const coords = points.map((p, i) => ({ ...p, cx: px(ts[i]), cy: py(p.y) }));
    return { coords, yMin, yMax, py, chemin: coords.map((c, i) => `${i ? 'L' : 'M'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ') };
  }, [points]);

  if (!geo) return null;

  function deplacer(e) {
    const rect = svg.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * L;
    let proche = geo.coords[0];
    for (const c of geo.coords) if (Math.abs(c.cx - x) < Math.abs(proche.cx - x)) proche = c;
    setSurvol(proche);
  }

  const premier = geo.coords[0];
  const dernier = geo.coords[geo.coords.length - 1];

  return (
    <div className="pile pile--serre">
      <div className="graphique">
        <svg
          ref={svg}
          className="graphique__svg"
          viewBox={`0 0 ${L} ${H}`}
          role="img"
          aria-label={libelle}
          onPointerMove={deplacer}
          onPointerLeave={() => setSurvol(null)}
        >
          {graduations(geo.yMin, geo.yMax).map((v) => (
            <g key={v}>
              <line className="graphique__grille" x1={MARGES.gauche} x2={L - MARGES.droite} y1={geo.py(v)} y2={geo.py(v)} />
              <text className="graphique__axe" x={MARGES.gauche - 6} y={geo.py(v) + 4} textAnchor="end">{Math.round(v * 10) / 10}</text>
            </g>
          ))}
          <text className="graphique__axe" x={premier.cx} y={H - 6} textAnchor="start">{dateCourte(premier.x)}</text>
          {dernier !== premier && <text className="graphique__axe" x={dernier.cx} y={H - 6} textAnchor="end">{dateCourte(dernier.x)}</text>}
          <path className="graphique__ligne graphique__ligne--serie1" d={geo.chemin} />
          <circle className="graphique__point" cx={dernier.cx} cy={dernier.cy} r={4} />
          {survol && (
            <>
              <line className="graphique__repere" x1={survol.cx} x2={survol.cx} y1={MARGES.haut} y2={H - MARGES.bas} />
              <circle className="graphique__point" cx={survol.cx} cy={survol.cy} r={5} />
            </>
          )}
          <rect x={MARGES.gauche} y={0} width={L - MARGES.gauche - MARGES.droite} height={H} fill="transparent" />
        </svg>
        {survol && (
          <div className="graphique__info" style={{ left: `${(survol.cx / L) * 100}%`, top: `${(survol.cy / H) * 100}%` }}>
            {dateCourte(survol.x)} : <span className="graphique__info-valeur">{survol.y.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} {unite}</span>
          </div>
        )}
      </div>
      <TableDonnees points={points} unite={unite} decimales={1} />
    </div>
  );
}

/** Barres à une seule série (pas quotidiens). Points : [{ x: 'AAAA-MM-JJ', y: nombre }]. */
export function GraphiqueBarres({ points, unite = 'pas', libelle, objectif }) {
  const [survol, setSurvol] = useState(null);
  if (!points.length) return null;

  const yMax = Math.max(...points.map((p) => p.y), objectif || 0) * 1.1 || 1;
  const largeur = L - MARGES.gauche - MARGES.droite;
  const hauteur = H - MARGES.haut - MARGES.bas;
  const bande = largeur / points.length;
  const epaisseur = Math.max(2, Math.min(28, bande - 2));
  const py = (y) => MARGES.haut + (1 - y / yMax) * hauteur;
  const base = H - MARGES.bas;

  return (
    <div className="pile pile--serre">
      <div className="graphique">
        <svg className="graphique__svg" viewBox={`0 0 ${L} ${H}`} role="img" aria-label={libelle} onPointerLeave={() => setSurvol(null)}>
          {graduations(0, yMax).map((v) => (
            <g key={v}>
              <line className="graphique__grille" x1={MARGES.gauche} x2={L - MARGES.droite} y1={py(v)} y2={py(v)} />
              <text className="graphique__axe" x={MARGES.gauche - 6} y={py(v) + 4} textAnchor="end">
                {v >= 1000 ? `${Math.round(v / 100) / 10} k` : Math.round(v)}
              </text>
            </g>
          ))}
          {objectif > 0 && <line className="graphique__repere" x1={MARGES.gauche} x2={L - MARGES.droite} y1={py(objectif)} y2={py(objectif)} />}
          {points.map((p, i) => {
            const x = MARGES.gauche + i * bande + (bande - epaisseur) / 2;
            const y = py(p.y);
            const h = Math.max(0, base - y);
            const r = Math.min(4, epaisseur / 2, h);
            // Barre arrondie en haut seulement, ancrée à la ligne de base
            const d = `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + epaisseur - r},${y} Q${x + epaisseur},${y} ${x + epaisseur},${y + r} L${x + epaisseur},${base} Z`;
            return (
              <g key={p.x} onPointerEnter={() => setSurvol({ ...p, cx: x + epaisseur / 2, cy: y })}>
                <rect x={MARGES.gauche + i * bande} y={MARGES.haut} width={bande} height={hauteur} fill="transparent" />
                <path className={`graphique__barre--serie2${survol && survol.x !== p.x ? ' graphique__barre--attenuee' : ''}`} d={d} />
              </g>
            );
          })}
          <text className="graphique__axe" x={MARGES.gauche} y={H - 6} textAnchor="start">{dateCourte(points[0].x)}</text>
          <text className="graphique__axe" x={L - MARGES.droite} y={H - 6} textAnchor="end">{dateCourte(points[points.length - 1].x)}</text>
        </svg>
        {survol && (
          <div className="graphique__info" style={{ left: `${(survol.cx / L) * 100}%`, top: `${(survol.cy / H) * 100}%` }}>
            {dateCourte(survol.x)} : <span className="graphique__info-valeur">{survol.y.toLocaleString('fr-CA')} {unite}</span>
          </div>
        )}
      </div>
      <TableDonnees points={points} unite={unite} decimales={0} />
    </div>
  );
}
