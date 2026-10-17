/* ==========================================================================
   e39.js — page "Projet automobile"
   - Copie des schémas partagés dans les fiches ([data-schema-copie])
   - Débit du débitmètre qui alterne ralenti / pleine charge (schéma A2)
   - Tracés VANOS consigne / réel (schéma A5)
   - Jauges LTFT animées (schéma A4)
   - "Le M54 expliqué" : les cartes de la visite sont les fiches des pièces (pieces-e39.js),
     avec un sommaire déroulant sur le compteur « Fiche X / N »
   - Photos de la page : un clic (ou Entrée) les ouvre en grand
   - Graphiques natifs SVG des relevés du 08/10/2026, animés au scroll,
     avec infobulle au survol et tableau des valeurs
   Dépend de commun.js (window.Site) et donnees-releves.js (window.RELEVES).
   ========================================================================== */

(function () {
  'use strict';

  const Site = window.Site;
  const mouvementReduit = Site.mouvementReduit;
  const SVG = 'http://www.w3.org/2000/svg';

  // Crée un élément SVG avec ses attributs
  function svg(nom, attributs, parent) {
    const el = document.createElementNS(SVG, nom);
    Object.keys(attributs || {}).forEach(function (k) { el.setAttribute(k, attributs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }

  // Nombre au format français : 3.1 → "3,1"
  function fr(n, decimales) {
    return n.toFixed(decimales === undefined ? 1 : decimales).replace('.', ',');
  }

  // Appelle "action" une fois quand l'élément arrive à l'écran.
  // (On n'utilise pas IntersectionObserver : il ignore les éléments encore
  // repliés par le clip-path des animations d'entrée.)
  function quandVisible(el, action) {
    let fait = false;
    Site.surScroll(function () {
      if (fait) return;
      const zone = el.getBoundingClientRect();
      if (zone.top < window.innerHeight * 0.85 && zone.bottom > 0) {
        fait = true;
        action();
      }
    });
  }


  /* ------------------------------------------------------------------
     1. Schémas réutilisés dans les fiches : copie du schéma d'origine
     ------------------------------------------------------------------ */
  document.querySelectorAll('[data-schema-copie]').forEach(function (figure) {
    const source = document.querySelector('.' + figure.dataset.schemaCopie);
    if (source) figure.appendChild(source.cloneNode(true));
  });


  /* ------------------------------------------------------------------
     2. Débitmètre : la valeur alterne entre ralenti et pleine charge
     ------------------------------------------------------------------ */
  function animerDebit() {
    const etats = [
      { valeur: '3,0 g/s', regime: 'au ralenti' },
      { valeur: '121 g/s', regime: 'pleine charge, 3e' }
    ];
    let i = 0;
    if (mouvementReduit) return;
    setInterval(function () {
      i = (i + 1) % etats.length;
      document.querySelectorAll('.sch-admission').forEach(function (s) {
        const v = s.querySelector('[data-debit]');
        const r = s.querySelector('[data-debit-regime]');
        v.textContent = etats[i].valeur;
        r.textContent = etats[i].regime;
        s.classList.remove('est-pulse');
        void s.getBoundingClientRect(); // relance l'animation CSS
        s.classList.add('est-pulse');
        s.classList.toggle('est-charge', i === 1);
      });
    }, 2600);
  }


  /* ------------------------------------------------------------------
     3. Schéma A5 : consigne et réel VANOS qui se tracent et se superposent
     ------------------------------------------------------------------ */
  function tracerVanos(cible) {
    const donnees = window.RELEVES['vanos-ech'];
    const n = 70; // les 70 premiers échantillons du roulage
    const min = -107, max = -83;
    const x = function (i) { return 20 + (i / (n - 1)) * 280; };
    const y = function (v) { return 170 - ((v - min) / (max - min)) * 140; };
    function chemin(valeurs) {
      return valeurs.slice(0, n).map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    }
    svg('rect', { class: 'sch-cadre', x: 14, y: 22, width: 292, height: 156, rx: 6 }, cible);
    svg('path', { class: 'sch-trace sch-trace--consigne', d: chemin(donnees.consigne), pathLength: 1 }, cible);
    svg('path', { class: 'sch-trace sch-trace--reel', d: chemin(donnees.reel), pathLength: 1 }, cible);
    const legende = svg('g', { class: 'sch-texte sch-texte--petit' }, cible);
    svg('text', { x: 70, y: 14 }, legende).textContent = '- - consigne';
    svg('text', { x: 200, y: 14 }, legende).textContent = '— réel';
  }
  document.querySelectorAll('[data-traces-vanos]').forEach(tracerVanos);


  /* ------------------------------------------------------------------
     4. Jauges LTFT : l'aiguille passe de la valeur de départ à 0 %
     ------------------------------------------------------------------ */
  function animerJauges() {
    const bloc = document.querySelector('[data-jauges]');
    if (!bloc) return;
    const jauges = bloc.querySelectorAll('.jauge-ltft');

    function placer(jauge, valeur) {
      // −10 % → −90°, 0 % → 0°, +10 % → +90°
      jauge.querySelector('.jauge-ltft__aiguille').setAttribute('transform', 'rotate(' + (valeur * 9).toFixed(2) + ' 100 100)');
      jauge.querySelector('[data-valeur]').textContent = (valeur > 0.04 ? '+' : '') + fr(Math.abs(valeur) < 0.04 ? 0 : valeur);
    }

    jauges.forEach(function (j) { placer(j, parseFloat(j.dataset.depart)); });
    if (mouvementReduit) {
      jauges.forEach(function (j) { placer(j, parseFloat(j.dataset.arrivee)); });
      return;
    }

    quandVisible(bloc, function () {
      const debut = performance.now() + 700; // petit temps de lecture de la valeur de départ
      (function etape(maintenant) {
        const t = Math.min(Math.max((maintenant - debut) / 2200, 0), 1);
        const adouci = 1 - Math.pow(1 - t, 3);
        jauges.forEach(function (j) {
          const a = parseFloat(j.dataset.depart), b = parseFloat(j.dataset.arrivee);
          placer(j, a + (b - a) * adouci);
        });
        if (t < 1) Site.image(etape);
        else bloc.classList.add('est-zero');
      })(performance.now());
    });
  }


  /* ------------------------------------------------------------------
     5. Fenêtre des fiches
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     5 bis. Fiches pièces (une pièce par fiche) et leur index
     - index : un accordéon par catégorie, la liste des pièces sans description
     - fenêtre : la pièce dans la voiture complète et la pièce seule (vues
       3D dessinées par moteur-3d.js), sa description, mes valeurs, et un lien
       vers la fiche du système qui l'explique
     ------------------------------------------------------------------ */
  function gererFichesPieces() {
    const groupes = window.PIECES_E39;
    if (!groupes) return;
    const fiches = {};
    groupes.forEach(function (g) { Object.keys(g.fiches).forEach(function (id) { fiches[id] = g.fiches[id]; }); });

    const dialogue = document.getElementById('fiche-piece');
    const avecDialogue = dialogue && typeof dialogue.showModal === 'function';

    // Les cartes ouvrent leur fiche dans la fenêtre (sinon, elles restent de simples cartes)
    if (avecDialogue) document.documentElement.classList.add('fiches-repliables');
    // Visite « Le M54 expliqué » : une carte par fiche (catégorie, nom, description, bouton)
    const zoneVisite = document.getElementById('fiches-visite');
    const listeVisite = document.getElementById('visite-liste');
    const compteur = document.getElementById('visite-compteur');
    // Nombres de fiches et de catégories annoncés dans l'introduction de la documentation
    const total = groupes.reduce(function (n, g) { return n + Object.keys(g.fiches).length; }, 0);
    document.querySelectorAll('[data-nombre-fiches]').forEach(function (el) { el.textContent = total; });
    document.querySelectorAll('[data-nombre-categories]').forEach(function (el) { el.textContent = groupes.length; });
    const boutonsVisite = [];
    if (zoneVisite) {
      groupes.forEach(function (g) {
        // Sommaire : un groupe par catégorie (titre + nombre de fiches)
        let sousListe = null;
        if (listeVisite) {
          const groupe = document.createElement('li');
          groupe.className = 'visite__categorie';
          groupe.innerHTML = '<p class="visite__categorie-titre"><span></span><span class="visite__categorie-compte"></span></p><ol></ol>';
          groupe.querySelector('span').textContent = g.categorie;
          groupe.querySelector('.visite__categorie-compte').textContent = Object.keys(g.fiches).length;
          sousListe = groupe.querySelector('ol');
          listeVisite.appendChild(groupe);
        }
        Object.keys(g.fiches).forEach(function (id) {
          const f = g.fiches[id];
          const carte = document.createElement('article');
          carte.className = 'fiche fiche--piece';
          carte.id = 'visite-' + id;
          carte.dataset.fiche = id;
          carte.setAttribute('data-carte', '');
          carte.setAttribute('data-revele', '');
          carte.innerHTML = '<p class="fiche__numero"></p><h3></h3><p class="fiche__role"></p>' +
            '<button class="fiche__ouvrir" type="button">Ouvrir la fiche <svg class="icone" aria-hidden="true"><use href="#i-fleche"/></svg></button>';
          carte.querySelector('.fiche__numero').textContent = g.categorie;
          carte.querySelector('h3').textContent = f.nom;
          carte.querySelector('.fiche__role').textContent = f.description;
          carte.querySelector('.fiche__ouvrir').addEventListener('click', function () { ouvrir(id); });
          zoneVisite.appendChild(carte);
          if (listeVisite) {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = f.nom;
            b.addEventListener('click', function () {
              derouler(false);
              if (Site.allerA) Site.allerA(carte);
            });
            li.appendChild(b);
            sousListe.appendChild(li);
            boutonsVisite.push({ bouton: b, carte: carte });
          }
        });
      });
    }
    // Sommaire déroulant de la visite : le compteur ouvre la liste des fiches
    function derouler(ouvert) {
      if (!listeVisite || !compteur) return;
      listeVisite.hidden = !ouvert;
      compteur.setAttribute('aria-expanded', String(ouvert));
      // À l'ouverture, la fiche en cours est visible dans la liste
      const courant = listeVisite.querySelector('[aria-current]');
      if (ouvert && courant) listeVisite.scrollTop = courant.offsetTop - listeVisite.clientHeight / 2;
    }
    // Fiche en cours (voyage 3D) : mise en avant dans le sommaire
    document.addEventListener('voyage:carte', function (e) {
      boutonsVisite.forEach(function (x) {
        if (x.carte === e.detail.carte) x.bouton.setAttribute('aria-current', 'true'); else x.bouton.removeAttribute('aria-current');
      });
    });
    if (compteur) {
      compteur.addEventListener('click', function () { derouler(listeVisite.hidden); });
      document.addEventListener('click', function (e) { if (!e.target.closest('.visite__sommaire')) derouler(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') derouler(false); });
    }

    // Index en accordéons
    const index = document.getElementById('index-pieces');
    if (index) {
      groupes.forEach(function (g, i) {
        const details = document.createElement('details');
        details.className = 'accordeon';
        const ids = Object.keys(g.fiches);
        details.innerHTML = '<summary><span class="accordeon__numero">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="accordeon__titre"></span><span class="accordeon__compte">' + ids.length + (ids.length > 1 ? ' pièces' : ' pièce') + '</span>' +
          '<span class="accordeon__signe" aria-hidden="true"></span></summary>';
        details.querySelector('.accordeon__titre').textContent = g.categorie;
        const liste = document.createElement('ul');
        liste.className = 'accordeon__liste';
        ids.forEach(function (id) {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'accordeon__piece';
          b.textContent = g.fiches[id].nom;
          b.disabled = !avecDialogue;
          b.addEventListener('click', function () { ouvrir(id); });
          li.appendChild(b);
          liste.appendChild(li);
        });
        details.appendChild(liste);
        index.appendChild(details);
      });
    }

    if (!avecDialogue) return;
    const titre = document.getElementById('fiche-piece-titre');
    const categorie = document.getElementById('fiche-piece-categorie');
    const description = document.getElementById('fiche-piece-description');
    const blocVoiture = document.getElementById('fiche-piece-voiture');
    const lienSysteme = document.getElementById('fiche-piece-systeme');
    const blocPhoto = document.getElementById('fiche-piece-photo');
    const image = document.getElementById('fiche-piece-image');
    let declencheur = null;

    function ouvrir(id) {
      const f = fiches[id];
      if (!f) return;
      if (dialogue.open) dialogue.close();
      declencheur = document.activeElement;
      categorie.textContent = f.categorie;
      titre.textContent = f.nom;
      description.textContent = f.description;
      const valeurs = blocVoiture.querySelector('ul');
      valeurs.innerHTML = '';
      (f.maVoiture || []).forEach(function (v) {
        const li = document.createElement('li');
        li.textContent = v;
        valeurs.appendChild(li);
      });
      blocVoiture.hidden = !(f.maVoiture && f.maVoiture.length);
      // Photo réelle de la pièce (aucune photo, aucun cadre, pour les pièces qui n'en ont pas)
      blocPhoto.hidden = !f.photo;
      image.removeAttribute('src');
      if (f.photo) { image.alt = f.nom; image.src = f.photo; }
      lienSysteme.hidden = true;
      dialogue.showModal();
      dialogue.querySelector('.fiche-dialog__contenu').scrollTop = 0;
      if (Site.lenis) Site.lenis.stop();
      document.dispatchEvent(new CustomEvent('fichepiece:ouverte', {
        detail: { id: id, pieces: f.pieces, ensemble: document.getElementById('fiche-piece-ensemble'), seule: document.getElementById('fiche-piece-seule') }
      }));
    }

    dialogue.addEventListener('close', function () {
      if (Site.lenis) Site.lenis.start();
      document.dispatchEvent(new CustomEvent('fichepiece:fermee'));
      if (declencheur && declencheur.focus) declencheur.focus();
    });
    dialogue.querySelector('[data-fermer]').addEventListener('click', function () { dialogue.close(); });
    dialogue.addEventListener('click', function (e) { if (e.target === dialogue) dialogue.close(); });

    // Utilisé par moteur-3d.js quand on clique une pièce de la maquette
    window.ouvrirFichePiece = ouvrir;
  }


  /* ------------------------------------------------------------------
     5 quater. Photos : un clic les agrandit (fenêtre plein écran, fermée par
     un clic, Échap ou le bouton) ; la comparaison réel / maquette garde son curseur
     ------------------------------------------------------------------ */
  function gererAgrandissement() {
    const photos = Array.from(document.querySelectorAll('main img')).filter(function (img) {
      return !img.closest('.comparaison-photo');
    });
    const dialogue = document.createElement('dialog');
    if (!photos.length || typeof dialogue.showModal !== 'function') return;
    dialogue.className = 'visionneuse';
    dialogue.innerHTML = '<button class="fiche-dialog__fermer" type="button" aria-label="Fermer"><svg class="icone" aria-hidden="true"><use href="#i-fermer"/></svg></button><img alt="" />';
    document.body.appendChild(dialogue);
    const grande = dialogue.querySelector('img');
    let declencheur = null;

    function ouvrir(img) {
      declencheur = img;
      grande.src = img.dataset.grande || img.currentSrc || img.src;   // photo d'origine si l'affichée est réduite
      grande.alt = img.alt;
      dialogue.showModal();
      if (Site.lenis) Site.lenis.stop();
    }
    dialogue.addEventListener('click', function () { dialogue.close(); });
    dialogue.addEventListener('close', function () {
      if (Site.lenis) Site.lenis.start();
      if (declencheur) declencheur.focus();
    });
    photos.forEach(function (img) {
      img.classList.add('agrandissable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Agrandir : ' + img.alt);
      img.addEventListener('click', function () { ouvrir(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        ouvrir(img);
      });
    });
  }


  /* ------------------------------------------------------------------
     5 ter. Comparaison « réel / maquette » : le curseur découvre l'une ou l'autre
     ------------------------------------------------------------------ */
  function gererComparaison() {
    document.querySelectorAll('.comparaison-photo').forEach(function (figure) {
      const cadreImages = figure.querySelector('.comparaison-photo__cadre');
      const curseur = figure.querySelector('.comparaison-photo__curseur');
      if (!cadreImages || !curseur) return;
      curseur.addEventListener('input', function () {
        cadreImages.style.setProperty('--position', curseur.value + '%');
      });
    });
  }


  /* ------------------------------------------------------------------
     6. Graphiques des relevés
     ------------------------------------------------------------------ */

  // Infobulle partagée par tous les graphiques
  const infobulle = document.createElement('div');
  infobulle.className = 'infobulle';
  infobulle.setAttribute('role', 'status');
  document.body.appendChild(infobulle);

  function montrerInfobulle(e, html) {
    infobulle.innerHTML = html;
    infobulle.classList.add('est-visible');
    const l = infobulle.offsetWidth;
    const x = Math.min(e.clientX + 16, window.innerWidth - l - 12);
    infobulle.style.transform = 'translate(' + x + 'px,' + (e.clientY + 16) + 'px)';
  }
  function cacherInfobulle() { infobulle.classList.remove('est-visible'); }

  // Tableau des valeurs (alternative accessible au graphique)
  function tableau(zone, entetes, lignes) {
    const details = document.createElement('details');
    details.className = 'graphique__table';
    details.innerHTML = '<summary>Voir le tableau des valeurs</summary>';
    const boite = document.createElement('div');
    boite.className = 'graphique__defilement';
    boite.setAttribute('data-lenis-prevent', '');
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr>' + entetes.map(function (t) { return '<th scope="col">' + t + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + lignes.map(function (l) { return '<tr>' + l.map(function (c, i) { return i ? '<td>' + c + '</td>' : '<th scope="row">' + c + '</th>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
    boite.appendChild(table);
    details.appendChild(boite);
    zone.appendChild(details);
  }

  // Légende (toujours présente dès 2 séries)
  function legende(zone, series) {
    const ul = document.createElement('ul');
    ul.className = 'graphique__legende';
    series.forEach(function (s) {
      ul.insertAdjacentHTML('beforeend', '<li><span class="graphique__puce' + (s.pointilles ? ' graphique__puce--pointilles' : '') + '" style="--couleur:' + s.couleur + '"></span>' + s.nom + '</li>');
    });
    zone.appendChild(ul);
  }

  /* --- Graphique en barres : corrections carburant --- */
  function graphiqueBarres(zone) {
    const barres = [
      { nom: 'Banc 1', groupe: 'LTFT ralenti', valeur: 7.0, couleur: 'var(--serie-1)' },
      { nom: 'Banc 2', groupe: 'LTFT ralenti', valeur: 4.7, couleur: 'var(--serie-1)' },
      { nom: 'Banc 1', groupe: 'MUL en charge', valeur: 7.1, couleur: 'var(--serie-2)' },
      { nom: 'Banc 2', groupe: 'MUL en charge', valeur: 5.2, couleur: 'var(--serie-2)' }
    ];
    const L = 640, H = 300, g = 48, d = 16, h = 24, b = 56;
    const largeurUtile = L - g - d, hauteurUtile = H - h - b;
    const y = function (v) { return h + hauteurUtile - (v / 8) * hauteurUtile; };

    legende(zone, [{ nom: 'LTFT au ralenti', couleur: 'var(--serie-1)' }, { nom: 'MUL en charge', couleur: 'var(--serie-2)' }]);
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'graphique__svg', role: 'img', 'aria-label': 'Corrections carburant du 08/10/2026 : LTFT au ralenti +7,0 % banc 1 et +4,7 % banc 2 ; MUL en charge +7,1 % banc 1 et +5,2 % banc 2' });
    zone.appendChild(s);

    // Grille et axe
    [0, 2, 4, 6, 8].forEach(function (v) {
      svg('line', { class: 'graphique__grille', x1: g, x2: L - d, y1: y(v), y2: y(v) }, s);
      svg('text', { class: 'graphique__axe', x: g - 10, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = v + ' %';
    });

    const largeurGroupe = largeurUtile / 2;
    const largeurBarre = Math.min(70, largeurGroupe / 3);
    barres.forEach(function (barre, i) {
      const groupe = Math.floor(i / 2);
      const cx = g + largeurGroupe * groupe + largeurGroupe / 2 + (i % 2 ? 1 : -1) * (largeurBarre / 2 + 4);
      const haut = y(barre.valeur);
      // Barre arrondie en haut seulement (4 px), ancrée sur la ligne de base
      const r = 4, x0 = cx - largeurBarre / 2, x1 = cx + largeurBarre / 2, y0 = y(0);
      const rect = svg('path', {
        class: 'graphique__barre',
        d: 'M' + x0 + ' ' + y0 + ' V' + (haut + r) + ' Q' + x0 + ' ' + haut + ' ' + (x0 + r) + ' ' + haut + ' H' + (x1 - r) + ' Q' + x1 + ' ' + haut + ' ' + x1 + ' ' + (haut + r) + ' V' + y0 + ' Z',
        style: 'fill:' + barre.couleur + ';transform-origin:' + cx + 'px ' + y0 + 'px'
      }, s);
      svg('text', { class: 'graphique__etiquette', x: cx, y: haut - 8, 'text-anchor': 'middle' }, s).textContent = '+' + fr(barre.valeur) + ' %';
      svg('text', { class: 'graphique__axe', x: cx, y: H - b + 20, 'text-anchor': 'middle' }, s).textContent = barre.nom;
      // Zone de survol plus large que la barre
      const cible = svg('rect', { x: cx - largeurBarre / 2 - 6, y: h, width: largeurBarre + 12, height: hauteurUtile, fill: 'transparent' }, s);
      cible.addEventListener('pointermove', function (e) {
        montrerInfobulle(e, '<strong>' + barre.groupe + ' · ' + barre.nom + '</strong><br>+' + fr(barre.valeur) + ' %');
        rect.classList.add('est-survol');
      });
      cible.addEventListener('pointerleave', function () { cacherInfobulle(); rect.classList.remove('est-survol'); });
    });
    ['LTFT au ralenti', 'MUL en charge'].forEach(function (t, i) {
      svg('text', { class: 'graphique__groupe', x: g + largeurGroupe * i + largeurGroupe / 2, y: H - b + 44, 'text-anchor': 'middle' }, s).textContent = t;
    });
    svg('line', { class: 'graphique__base', x1: g, x2: L - d, y1: y(0), y2: y(0) }, s);

    tableau(zone, ['Mesure', 'Banc 1', 'Banc 2'], [['LTFT au ralenti', '+7,0 %', '+4,7 %'], ['MUL en charge', '+7,1 %', '+5,2 %']]);
    quandVisible(zone, function () { s.classList.add('est-anime'); });
  }

  /* --- Graphique en courbes (un ou plusieurs panneaux) --- */
  function graphiqueCourbes(zone, options) {
    const L = 640, H = options.hauteur || 280, g = 52, d = 18, h = 18, b = 34;
    const largeurUtile = L - g - d, hauteurUtile = H - h - b;
    const n = options.series[0].valeurs.length;
    const x = function (i) { return g + (i / (n - 1)) * largeurUtile; };
    const y = function (v) { return h + hauteurUtile - ((v - options.min) / (options.max - options.min)) * hauteurUtile; };

    if (options.titre) {
      const t = document.createElement('p');
      t.className = 'graphique__panneau';
      t.textContent = options.titre;
      zone.appendChild(t);
    }
    if (options.legende !== false) legende(zone, options.series);
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'graphique__svg', role: 'img', 'aria-label': options.description });
    zone.appendChild(s);

    // Grille, axes
    for (let v = options.min; v <= options.max + 1e-9; v += options.pas) {
      svg('line', { class: 'graphique__grille', x1: g, x2: L - d, y1: y(v), y2: y(v) }, s);
      svg('text', { class: 'graphique__axe', x: g - 8, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = fr(v, options.decimales || 0);
    }
    [0, 20, 40, 60, 80, 100].forEach(function (i) {
      svg('text', { class: 'graphique__axe', x: x(i), y: H - b + 20, 'text-anchor': 'middle' }, s).textContent = i;
    });
    svg('text', { class: 'graphique__axe', x: L - d, y: H - 4, 'text-anchor': 'end' }, s).textContent = 'échantillons';

    // Courbes (2 px)
    options.series.forEach(function (serie) {
      const dChemin = serie.valeurs.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
      svg('path', { class: 'graphique__courbe' + (serie.pointilles ? ' graphique__courbe--pointilles' : ''), d: dChemin, pathLength: 1, style: 'stroke:' + serie.couleur }, s);
    });

    // Réticule + infobulle au survol
    const reticule = svg('line', { class: 'graphique__reticule', x1: 0, x2: 0, y1: h, y2: h + hauteurUtile }, s);
    const zoneSurvol = svg('rect', { x: g, y: h, width: largeurUtile, height: hauteurUtile, fill: 'transparent' }, s);
    zoneSurvol.addEventListener('pointermove', function (e) {
      const boite = s.getBoundingClientRect();
      const px = (e.clientX - boite.left) / boite.width * L;
      const i = Math.round(Math.min(Math.max((px - g) / largeurUtile, 0), 1) * (n - 1));
      reticule.setAttribute('x1', x(i));
      reticule.setAttribute('x2', x(i));
      reticule.classList.add('est-visible');
      montrerInfobulle(e, '<strong>Échantillon ' + i + '</strong>' + options.series.map(function (serie) {
        return '<br><span class="infobulle__puce" style="--couleur:' + serie.couleur + '"></span>' + serie.nom + ' : ' + fr(serie.valeurs[i], options.decimalesValeur || 1) + ' ' + options.unite;
      }).join(''));
    });
    zoneSurvol.addEventListener('pointerleave', function () { reticule.classList.remove('est-visible'); cacherInfobulle(); });

    quandVisible(zone, function () { s.classList.add('est-anime'); });
    return s;
  }

  function graphiquesReleves() {
    const R = window.RELEVES;
    if (!R) return;

    const corrections = document.querySelector('[data-graphique="corrections"]');
    if (corrections) graphiqueBarres(corrections);

    const vanos = document.querySelector('[data-graphique="vanos"]');
    if (vanos) {
      const series = function (cle) {
        return [
          { nom: 'Consigne (SOLL)', valeurs: R[cle].consigne, couleur: 'var(--serie-neutre)', pointilles: true },
          { nom: 'Réel (IST)', valeurs: R[cle].reel, couleur: 'var(--serie-1)' }
        ];
      };
      graphiqueCourbes(vanos, { titre: 'Admission', series: series('vanos-adm'), min: 80, max: 115, pas: 5, unite: '°', hauteur: 230, description: 'VANOS admission le 08/10/2026 : la position réelle suit la consigne entre 85 et 113 degrés' });
      graphiqueCourbes(vanos, { titre: 'Échappement', series: series('vanos-ech'), min: -110, max: -80, pas: 5, unite: '°', hauteur: 230, legende: false, description: 'VANOS échappement le 08/10/2026 : la position réelle suit la consigne entre −106 et −84 degrés' });
      tableau(vanos, ['Échantillon', 'Adm. consigne', 'Adm. réel', 'Éch. consigne', 'Éch. réel'], R['vanos-adm'].reel.map(function (_, i) {
        return [i, fr(R['vanos-adm'].consigne[i]), fr(R['vanos-adm'].reel[i]), fr(R['vanos-ech'].consigne[i]), fr(R['vanos-ech'].reel[i])];
      }));
    }

    const lambda = document.querySelector('[data-graphique="lambda"]');
    if (lambda) {
      // Deux panneaux sur la même échelle : sondes avant puis après les catalyseurs
      const bancs = function (a, b) {
        return [
          { nom: 'Banc 1', valeurs: a, couleur: 'var(--serie-1)' },
          { nom: 'Banc 2', valeurs: b, couleur: 'var(--serie-2)' }
        ];
      };
      graphiqueCourbes(lambda, {
        titre: 'Pré-catalyseur (amont)', series: bancs(R.lambda.pre1, R.lambda.pre2),
        min: 0, max: 1, pas: 0.2, decimales: 1, decimalesValeur: 2, unite: 'V', hauteur: 220,
        description: 'Sondes lambda amont le 08/10/2026 : tension entre 0 et 0,9 volt, bancs 1 et 2'
      });
      graphiqueCourbes(lambda, {
        titre: 'Post-catalyseur (aval)', series: bancs(R.lambda.post1, R.lambda.post2), legende: false,
        min: 0, max: 1, pas: 0.2, decimales: 1, decimalesValeur: 2, unite: 'V', hauteur: 220,
        description: 'Sondes lambda aval le 08/10/2026 : tension entre 0 et 0,9 volt, bancs 1 et 2'
      });
      tableau(lambda, ['Échantillon', 'Pré B1', 'Pré B2', 'Post B1', 'Post B2'], R.lambda.pre1.map(function (_, i) {
        return [i, fr(R.lambda.pre1[i], 2), fr(R.lambda.pre2[i], 2), fr(R.lambda.post1[i], 2), fr(R.lambda.post2[i], 2)];
      }));
    }

    const temperatures = document.querySelector('[data-graphique="temperatures"]');
    if (temperatures) {
      graphiqueCourbes(temperatures, {
        series: [
          { nom: 'Liquide', valeurs: R.temperatures.liquide, couleur: 'var(--serie-1)' },
          { nom: 'Huile (modélisée)', valeurs: R.temperatures.huile, couleur: 'var(--serie-2)' },
          { nom: 'Air admis', valeurs: R.temperatures.air, couleur: 'var(--serie-3)' }
        ],
        min: 20, max: 110, pas: 10, unite: '°C',
        description: 'Températures le 08/10/2026 : liquide entre 83 et 98 °C, huile entre 99 et 102 °C, air admis entre 25 et 61 °C'
      });
      tableau(temperatures, ['Échantillon', 'Liquide', 'Huile', 'Air'], R.temperatures.liquide.map(function (_, i) {
        return [i, fr(R.temperatures.liquide[i]) + ' °C', fr(R.temperatures.huile[i]) + ' °C', fr(R.temperatures.air[i]) + ' °C'];
      }));
    }
  }


  /* ------------------------------------------------------------------
     7. Garde-fou du moteur 3D : si le module moteur-3d.js n'a même pas pu
        s'exécuter (il signale lui-même les autres pannes), on l'explique ici.
     ------------------------------------------------------------------ */
  function surveillerMoteur() {
    const cadre = document.getElementById('moteur3d');
    if (!cadre) return;
    setTimeout(function () {
      if (cadre.classList.contains('est-pret') || cadre.querySelector('.moteur3d__cause')) return;
      let cause;
      if (location.protocol === 'file:') {
        cause = 'page ouverte directement depuis le disque (file://) : le navigateur bloque les modules JavaScript. Ouvrez-la via un serveur local ou en ligne.';
      } else if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'))) {
        cause = 'navigateur trop ancien : il ne gère pas les « import maps » nécessaires à la librairie 3D.';
      } else {
        cause = 'librairie 3D non chargée (réseau lent ou CDN jsDelivr bloqué).';
      }
      if (window.afficherEchecMoteur) {
        window.afficherEchecMoteur(cause);
      } else {
        const repli = document.getElementById('moteur-repli');
        repli.innerHTML = '<p>La vue 3D ne peut pas s\'afficher.</p><p class="moteur3d__cause"></p><p>Toutes les fiches restent accessibles juste en dessous.</p>';
        repli.querySelector('.moteur3d__cause').textContent = 'Cause : ' + cause;
      }
    }, 12000);
  }


  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  surveillerMoteur();
  animerDebit();
  animerJauges();
  gererFichesPieces();
  gererComparaison();
  gererAgrandissement();
  graphiquesReleves();
})();
