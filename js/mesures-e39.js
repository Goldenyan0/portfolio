/* ==========================================================================
   mesures-e39.js — graphiques de la séance du 14/11/2026 (section #mesures)
   Données : window.MESURES (donnees-mesures.js), générées depuis les logs bruts.
   Outils de dessin partagés : window.E39Graphiques (exposés par e39.js).
   Une seule échelle verticale par graphique, légende dès 2 séries,
   réticule et infobulle au survol, tableau des valeurs en repli.
   ========================================================================== */
(function () {
  'use strict';

  const M = window.MESURES;
  const G = window.E39Graphiques;
  if (!M || !G) return;
  const svg = G.svg, fr = G.fr;

  // Échappe un texte avant de l'insérer dans une infobulle
  function texte(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* --- Graphique en courbes sur un vrai axe horizontal (régime, minutes, km) --- */
  function courbeXY(zone, o) {
    // Largeur du dessin = largeur réelle (au moins 280) : le texte garde une taille lisible sur téléphone
    const L = Math.round(Math.min(640, Math.max(280, zone.clientWidth || 640)));
    const H = Math.round((o.hauteur || 280) * Math.max(0.8, Math.min(1, L / 640)));
    const g = 52, d = 18, h = 18, b = 40;
    const lu = L - g - d, hu = H - h - b;
    const x = function (v) { return g + (v - o.xMin) / (o.xMax - o.xMin) * lu; };
    const y = function (v) { return h + hu - (v - o.yMin) / (o.yMax - o.yMin) * hu; };

    if (o.series.length > 1) G.legende(zone, o.series);
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'graphique__svg', role: 'img', 'aria-label': o.description });
    zone.appendChild(s);

    // Grille horizontale et graduations
    for (let v = o.yMin; v <= o.yMax + 1e-9; v += o.yPas) {
      svg('line', { class: v === 0 && o.yMin < 0 ? 'graphique__base' : 'graphique__grille', x1: g, x2: L - d, y1: y(v), y2: y(v) }, s);
      svg('text', { class: 'graphique__axe', x: g - 8, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = fr(v, o.decimalesAxe || 0);
    }
    const xPas = L < 420 ? o.xPas * 2 : o.xPas;
    for (let v = o.xMin; v <= o.xMax + 1e-9; v += xPas) {
      svg('text', { class: 'graphique__axe', x: x(v), y: H - b + 20, 'text-anchor': 'middle' }, s).textContent = o.xFormat ? o.xFormat(v) : fr(v, 0);
    }
    svg('text', { class: 'graphique__axe', x: L - d, y: H - 2, 'text-anchor': 'end' }, s).textContent = o.xNom;
    svg('text', { class: 'graphique__axe', x: g - 8, y: h - 6, 'text-anchor': 'end' }, s).textContent = o.yUnite;

    // Courbes (2 px). En marches si la valeur ne change que par paliers.
    o.series.forEach(function (serie) {
      let dChemin = '';
      serie.points.forEach(function (p, i) {
        if (!i) { dChemin = 'M' + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); return; }
        if (o.marches) dChemin += ' H' + x(p[0]).toFixed(1);
        dChemin += ' L' + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1);
      });
      svg('path', { class: 'graphique__courbe' + (serie.pointilles ? ' graphique__courbe--pointilles' : ''), d: dChemin, pathLength: 1, style: 'stroke:' + serie.couleur }, s);
      if (serie.marqueurs) serie.points.forEach(function (p) {
        svg('circle', { class: 'graphique__point', cx: x(p[0]), cy: y(p[1]), r: 4, style: 'fill:' + serie.couleur }, s);
      });
    });

    // Réticule et infobulle : valeur de chaque série au point le plus proche
    const reticule = svg('line', { class: 'graphique__reticule', x1: 0, x2: 0, y1: h, y2: h + hu }, s);
    const cible = svg('rect', { x: g, y: h, width: lu, height: hu, fill: 'transparent' }, s);
    function plusProche(points, vx) {
      let meilleur = points[0];
      points.forEach(function (p) {
        if (o.marches ? p[0] <= vx : Math.abs(p[0] - vx) < Math.abs(meilleur[0] - vx)) meilleur = p;
      });
      return meilleur;
    }
    cible.addEventListener('pointermove', function (e) {
      const boite = s.getBoundingClientRect();
      const vx = o.xMin + ((e.clientX - boite.left) / boite.width * L - g) / lu * (o.xMax - o.xMin);
      const ref = o.marches ? [Math.min(Math.max(vx, o.xMin), o.xMax)] : plusProche(o.series[0].points, vx);
      reticule.setAttribute('x1', x(ref[0])); reticule.setAttribute('x2', x(ref[0]));
      reticule.classList.add('est-visible');
      G.montrerInfobulle(e, '<strong>' + texte(o.xInfo(ref[0])) + '</strong>' + o.series.map(function (serie) {
        const p = plusProche(serie.points, ref[0]);
        return '<br><span class="infobulle__puce" style="--couleur:' + serie.couleur + '"></span>' + texte(serie.nom) + ' : ' + fr(p[1], o.decimales === undefined ? 1 : o.decimales) + ' ' + texte(o.yUnite);
      }).join(''));
    });
    cible.addEventListener('pointerleave', function () { reticule.classList.remove('est-visible'); G.cacherInfobulle(); });

    G.quandVisible(zone, function () { s.classList.add('est-anime'); });
  }

  const regime = function (v) { return fr(v / 1000, 1).replace(',0', '') + 'k'; };
  const tours = function (v) { return Math.round(v).toLocaleString('fr-FR') + ' tr/min'; };

  /* --- Puissance et couple : deux graphiques, chacun son unité --- */
  const zP = document.querySelector('[data-mesure="puissance"]');
  if (zP) {
    courbeXY(zP, {
      series: [{ nom: 'Puissance', couleur: 'var(--serie-1)', marqueurs: true, points: M.courbe.map(function (c) { return [c.n, c.ch]; }) }],
      xMin: 2500, xMax: 6500, xPas: 500, xNom: 'tr/min', xFormat: regime, xInfo: tours,
      yMin: 60, yMax: 180, yPas: 20, yUnite: 'ch', description: 'Puissance estimée le 14/11/2026 : de 80 ch à 2 600 tr/min à environ 170 ch en moyenne de 5 500 à 6 400 tr/min'
    });
    G.tableau(zP, ['Régime', 'Puissance DIN', 'Aux roues'], M.courbe.map(function (c) { return [tours(c.n), fr(c.ch) + ' ch', fr(c.kwRoues) + ' kW']; }));
  }
  const zC = document.querySelector('[data-mesure="couple"]');
  if (zC) {
    courbeXY(zC, {
      series: [{ nom: 'Couple', couleur: 'var(--serie-2)', marqueurs: true, points: M.courbe.map(function (c) { return [c.n, c.nm]; }) }],
      xMin: 2500, xMax: 6500, xPas: 500, xNom: 'tr/min', xFormat: regime, xInfo: tours, decimales: 0,
      yMin: 160, yMax: 240, yPas: 20, yUnite: 'Nm', description: 'Couple estimé le 14/11/2026 : entre 211 et 222 Nm de 2 600 à 5 400 tr/min, puis 183 Nm vers 6 400 tr/min'
    });
    G.tableau(zC, ['Régime', 'Couple'], M.courbe.map(function (c) { return [tours(c.n), c.nm + ' Nm']; }));
  }

  /* --- Avance à l'allumage à fond --- */
  const zA = document.querySelector('[data-mesure="avance"]');
  if (zA) {
    courbeXY(zA, {
      series: [{ nom: 'Avance médiane', couleur: 'var(--serie-1)', marqueurs: true, points: M.avance.map(function (a) { return [a.n, a.med]; }) }],
      xMin: 2000, xMax: 6500, xPas: 500, xNom: 'tr/min', xFormat: regime, xInfo: tours,
      yMin: 10, yMax: 30, yPas: 5, yUnite: '°', description: 'Avance réelle pied au plancher le 14/11/2026 au SP98 : de 17,6° vers 2 250 tr/min à 23,25° vers 6 250 tr/min'
    });
    G.tableau(zA, ['Tranche', 'Médiane', 'Minimum', 'Maximum', 'Mesures'], M.avance.map(function (a) {
      return [(a.n - 250) + ' à ' + (a.n + 250), fr(a.med, 2) + '°', fr(a.min, 2) + '°', fr(a.max, 2) + '°', a.nb];
    }));
  }

  /* --- Correction du mélange après l'E85 --- */
  const minutes = function (v) { return fr(v, 0) + ' min'; };
  const zM = document.querySelector('[data-mesure="melange"]');
  if (zM) {
    courbeXY(zM, {
      marches: true,
      series: [
        { nom: 'Banc 1', couleur: 'var(--serie-1)', points: M.melange.map(function (m) { return [m.t, m.mul1]; }) },
        { nom: 'Banc 2', couleur: 'var(--serie-2)', points: M.melange.map(function (m) { return [m.t, m.mul2]; }) }
      ],
      xMin: 0, xMax: 20, xPas: 5, xNom: 'minutes de trajet', xInfo: function (v) { return 'Minute ' + fr(v, 1); },
      yMin: -6, yMax: 4, yPas: 2, yUnite: '%', decimales: 2,
      description: 'Correction du mélange après 10 L d\'E85 le 14/11/2026 : banc 1 de −1,90 à +1,72 %, banc 2 de −4,48 à −1,37 %, à partir de la 12e minute'
    });
  }
  const zMt = document.querySelector('[data-mesure="melange-table"]');
  if (zMt) {
    zMt.innerHTML = '<table><thead><tr><th scope="col">Heure</th><th scope="col">Banc 1</th><th scope="col">Banc 2</th><th scope="col">Additive 1</th><th scope="col">Additive 2</th></tr></thead><tbody>' +
      M.melange.map(function (m) { return '<tr><th scope="row">' + m.heure + '</th><td>' + fr(m.mul1, 2) + ' %</td><td>' + fr(m.mul2, 2) + ' %</td><td>' + fr(m.add1, 3) + '</td><td>' + fr(m.add2, 3) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* --- ABS : roues avant gauche et droite --- */
  const zB = document.querySelector('[data-mesure="abs"]');
  if (zB) {
    courbeXY(zB, {
      series: [
        { nom: 'Avant droite', couleur: 'var(--serie-1)', points: M.abs.map(function (a) { return [a.t, a.vr]; }) },
        { nom: 'Avant gauche', couleur: 'var(--serie-2)', points: M.abs.map(function (a) { return [a.t, a.vl]; }) }
      ],
      xMin: 0, xMax: 10, xPas: 1, xNom: 'minutes', xInfo: function (v) { return 'Minute ' + fr(v, 1); },
      yMin: 0, yMax: 140, yPas: 20, yUnite: 'km/h', hauteur: 260,
      description: 'Vitesse des roues avant le 14/11/2026 : la droite monte jusqu\'à 138 km/h, la gauche reste à 2 km/h'
    });
  }

  /* --- Traces GPS : petits multiples, même échelle, sans fond de carte --- */
  const zG = document.querySelector('[data-mesure="gps"]');
  if (zG) {
    // Échelle commune : la plus grande étendue des trois traces
    let etendue = 0;
    M.gps.forEach(function (t) {
      const xs = t.points.map(function (p) { return p.x; }), ys = t.points.map(function (p) { return p.y; });
      t.boite = [Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)];
      etendue = Math.max(etendue, t.boite[1] - t.boite[0], t.boite[3] - t.boite[2]);
    });
    const passages = M.passagesSecondes;
    M.gps.forEach(function (t) {
      const fig = document.createElement('figure');
      fig.className = 'gps__trace';
      const T = 300, m = 14, k = (T - 2 * m) / etendue;
      const cx = (t.boite[0] + t.boite[1]) / 2, cy = (t.boite[2] + t.boite[3]) / 2;
      const X = function (v) { return T / 2 + (v - cx) * k; }, Y = function (v) { return T / 2 - (v - cy) * k; };
      const s = svg('svg', { viewBox: '0 0 ' + T + ' ' + T, class: 'gps__svg', role: 'img', 'aria-label': 'Trace GPS « ' + t.nom + ' », ' + fr(t.distanceAfficheeKm) + ' km affichés, sans fond de carte' });
      fig.appendChild(s);
      const chemin = function (pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' '); };
      svg('path', { class: 'gps__ligne', d: chemin(t.points) }, s);
      // Passages à fond surlignés (heure GPS recalée sur l'heure du PC)
      passages.forEach(function (pl) {
        const pts = t.points.filter(function (p) { return p.h >= pl[0] && p.h <= pl[1]; });
        if (pts.length > 1) svg('path', { class: 'gps__passage', d: chemin(pts) }, s);
      });
      // Barre d'échelle de 500 m
      const l500 = 500 * k;
      svg('line', { class: 'gps__echelle', x1: m, x2: m + l500, y1: T - m, y2: T - m }, s);
      svg('text', { class: 'graphique__axe', x: m, y: T - m - 6 }, s).textContent = '500 m';
      // Survol : vitesse et altitude au point le plus proche
      const repere = svg('circle', { class: 'gps__repere', r: 5, cx: -20, cy: -20 }, s);
      s.addEventListener('pointermove', function (e) {
        const boite = s.getBoundingClientRect();
        const px = (e.clientX - boite.left) / boite.width * T, py = (e.clientY - boite.top) / boite.height * T;
        let best = t.points[0], dmin = Infinity;
        t.points.forEach(function (p) { const dd = Math.pow(X(p.x) - px, 2) + Math.pow(Y(p.y) - py, 2); if (dd < dmin) { dmin = dd; best = p; } });
        repere.setAttribute('cx', X(best.x)); repere.setAttribute('cy', Y(best.y));
        G.montrerInfobulle(e, '<strong>' + texte(t.nom) + '</strong><br>' + fr(best.d / 1000, 2) + ' km depuis le début affiché<br>' + fr(best.v, 0) + ' km/h · ' + fr(best.alt, 0) + ' m');
      });
      s.addEventListener('pointerleave', function () { repere.setAttribute('cx', -20); G.cacherInfobulle(); });
      const leg = document.createElement('figcaption');
      leg.innerHTML = '<strong>' + texte(t.nom) + '</strong><span>' + fr(t.distanceAfficheeKm) + ' km affichés sur ' + fr(t.distanceTotaleKm) + ' km</span>';
      fig.appendChild(leg);
      zG.appendChild(fig);
    });
  }

  /* --- Profils du trajet des passages : vitesse et altitude --- */
  const trajet = M.gps[1];
  const km = function (v) { return fr(v, 0) + ' km'; };
  const zV = document.querySelector('[data-mesure="gps-vitesse"]');
  if (zV && trajet) {
    courbeXY(zV, {
      series: [{ nom: 'Vitesse GPS', couleur: 'var(--serie-1)', points: trajet.points.map(function (p) { return [p.d / 1000, p.v]; }) }],
      xMin: 0, xMax: Math.ceil(trajet.distanceAfficheeKm), xPas: 2, xNom: 'km', xFormat: function (v) { return fr(v, 0); }, xInfo: function (v) { return fr(v, 2) + ' km'; },
      yMin: 0, yMax: 160, yPas: 40, yUnite: 'km/h', decimales: 0, hauteur: 240,
      description: 'Vitesse GPS sur le trajet des passages à fond le 14/11/2026, de 0 à environ 140 km/h'
    });
  }
  const zH = document.querySelector('[data-mesure="gps-altitude"]');
  if (zH && trajet) {
    const alts = trajet.points.map(function (p) { return p.alt; });
    const bas = Math.floor(Math.min.apply(null, alts) / 10) * 10, haut = Math.ceil(Math.max.apply(null, alts) / 10) * 10;
    courbeXY(zH, {
      series: [{ nom: 'Altitude GPS', couleur: 'var(--serie-3)', points: trajet.points.map(function (p) { return [p.d / 1000, p.alt]; }) }],
      xMin: 0, xMax: Math.ceil(trajet.distanceAfficheeKm), xPas: 2, xNom: 'km', xFormat: function (v) { return fr(v, 0); }, xInfo: function (v) { return fr(v, 2) + ' km'; },
      yMin: bas, yMax: haut, yPas: Math.max(10, Math.ceil((haut - bas) / 40) * 10), yUnite: 'm', decimales: 0, hauteur: 240,
      description: 'Altitude GPS sur le trajet des passages à fond le 14/11/2026, entre ' + bas + ' et ' + haut + ' m'
    });
  }

  /* --- Tableaux repliés --- */
  const zPa = document.querySelector('[data-mesure="passages"]');
  if (zPa) {
    // Une ligne par passage : heure, sens (déduit du cap GPS), pente, puissance moyenne de 5 500 à 6 400 tr/min
    zPa.innerHTML = '<table><thead><tr><th scope="col">Passage</th><th scope="col">Sens</th><th scope="col">Pente</th><th scope="col">Puissance 5 500 à 6 400 tr/min</th></tr></thead><tbody>' +
      M.passages.map(function (p) {
        return '<tr><th scope="row">' + p.heure + '</th><td>' + texte(p.sens) + '</td><td>' + (p.pente > 0 ? '+' : '') + fr(p.pente, 2) + ' %</td><td>' + fr(p.ch, 1) + ' ch</td></tr>';
      }).join('') + '</tbody></table>';
  }
  const zJ = document.querySelector('[data-mesure="jauge"]');
  if (zJ) {
    zJ.innerHTML = '<table><thead><tr><th scope="col">Heure</th><th scope="col">Litres</th><th scope="col">Moment</th></tr></thead><tbody>' +
      M.jauge.map(function (j) { return '<tr><th scope="row">' + j.heure + '</th><td>' + j.litres + ' L</td><td>' + texte(j.note) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
})();
