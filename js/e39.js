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
   - Graphiques de la conversion éthanol (08 au 20/11/2026), axe X en heures
   Dépend de commun.js (window.Site), donnees-releves.js (window.RELEVES)
   donnees-ethanol.js (window.ETHANOL) et donnees-cartos.js (window.CARTOS).
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
      { valeur: '2,8 g/s', regime: 'au ralenti' },
      { valeur: '125 g/s', regime: 'pleine charge' }
    ];
    let i = 0;
    if (mouvementReduit) return;
    const schemas = document.querySelectorAll('.sch-admission');
    if (!schemas.length) return;
    setInterval(function () {
      if (document.hidden) return;
      i = (i + 1) % etats.length;
      schemas.forEach(function (s) {
        const v = s.querySelector('[data-debit]');
        const r = s.querySelector('[data-debit-regime]');
        v.textContent = etats[i].valeur;
        r.textContent = etats[i].regime;
        s.classList.remove('est-pulse');
        s.classList.toggle('est-charge', i === 1);
      });
      // L'animation CSS repart à l'image suivante (sans forcer une mise en page de toute la page)
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { schemas.forEach(function (s) { s.classList.add('est-pulse'); }); });
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
    // Visite « Le M54 expliqué » : une carte par catégorie (les grands groupes) ; le détail des
    // pièces se déplie dans la carte, chaque pièce ouvre sa fiche
    const cartesGroupes = [];
    if (zoneVisite) {
      groupes.forEach(function (g, i) {
        const ids = Object.keys(g.fiches);
        // Système dominant du groupe : il pilote les animations de la visite (moteur, fluides)
        const comptes = {};
        ids.forEach(function (id) { const s = g.fiches[id].systeme; if (s) comptes[s] = (comptes[s] || 0) + 1; });
        const systeme = Object.keys(comptes).sort(function (a, b) { return comptes[b] - comptes[a]; })[0] || '';
        const carte = document.createElement('article');
        carte.className = 'fiche fiche--groupe';
        carte.id = 'visite-groupe-' + (i + 1);
        carte.dataset.fiche = 'groupe-' + (i + 1);
        carte.dataset.pieces = ids.map(function (id) { return g.fiches[id].pieces.join(' '); }).join(' ');
        carte.dataset.systeme = systeme;
        carte.setAttribute('data-carte', '');
        carte.setAttribute('data-revele', '');
        carte.innerHTML = '<p class="fiche__numero"></p><h3></h3><p class="fiche__role"></p>' +
          '<button class="fiche__details" type="button" aria-expanded="false">Voir le détail des pièces</button>' +
          '<ul class="fiche__pieces" data-lenis-prevent hidden></ul>';
        carte.querySelector('.fiche__numero').textContent = String(i + 1).padStart(2, '0') + ' · ' + ids.length + (ids.length > 1 ? ' pièces' : ' pièce');
        carte.querySelector('h3').textContent = g.categorie;
        carte.querySelector('.fiche__role').textContent = ids.map(function (id) { return g.fiches[id].nom; }).join(' · ');
        const liste = carte.querySelector('.fiche__pieces');
        ids.forEach(function (id) {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.innerHTML = '<span></span><span class="fiche__piece-desc"></span>';
          b.firstChild.textContent = g.fiches[id].nom;
          b.lastChild.textContent = g.fiches[id].description;
          b.addEventListener('click', function () { ouvrir(id); });
          li.appendChild(b);
          liste.appendChild(li);
        });
        const details = carte.querySelector('.fiche__details');
        details.addEventListener('click', function () {
          const ouvert = liste.hidden;
          liste.hidden = !ouvert;
          details.setAttribute('aria-expanded', String(ouvert));
          details.textContent = ouvert ? 'Masquer le détail' : 'Voir le détail des pièces';
        });
        zoneVisite.appendChild(carte);
        cartesGroupes.push(carte);

        // Sommaire : chaque catégorie se déplie ; un clic sur son titre y emmène
        if (listeVisite) {
          const li = document.createElement('li');
          li.className = 'visite__categorie';
          const bloc = document.createElement('details');
          bloc.innerHTML = '<summary><span></span><span class="visite__categorie-compte"></span></summary><ol></ol>';
          bloc.querySelector('summary span').textContent = g.categorie;
          bloc.querySelector('.visite__categorie-compte').textContent = ids.length;
          bloc.querySelector('summary').addEventListener('click', function () { if (Site.allerA) Site.allerA(carte); });
          ids.forEach(function (id) {
            const p = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = g.fiches[id].nom;
            b.addEventListener('click', function () { derouler(false); ouvrir(id); });
            p.appendChild(b);
            bloc.querySelector('ol').appendChild(p);
          });
          li.appendChild(bloc);
          listeVisite.appendChild(li);
          carte.blocSommaire = bloc;
        }
      });
    }
    // Sommaire déroulant de la visite : le compteur ouvre la liste des catégories
    function derouler(ouvert) {
      if (!listeVisite || !compteur) return;
      listeVisite.hidden = !ouvert;
      compteur.setAttribute('aria-expanded', String(ouvert));
      const courant = listeVisite.querySelector('details[open]');
      if (ouvert && courant) listeVisite.scrollTop = courant.offsetTop - 8;
    }
    // Catégorie en cours (voyage 3D) : dépliée et mise en avant dans le sommaire
    document.addEventListener('voyage:carte', function (e) {
      cartesGroupes.forEach(function (c) {
        if (!c.blocSommaire) return;
        const actif = c === e.detail.carte;
        c.blocSommaire.classList.toggle('est-courant', actif);
        if (actif) c.blocSommaire.open = true;
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
     5 quinquies. Plein écran des deux maquettes (tous leurs boutons restent)
     et points du tour du propriétaire masquables
     ------------------------------------------------------------------ */
  // Infobulle collée à la souris : ce que fait chaque bouton des maquettes (souris uniquement)
  const AIDES = [
    ['#bouton-eclate', 'Écarte les pièces pour voir comment tout s\'assemble'],
    ['#bouton-rotation', 'Arrête ou relance la rotation automatique'],
    ['#bouton-voiture', 'Cache ou affiche la carrosserie pour voir la mécanique'],
    ['#bouton-acceleration', 'Démarre le moteur et simule une accélération, rapport après rapport'],
    ['#bouton-interieur', 'S\'installe à la place du conducteur, ou revient à l\'extérieur'],
    ['#bouton-fluides', 'Montre la circulation du liquide de refroidissement, du carburant et de l\'huile'],
    ['[data-ouvrants]', 'Ouvre ou ferme les portes, le capot et le coffre'],
    ['#bouton-cache', 'Retire ou repose le cache plastique du moteur'],
    ['#bouton-numeros', 'Masque ou affiche les numéros des pièces'],
    ['#moteur-calques summary', 'Choisit les groupes de pièces affichés'],
    ['[data-plein-ecran]', 'Affiche la vue en plein écran, ou en sort'],
    ['[data-zoom="1"]', 'Rapproche la vue'],
    ['[data-zoom="-1"]', 'Éloigne la vue'],
    ['[data-zoom="0"]', 'Revient au cadrage de départ'],
    ['[data-pivot="0,-1"]', 'Tourne la vue vers le haut'],
    ['[data-pivot="0,1"]', 'Tourne la vue vers le bas'],
    ['[data-pivot="-1,0"]', 'Tourne la vue vers la gauche'],
    ['[data-pivot="1,0"]', 'Tourne la vue vers la droite'],
    ['[data-hauteur="1"]', 'Monte la caméra'],
    ['[data-hauteur="-1"]', 'Descend la caméra'],
    ['[data-encyclo-vue="exterieur"]', 'Fait le tour de la voiture, de l\'extérieur'],
    ['[data-encyclo-vue="interieur"]', 'S\'installe à la place du conducteur'],
    ['[data-encyclo-points]', 'Masque ou affiche les points numérotés'],
    ['[data-encyclo-base]', 'Revient à la vue de départ et referme tout']
  ];
  function gererInfobulles() {
    if (!Site.sourisFine) return;
    AIDES.forEach(function (a) { document.querySelectorAll(a[0]).forEach(function (el) { el.dataset.aide = a[1]; }); });
    const bulle = document.createElement('div');
    bulle.className = 'infobulle-souris';
    bulle.setAttribute('aria-hidden', 'true');
    let cible = null;
    document.addEventListener('pointerover', function (e) {
      const el = e.target.closest('[data-aide]');
      if (el === cible) return;
      cible = el;
      if (!el) { bulle.classList.remove('est-visible'); return; }
      bulle.textContent = el.dataset.aide;
      // En plein écran, seule la zone affichée est visible : la bulle y est rangée
      (document.fullscreenElement || document.body).appendChild(bulle);
      bulle.classList.add('est-visible');
    });
    document.addEventListener('pointermove', function (e) {
      if (!cible) return;
      bulle.style.transform = 'translate(' + (e.clientX + 16) + 'px,' + (e.clientY + 18) + 'px)';
    }, { passive: true });
  }

  function gererPleinEcran() {
    const actuel = function () { return document.fullscreenElement || document.webkitFullscreenElement; };
    document.querySelectorAll('[data-plein-ecran]').forEach(function (b) {
      const zone = b.closest('.moteur3d, .encyclo');
      if (!zone || !(zone.requestFullscreen || zone.webkitRequestFullscreen)) { b.hidden = true; return; }
      b.addEventListener('click', function () {
        if (actuel()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (zone.requestFullscreen || zone.webkitRequestFullscreen).call(zone);
      });
    });
    const maj = function () {
      document.querySelectorAll('[data-plein-ecran]').forEach(function (b) {
        const actif = actuel() === b.closest('.moteur3d, .encyclo');
        b.setAttribute('aria-pressed', String(actif));
        b.setAttribute('aria-label', actif ? 'Quitter le plein écran' : 'Plein écran');
      });
    };
    document.addEventListener('fullscreenchange', maj);
    document.addEventListener('webkitfullscreenchange', maj);
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
      if (img.closest('.e39-hero__fond')) return; // la photo de fond du hero n'est pas un bouton
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

  /* --- Graphique en barres, groupées (o.barres[].groupe) ; une barre peut flotter (bas ≠ 0) ---
     o : { barres: [{ nom, groupe, valeur, bas?, couleur, texte? }], min?, max, pas, unite,
           decimales?, legende?, seuils?, description, tableau: [entetes, lignes] } */
  function graphiqueBarres(zone, o) {
    const barres = o.barres;
    const groupes = barres.map(function (b) { return b.groupe; }).filter(function (gr, i, t) { return t.indexOf(gr) === i; });
    const min = o.min || 0;
    const L = 640, H = 300, g = 48, d = 16, h = 24, b = 56;
    const largeurUtile = L - g - d, hauteurUtile = H - h - b;
    const y = function (v) { return h + hauteurUtile - ((v - min) / (o.max - min)) * hauteurUtile; };
    const texte = function (barre) { return barre.texte || ((barre.valeur > 0 && min >= 0 && o.signe ? '+' : '') + fr(barre.valeur, o.decimales) + ' ' + o.unite); };

    if (o.legende) legende(zone, o.legende);
    const s = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'graphique__svg', role: 'img', 'aria-label': o.description });
    zone.appendChild(s);

    // Grille et axe
    for (let v = min; v <= o.max + 1e-9; v += o.pas) {
      svg('line', { class: 'graphique__grille', x1: g, x2: L - d, y1: y(v), y2: y(v) }, s);
      svg('text', { class: 'graphique__axe', x: g - 10, y: y(v) + 4, 'text-anchor': 'end' }, s).textContent = fr(v, o.decimalesAxe || 0) + ' ' + o.unite;
    }

    const largeurGroupe = largeurUtile / groupes.length;
    barres.forEach(function (barre) {
      const membres = barres.filter(function (x) { return x.groupe === barre.groupe; });
      const k = membres.indexOf(barre), nb = membres.length;
      const largeurBarre = Math.min(70, (largeurGroupe - 8) / Math.max(nb, 2) - 8);
      const cx = g + largeurGroupe * groupes.indexOf(barre.groupe) + largeurGroupe / 2 + (k - (nb - 1) / 2) * (largeurBarre + 8);
      const haut = y(barre.valeur);
      // Barre arrondie en haut seulement (4 px), ancrée sur sa base
      const r = 4, x0 = cx - largeurBarre / 2, x1 = cx + largeurBarre / 2, y0 = y(barre.bas || min);
      const rect = svg('path', {
        class: 'graphique__barre',
        d: 'M' + x0 + ' ' + y0 + ' V' + (haut + r) + ' Q' + x0 + ' ' + haut + ' ' + (x0 + r) + ' ' + haut + ' H' + (x1 - r) + ' Q' + x1 + ' ' + haut + ' ' + x1 + ' ' + (haut + r) + ' V' + y0 + ' Z',
        style: 'fill:' + barre.couleur + ';transform-origin:' + cx + 'px ' + y0 + 'px'
      }, s);
      svg('text', { class: 'graphique__etiquette', x: cx, y: haut - 8, 'text-anchor': 'middle' }, s).textContent = texte(barre);
      if (barre.nom) svg('text', { class: 'graphique__axe', x: cx, y: H - b + 20, 'text-anchor': 'middle' }, s).textContent = barre.nom;
      // Zone de survol plus large que la barre
      const cible = svg('rect', { x: cx - largeurBarre / 2 - 6, y: h, width: largeurBarre + 12, height: hauteurUtile, fill: 'transparent' }, s);
      cible.addEventListener('pointermove', function (e) {
        montrerInfobulle(e, '<strong>' + barre.groupe + (barre.nom ? ' · ' + barre.nom : '') + '</strong><br>' + (barre.aide || texte(barre)));
        rect.classList.add('est-survol');
      });
      cible.addEventListener('pointerleave', function () { cacherInfobulle(); rect.classList.remove('est-survol'); });
    });
    groupes.forEach(function (t, i) {
      svg('text', { class: 'graphique__groupe', x: g + largeurGroupe * i + largeurGroupe / 2, y: H - b + (barres.some(function (x) { return x.nom; }) ? 44 : 22), 'text-anchor': 'middle' }, s).textContent = t;
    });
    svg('line', { class: 'graphique__base', x1: g, x2: L - d, y1: y(min), y2: y(min) }, s);
    tracerSeuils(s, o.seuils, y, g, L - d);

    tableau(zone, o.tableau[0], o.tableau[1]);
    quandVisible(zone, function () { s.classList.add('est-anime'); });
  }

  // Lignes horizontales de référence (butée, valeur d'origine…), en pointillés et étiquetées
  function tracerSeuils(s, seuils, y, xDebut, xFin) {
    (seuils || []).forEach(function (seuil) {
      svg('line', { class: 'graphique__seuil', x1: xDebut, x2: xFin, y1: y(seuil.v), y2: y(seuil.v) }, s);
      svg('text', { class: 'graphique__repere', x: xFin - 4, y: y(seuil.v) - 6, 'text-anchor': 'end' }, s).textContent = seuil.texte;
    });
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
    // Axe X : numéros d'échantillons (relevés du 08/10) ou étiquettes fournies (heures, trajets),
    // dont 5 sont affichées à intervalles réguliers ; l'infobulle donne l'étiquette exacte
    const etiquettes = options.etiquettes;
    const reperesX = etiquettes ? [0, 1, 2, 3, 4].map(function (k) { return Math.round(k * (n - 1) / 4); }) : [0, 20, 40, 60, 80, 100];
    reperesX.forEach(function (i, k) {
      svg('text', { class: 'graphique__axe', x: x(i), y: H - b + 20, 'text-anchor': etiquettes ? ['start', 'middle', 'middle', 'middle', 'end'][k] : 'middle' }, s).textContent = etiquettes ? etiquettes[i] : i;
    });
    svg('text', { class: 'graphique__axe', x: L - d, y: H - 4, 'text-anchor': 'end' }, s).textContent = options.axeX || 'échantillons';

    // Seuils horizontaux et repères verticaux (plein, flash…)
    tracerSeuils(s, options.seuils, y, g, L - d);
    (options.reperes || []).forEach(function (r) {
      svg('line', { class: 'graphique__seuil', x1: x(r.i), x2: x(r.i), y1: h, y2: h + hauteurUtile }, s);
      svg('text', { class: 'graphique__repere', x: x(r.i) + (r.gauche ? -4 : 4), y: h + 12 + (r.ligne || 0) * 14, 'text-anchor': r.gauche ? 'end' : 'start' }, s).textContent = r.texte;
    });

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
      montrerInfobulle(e, '<strong>' + (etiquettes ? etiquettes[i] : 'Échantillon ' + i) + '</strong>' + options.series.map(function (serie) {
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
    if (corrections) {
      graphiqueBarres(corrections, {
        barres: [
          // Valise V519 au ralenti (27/09) puis MUL du log Deep OBD du 08/10 (moyenne et maximum des 109 mesures)
          { nom: 'Banc 1', groupe: 'V519, ralenti (27/09)', valeur: 8.6, couleur: 'var(--serie-neutre)' },
          { nom: 'Banc 2', groupe: 'V519, ralenti (27/09)', valeur: 6.3, couleur: 'var(--serie-neutre)' },
          { nom: 'Banc 1', groupe: 'MUL moyenne (08/10)', valeur: 6.8, couleur: 'var(--serie-1)' },
          { nom: 'Banc 2', groupe: 'MUL moyenne (08/10)', valeur: 4.6, couleur: 'var(--serie-1)' },
          { nom: 'Banc 1', groupe: 'MUL maximum (08/10)', valeur: 7.1, couleur: 'var(--serie-2)' },
          { nom: 'Banc 2', groupe: 'MUL maximum (08/10)', valeur: 5.2, couleur: 'var(--serie-2)' }
        ],
        max: 10, pas: 2, unite: '%', signe: true,
        legende: [{ nom: 'V519, ralenti (27/09)', couleur: 'var(--serie-neutre)' }, { nom: 'MUL moyenne (08/10)', couleur: 'var(--serie-1)' }, { nom: 'MUL maximum (08/10)', couleur: 'var(--serie-2)' }],
        description: 'Corrections carburant avant réparation : +8,6 % et +6,3 % au ralenti à la valise le 27/09 ; MUL du 08/10 de +6,8 % et +4,6 % en moyenne, +7,1 % et +5,2 % au maximum',
        tableau: [['Mesure', 'Banc 1', 'Banc 2'], [['V519 au ralenti, 27/09', '+8,6 %', '+6,3 %'], ['MUL moyenne, 08/10', '+6,8 %', '+4,6 %'], ['MUL maximum, 08/10', '+7,1 %', '+5,2 %']]]
      });
    }

    const vanos = document.querySelector('[data-graphique="vanos"]');
    if (vanos) {
      const series = function (cle) {
        return [
          { nom: 'Consigne (SOLL)', valeurs: R[cle].consigne, couleur: 'var(--serie-neutre)', pointilles: true },
          { nom: 'Réel (IST)', valeurs: R[cle].reel, couleur: 'var(--serie-1)' }
        ];
      };
      graphiqueCourbes(vanos, { titre: 'Admission', series: series('vanos-adm'), min: 80, max: 115, pas: 5, unite: '°', hauteur: 230, description: 'VANOS admission le 08/10/2026 : la position réelle suit la consigne entre 82 et 114 degrés' });
      graphiqueCourbes(vanos, { titre: 'Échappement', series: series('vanos-ech'), min: -110, max: -80, pas: 5, unite: '°', hauteur: 230, legende: false, description: 'VANOS échappement le 08/10/2026 : la position réelle suit la consigne entre −107 et −84 degrés' });
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


  /* --- Cartographies façon logiciel de calibration (donnees-cartos.js : window.CARTOS) ---
     Le tableau coloré EST la vue accessible (vraies cellules, en-têtes, valeurs écrites) ;
     la surface 3D (Three.js, déjà utilisé par la page) ne se charge qu'à la demande. */

  // Couleur d'une case : arc-en-ciel bleu → rouge (valeurs) ou bleu / blanc / rouge (écarts)
  function couleurCase(t, divergent) {
    const hsl = divergent
      ? [t < 0 ? 215 : 4, 75, 96 - Math.min(Math.abs(t), 1) * 46]
      : [235 * (1 - t), 72, 52];
    const s = hsl[1] / 100, l = hsl[2] / 100;
    const k = function (n) { return (n + hsl[0] / 30) % 12; };
    const a = s * Math.min(l, 1 - l);
    const rgb = [0, 8, 4].map(function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); });
    // Texte noir ou blanc selon la luminance relative (contraste le plus fort)
    const lum = rgb.map(function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return { fond: 'rgb(' + rgb.map(function (c) { return Math.round(c * 255); }).join(',') + ')', texte: (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#111111' : '#ffffff', rgb: rgb };
  }

  function cartographies() {
    const C = window.CARTOS;
    if (!C) return;
    // Sélecteur : une table affichée à la fois, regroupées en « modifiées » et « contexte »
    document.querySelectorAll('[data-cartos]').forEach(function (bloc) { selecteurCartos(bloc, C); });
    // Cartes isolées (une seule table, sans sélecteur)
    document.querySelectorAll('[data-carto]').forEach(function (zone) {
      if (!zone.closest('[data-cartos]') && C[zone.dataset.carto]) cartographie(zone, C[zone.dataset.carto]);
    });
  }

  function selecteurCartos(bloc, C) {
    const cles = bloc.dataset.cartos.split(',').map(function (s) { return s.trim(); }).filter(function (k) { return C[k]; });
    // Titre du groupe « modifiées » : par défaut le flex v1, sinon celui du bloc (data-titre-modifiees)
    const groupes = [[bloc.dataset.titreModifiees || 'Modifiées par le flex v1', cles.filter(function (k) { return C[k].modifiee; })], ['Non modifiées (contexte)', cles.filter(function (k) { return !C[k].modifiee; })]];
    const nav = document.createElement('div');
    nav.className = 'cartos__nav';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Choisir une table');
    const panneaux = {};
    groupes.forEach(function (g) {
      if (!g[1].length) return;
      const titre = document.createElement('p');
      titre.className = 'cartos__groupe';
      titre.textContent = g[0];
      nav.appendChild(titre);
      g[1].forEach(function (k) {
        const t = C[k];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cartos__onglet' + (t.modifiee ? '' : ' cartos__onglet--contexte');
        b.setAttribute('role', 'tab');
        b.id = 'onglet-' + k;
        b.setAttribute('aria-controls', 'panneau-' + k);
        b.dataset.cle = k;
        b.innerHTML = '<span class="cartos__repere">' + t.repere + '</span>' + t.titre;
        nav.appendChild(b);
        const p = document.createElement('div');
        p.className = 'cartos__panneau';
        p.id = 'panneau-' + k;
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', b.id);
        p.hidden = true;
        p.innerHTML = '<div class="cartos__entete"><p class="cartos__statut' + (t.modifiee ? '' : ' cartos__statut--contexte') + '">' + (t.modifiee ? 'Modifiée · repère ' + t.repere : 'Non modifiée') + '</p>' +
          '<h4>' + t.titre + '</h4><p class="cartos__code"><code>' + t.nom + '</code></p><p>' + t.role + '</p><p class="cartos__source">Source : ' + t.source + '.</p></div>';
        const zone = document.createElement('div');
        zone.className = 'graphique__zone';
        p.appendChild(zone);
        bloc.appendChild(p);
        panneaux[k] = { bouton: b, panneau: p, zone: zone, fait: false };
      });
    });
    bloc.insertBefore(nav, bloc.firstChild);

    function choisir(k, focus) {
      Object.keys(panneaux).forEach(function (c) {
        const x = panneaux[c], actif = c === k;
        x.bouton.setAttribute('aria-selected', String(actif));
        x.bouton.tabIndex = actif ? 0 : -1;
        x.panneau.hidden = !actif;
      });
      const x = panneaux[k];
      if (!x.fait) { x.fait = true; cartographie(x.zone, C[k]); }
      if (x.zone.afficher3d) x.zone.afficher3d();
      if (focus) x.bouton.focus();
    }
    nav.addEventListener('click', function (e) { const b = e.target.closest('[data-cle]'); if (b) choisir(b.dataset.cle); });
    // Clavier : flèches entre les onglets (motif ARIA des onglets)
    nav.addEventListener('keydown', function (e) {
      const ordre = Object.keys(panneaux), i = ordre.indexOf(document.activeElement.dataset.cle);
      if (i < 0) return;
      const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (pas) { e.preventDefault(); choisir(ordre[(i + pas + ordre.length) % ordre.length], true); }
    });
    choisir(bloc.dataset.premier && panneaux[bloc.dataset.premier] ? bloc.dataset.premier : Object.keys(panneaux)[0]);
  }

  function cartographie(zone, t) {
    const base = t.base || 0; // tables de démarrage : le facteur A s'ajoute à l'injection
    const modifiee = t.modifiee !== false;
    // Libellés des vues : « Origine / Flex v1 » par défaut, « Avant / Après » pour les flashs suivants (t.libelles)
    const L = t.libelles || {};
    const vues = modifiee ? [['origine', L.origine || 'Origine'], ['flex', L.flex || 'Flex v1'], ['ecart', L.ecart || (t.ecartPoints ? 'Écart (points)' : 'Écart %')]] : [['origine', 'Valeurs']];
    if (modifiee && base) vues.push(['reel', 'Écart réel %']);
    const deuxD = t.lignes.valeurs.length > 1 && t.colonnes.valeurs.length > 1;
    const plat = function (m) { return m.reduce(function (a, l) { return a.concat(l); }, []); };
    const tous = plat(t.origine).concat(plat(t.flex));
    const min = Math.min.apply(null, tous), max = Math.max.apply(null, tous);
    const ecart = function (i, j, reel) {
      if (t.ecartPoints) return t.flex[i][j] - t.origine[i][j];
      return (t.flex[i][j] * (reel ? base : 1) / t.origine[i][j] - 1) * 100;
    };
    const valeur = function (vue, i, j) { return vue === 'origine' || vue === 'flex' ? t[vue][i][j] : ecart(i, j, vue === 'reel'); };
    const uniteEcart = t.uniteEcart || (t.ecartPoints ? ' pts' : ' %'); // les avances s'écartent en degrés
    const signe = function (v) { return (v > 0.05 ? '+' : '') + fr(v); };
    const avecUnite = function (v, u) { return u ? v + ' ' + u : v; };
    const libelleAxe = function (v) { return typeof v === 'number' ? fr(v, v % 1 ? 2 : 0) : v; };
    let vue = modifiee ? 'flex' : 'origine', scene3d = null;

    // Commandes : vue affichée, puis surface 3D pour les tables à deux dimensions
    const barre = document.createElement('div');
    barre.className = 'carto__commandes';
    barre.innerHTML = (vues.length > 1 ? '<div class="carto__vues" role="group" aria-label="Valeurs affichées">' + vues.map(function (v) {
      return '<button type="button" class="carto__bouton" data-vue="' + v[0] + '" aria-pressed="' + (v[0] === vue) + '">' + v[1] + '</button>';
    }).join('') + '</div>' : '') + (deuxD ? '<button type="button" class="carto__bouton carto__bouton--3d" data-3d aria-pressed="true">Surface 3D</button>' : '');
    zone.appendChild(barre);

    const boite = document.createElement('div');
    boite.className = 'tableau-defilement carto__defilement';
    const table = document.createElement('table');
    table.className = 'carto' + (t.colonnes.valeurs.length > 10 ? ' carto--dense' : '');
    boite.appendChild(table);
    zone.appendChild(boite);
    const echelle = document.createElement('p');
    echelle.className = 'carto__echelle';
    zone.appendChild(echelle);
    // Surface 3D affichée d'office pour les tables à deux dimensions (chargée quand la carte arrive à l'écran)
    const cadre3d = document.createElement('div');
    cadre3d.className = 'carto__3d';
    cadre3d.hidden = !deuxD;
    zone.appendChild(cadre3d);
    let chargement = null;
    function charger3d() {
      if (chargement || !deuxD || cadre3d.hidden) return;
      cadre3d.innerHTML = '<p class="carto__info">Chargement de la vue 3D…</p>';
      chargement = surface3d(cadre3d, t).then(function (s) { scene3d = s; dessiner(); }).catch(function () {
        cadre3d.innerHTML = '<p class="carto__info">La vue 3D n\'a pas pu se charger (librairie Three.js indisponible). Le tableau ci-dessus contient toutes les valeurs.</p>';
      });
    }
    zone.afficher3d = function () { if (zone.offsetParent) charger3d(); };
    if (deuxD) quandVisible(zone, function () { zone.afficher3d(); });

    // Table à une dimension avec courbe (pré-injection) : origine, flex stocké, flex réel
    if (t.courbe) {
      const courbe = document.createElement('div');
      courbe.className = 'carto__courbe';
      zone.appendChild(courbe);
      const temp = t.colonnes.valeurs.map(function (v) { return fr(v, v % 1 ? 2 : 0) + ' °C'; });
      const reel = t.flex[0].map(function (v) { return v * base; });
      graphiqueCourbes(courbe, {
        series: [
          { nom: 'Origine', valeurs: t.origine[0], couleur: 'var(--serie-neutre)', pointilles: true },
          { nom: 'Flex v1 (valeur stockée)', valeurs: t.flex[0], couleur: 'var(--serie-1)' },
          { nom: 'Flex v1 réel (×1,297)', valeurs: reel, couleur: 'var(--serie-2)' }
        ],
        etiquettes: temp, axeX: t.colonnes.nom.toLowerCase(), min: 0, max: 240, pas: 40, unite: t.unite, decimalesValeur: 1, hauteur: 260,
        description: t.titre + ' selon la température d\'eau : origine de 176 ms à -30 °C à 12,3 ms à 90 °C ; flex v1 réel de 229 ms à -30 °C à 14 ms à 90 °C'
      });
      tableau(courbe, ['Température', 'Origine', 'Flex v1 stocké', 'Flex v1 réel'], temp.map(function (tt, j) {
        return [tt, fr(t.origine[0][j], 3) + ' ms', fr(t.flex[0][j], 3) + ' ms', fr(reel[j], 1) + ' ms'];
      }));
    }

    function enteteColonne(j) {
      const c = t.colonnes, o = libelleAxe(c.valeurs[j]), f = c.valeursFlex ? libelleAxe(c.valeursFlex[j]) : o;
      const texte = o === f ? o : vue === 'origine' ? o : vue === 'flex' ? f : o + ' → ' + f;
      return avecUnite(texte, c.unite);
    }

    function dessiner() {
      const divergent = vue === 'ecart' || vue === 'reel';
      let borne = t.ecartPoints ? 0.5 : 1;
      if (divergent) t.origine.forEach(function (l, i) { l.forEach(function (_, j) { borne = Math.max(borne, Math.abs(valeur(vue, i, j))); }); });
      const position = function (v) { return divergent ? v / borne : (v - min) / (max - min || 1); };
      const libelle = vues.filter(function (v) { return v[0] === vue; })[0][1];
      const unite = divergent ? uniteEcart : (t.unite ? ' ' + t.unite : '');
      let html = '<caption class="visuellement-cache">' + t.titre + ' (' + t.nom + ') : ' + libelle + '</caption><thead><tr><th scope="col" class="carto__coin">' +
        (deuxD ? t.lignes.nom + ' \\ ' + t.colonnes.nom : (t.lignes.nom || t.colonnes.nom)) + '</th>';
      t.colonnes.valeurs.forEach(function (_, j) { html += '<th scope="col">' + enteteColonne(j) + '</th>'; });
      html += '</tr></thead><tbody>';
      t.origine.forEach(function (ligne, i) {
        const tete = t.lignes.valeurs.length > 1 ? avecUnite(libelleAxe(t.lignes.valeurs[i]), t.lignes.unite) : libelle;
        html += '<tr><th scope="row">' + tete + '</th>';
        ligne.forEach(function (_, j) {
          const v = valeur(vue, i, j), c = couleurCase(position(v), divergent);
          const detail = modifiee
            ? (L.origine || 'Origine') + ' ' + avecUnite(fr(t.origine[i][j], 3), t.unite) + ' · ' + (L.flex || 'flex') + ' ' + avecUnite(fr(t.flex[i][j], 3), t.unite) + ' · écart ' + signe(ecart(i, j)) + uniteEcart + (base ? ' · écart réel ' + signe(ecart(i, j, true)) + ' %' : '')
            : avecUnite(fr(t.origine[i][j], 3), t.unite) + ' (non modifiée)';
          const dansZone = t.zone && i >= t.zone.lignes[0] && i <= t.zone.lignes[1] && j >= t.zone.colonnes[0] && j <= t.zone.colonnes[1];
          html += '<td' + (dansZone ? ' class="carto__zone"' : '') + ' style="background:' + c.fond + ';color:' + c.texte + '" title="' + detail + (dansZone ? ' · zone visée' : '') + '">' + (divergent ? signe(v) : fr(v, t.decimales)) + '</td>';
        });
        html += '</tr>';
      });
      table.innerHTML = html + '</tbody>';
      echelle.innerHTML = divergent
        ? '<span>' + signe(-borne) + uniteEcart + '</span><span class="carto__degrade carto__degrade--ecart" aria-hidden="true"></span><span>' + signe(borne) + uniteEcart + '</span>'
        : '<span>' + fr(min, t.decimales) + unite + '</span><span class="carto__degrade" aria-hidden="true"></span><span>' + fr(max, t.decimales) + unite + '</span>';
      zone.querySelectorAll('.carto__zone-note').forEach(function (n) { n.remove(); });
      if (t.zone) echelle.insertAdjacentHTML('afterend', '<p class="carto__zone-note"><span aria-hidden="true"></span>' + t.zone.texte + '</p>');
      if (scene3d) scene3d.maj(t.origine.map(function (l, i) { return l.map(function (_, j) { return position(valeur(vue, i, j)); }); }), divergent, {
        // en 3D, l'unité est dans le titre de l'axe : les valeurs restent courtes et ne se chevauchent pas
        colonnes: t.colonnes.valeurs.map(function (_, j) { return t.colonnes.unite ? enteteColonne(j).replace(' ' + t.colonnes.unite, '') : enteteColonne(j); }),
        lignes: t.lignes.valeurs.map(function (v) { return libelleAxe(v); }),
        echelle: divergent ? [signe(-borne) + uniteEcart, signe(borne) + uniteEcart] : [fr(min, t.decimales) + unite, fr(max, t.decimales) + unite]
      });
    }

    barre.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.vue) {
        vue = b.dataset.vue;
        barre.querySelectorAll('[data-vue]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        dessiner();
      } else if (b.hasAttribute('data-3d')) {
        const ouvrir = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(ouvrir));
        cadre3d.hidden = !ouvrir;
        if (ouvrir) charger3d();
      }
    });
    dessiner();
  }

  // Surface 3D multicolore : rendu à la demande seulement (pas de boucle d'animation)
  function surface3d(cadre, t) {
    return Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]).then(function (m) {
      const THREE = m[0], nx = t.colonnes.valeurs.length, ny = t.lignes.valeurs.length;
      const bas = function (s) { return s === s.toUpperCase() ? s : s.toLowerCase(); }; // « MUL » reste en capitales
      const sens = function (axe) { return axe.unite === '°C' ? ' (froid à gauche)' : ' (bas à gauche)'; };
      cadre.innerHTML = '<p class="carto__info">Glissez pour tourner. Largeur : ' + bas(t.colonnes.nom) + sens(t.colonnes) + ' ; profondeur : ' + bas(t.lignes.nom) + ' ; hauteur et couleur : la valeur.</p>';
      const rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendu.domElement.setAttribute('aria-hidden', 'true');
      cadre.appendChild(rendu.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(-2.2, 2.4, 3.4);
      const controles = new m[1].OrbitControls(camera, rendu.domElement);
      controles.enableZoom = false; // la molette reste au défilement de la page
      controles.enablePan = false;
      rendu.domElement.style.touchAction = 'pan-y'; // OrbitControls bloque tout ; on rend le glissé vertical à la page
      controles.target.set(0, 0.45, 0);

      // Grille nx × ny : x = colonne, z = ligne, y = valeur
      const positions = new Float32Array(nx * ny * 3), couleurs = new Float32Array(nx * ny * 3), indices = [], aretes = [];
      for (let i = 0; i < ny; i++) {
        for (let j = 0; j < nx; j++) {
          const k = i * nx + j;
          positions[k * 3] = (j / (nx - 1) - 0.5) * 3;
          positions[k * 3 + 2] = (i / (ny - 1) - 0.5) * 2;
          if (j < nx - 1 && i < ny - 1) indices.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
          if (j < nx - 1) aretes.push(k, k + 1);
          if (i < ny - 1) aretes.push(k, k + nx);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
      geo.setIndex(indices);
      scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      const geoAretes = new THREE.BufferGeometry();
      geoAretes.setAttribute('position', geo.getAttribute('position'));
      geoAretes.setIndex(aretes);
      scene.add(new THREE.LineSegments(geoAretes, new THREE.LineBasicMaterial({ color: 0x1c1b22, transparent: true, opacity: 0.55 })));
      // Socle : le plan zéro, en grille discrète
      const socle = new THREE.GridHelper(3, nx - 1, 0xb9b7ad, 0xd8d6cd);
      socle.scale.z = 2 / 3;
      scene.add(socle);

      // Étiquettes façon logiciel de calibration : textes dessinés sur un canevas, toujours face à la caméra
      function etiquette(x, y, z, gras) {
        const toile = document.createElement('canvas');
        toile.width = 512; toile.height = 96;
        const texture = new THREE.CanvasTexture(toile);
        texture.colorSpace = THREE.SRGBColorSpace;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
        s.position.set(x, y, z);
        s.renderOrder = 2;
        s.userData = { toile: toile, gras: gras };
        scene.add(s);
        return s;
      }
      function ecrire(s, texte) {
        const ctx = s.userData.toile.getContext('2d');
        ctx.clearRect(0, 0, 512, 96);
        ctx.font = (s.userData.gras ? '700 ' : '600 ') + '42px system-ui, sans-serif';
        const l = Math.min(512, ctx.measureText(texte).width + 16);
        ctx.fillStyle = s.userData.gras ? '#1c1b22' : '#4a4955';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(texte, 256, 50);
        s.material.map.needsUpdate = true;
        // échelle : 0,15 unité de haut, largeur proportionnelle au texte (marges du canevas comprises)
        s.scale.set(0.24 * 512 / 96, 0.24, 1);
        s.userData.largeur = l;
      }
      const ex = function (j) { return (j / (nx - 1) - 0.5) * 3; }, ez = function (i) { return (i / (ny - 1) - 0.5) * 2; };
      const etColonnes = t.colonnes.valeurs.map(function (_, j) { return etiquette(ex(j), 0, 1.3, false); });
      const etLignes = t.lignes.valeurs.map(function (_, i) { return etiquette(1.95, 0, ez(i), false); });
      const titreAxe = function (a) { return a.unite ? a.nom + ' (' + a.unite + ')' : a.nom; };
      ecrire(etiquette(0, 0, 1.72, true), titreAxe(t.colonnes));
      ecrire(etiquette(1.95, 0, -1.45, true), titreAxe(t.lignes)); // derrière la 1re ligne : ne chevauche pas les valeurs
      // Axe vertical à l'arrière gauche : la hauteur va du minimum au maximum de la vue
      const axeV = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.5, 0, -1), new THREE.Vector3(-1.5, 0.9, -1)]);
      scene.add(new THREE.Line(axeV, new THREE.LineBasicMaterial({ color: 0x6b6978 })));
      const etMin = etiquette(-1.75, 0, -1, false), etMax = etiquette(-1.75, 0.9, -1, false);

      function rendre() { rendu.render(scene, camera); }
      function taille() {
        const l = cadre.clientWidth || 300, h = l < 520 ? Math.round(l * 0.95) : Math.min(380, Math.max(260, l * 0.6)); // presque carré sur mobile
        rendu.setSize(l, h);
        camera.aspect = l / h;
        camera.updateProjectionMatrix();
        // Cadre étroit (mobile) : la caméra recule pour garder toute la surface
        const recul = Math.max(0.85, 1.15 / camera.aspect);
        camera.position.sub(controles.target).setLength(5.4 * recul).add(controles.target);
        controles.update();
        rendre();
      }
      controles.addEventListener('change', rendre);
      if (window.ResizeObserver) new ResizeObserver(taille).observe(cadre);
      taille();

      return {
        // hauteurs : valeurs ramenées entre 0 et 1 (ou -1 et 1 pour les écarts)
        maj: function (hauteurs, divergent, etiquettes) {
          // au plus 8 étiquettes par axe (tables d'avance : 16 × 20 cases)
          const pasC = Math.ceil(nx / 8), pasL = Math.ceil(ny / 8);
          // la dernière valeur n'est écrite que si elle est assez loin de la précédente affichée
          const montre = function (k, n, pas) { return k % pas === 0 || (k === n - 1 && (n - 1) % pas >= pas / 2); };
          etiquettes.colonnes.forEach(function (txt, j) { ecrire(etColonnes[j], montre(j, nx, pasC) ? txt : ''); });
          etiquettes.lignes.forEach(function (txt, i) { ecrire(etLignes[i], montre(i, ny, pasL) ? txt : ''); });
          ecrire(etMin, etiquettes.echelle[0]);
          ecrire(etMax, etiquettes.echelle[1]);
          socle.position.y = divergent ? 0.45 : 0; // en vue écart, le plan de référence marque le 0 %
          hauteurs.forEach(function (l, i) {
            l.forEach(function (v, j) {
              const k = i * nx + j, c = couleurCase(v, divergent).rgb;
              positions[k * 3 + 1] = divergent ? 0.45 + v * 0.45 : v * 0.9;
              // couleurs du tableau, converties en linéaire pour le rendu
              c.forEach(function (x, n) { couleurs[k * 3 + n] = Math.pow(x, 2.2); });
            });
          });
          geo.attributes.position.needsUpdate = true;
          geo.attributes.color.needsUpdate = true;
          geo.computeBoundingSphere();
          rendre();
        }
      };
    });
  }


  /* --- Graphiques de la conversion éthanol (donnees-ethanol.js : window.ETHANOL) --- */
  function graphiquesEthanol() {
    const E = window.ETHANOL;
    if (!E) return;
    const zone = function (nom) { return document.querySelector('[data-graphique="' + nom + '"]'); };
    const bancs = function (a, b) {
      return [{ nom: 'Banc 1', valeurs: a, couleur: 'var(--serie-1)' }, { nom: 'Banc 2', valeurs: b, couleur: 'var(--serie-2)' }];
    };
    const pc = function (v) { return (v > 0 ? '+' : '') + fr(v, 2) + ' %'; };

    // Pression d'essence du 19/11 (voiture à l'arrêt) : relevés au manomètre (barres), puis régime pendant les essais à vide
    const z5 = zone('eth-pression');
    if (z5) {
      const mesures = [['Contact mis', 3.1, 'moteur arrêté'], ['Ralenti', 3.5, 'stable'], ['Accélérations', 3.5, 'constante jusqu\'à 6 107 tr/min'], ['Arrêt 18:32', 3.0, 'juste après l\'arrêt'], ['18:42', 2.9, 'dix minutes après']];
      graphiqueBarres(z5, {
        barres: mesures.map(function (m) { return { nom: '', groupe: m[0], valeur: m[1], couleur: 'var(--serie-1)', aide: fr(m[1]) + ' bar, ' + m[2] }; }),
        max: 4, pas: 1, unite: 'bar', decimales: 1, seuils: [{ v: 3.5, texte: 'valeur BMW : 3,5 bar' }],
        description: 'Pression d\'essence du 19/11/2026 au manomètre : 3,1 bar contact mis, 3,5 bar au ralenti et pendant les accélérations, 3,0 bar juste après l\'arrêt, 2,9 bar dix minutes plus tard',
        tableau: [['Moment', 'Pression', 'Détail'], mesures.map(function (m) { return [m[0], fr(m[1]) + ' bar', m[2]]; })]
      });
      if (E.pression) {
        const Pr = E.pression;
        graphiqueCourbes(z5, {
          titre: 'Régime pendant les essais', series: [{ nom: 'Régime', valeurs: Pr.rpm, couleur: 'var(--serie-2)' }], legende: false, etiquettes: Pr.t, axeX: 'heure (19/11)',
          min: 0, max: 7000, pas: 1000, unite: 'tr/min', decimalesValeur: 0, hauteur: 220,
          description: 'Régime pendant les essais de pression : ralenti vers 750 tr/min et accélérations à vide jusqu\'à 6 107 tr/min'
        });
        tableau(z5, ['Heure', 'Régime', 'Eau'], Pr.t.map(function (t, i) { return [t, Pr.rpm[i] + ' tr/min', fr(Pr.eau[i]) + ' °C']; }));
      }
    }

    // Profil de démarrage C3 : facteur flex v1 par rapport à l'origine (origine = 1)
    const z7 = zone('eth-c3');
    if (z7) {
      const pre = [1.30, 1.55, 1.58, 1.58, 1.41, 1.16, 1.14, 1.14];
      const temp = ['-30', '-20', '-10', '0', '10', '30', '60', '90'];
      const lanc = [['-30 à 0 °C', 1.41], ['9,75 °C', 1.22], ['30 à 90 °C', 1.16]];
      graphiqueBarres(z7, {
        barres: pre.map(function (v, i) { return { nom: temp[i], groupe: 'Pré-injection (°C)', valeur: v, texte: fr(v, 2), couleur: 'var(--serie-1)', aide: '×' + fr(v, 2) + ' à ' + temp[i] + ' °C' }; })
          .concat(lanc.map(function (l) { return { nom: l[0], groupe: 'Lancement', valeur: l[1], texte: fr(l[1], 2), couleur: 'var(--serie-2)', aide: '×' + fr(l[1], 2) + ' de l\'injection de lancement' }; })),
        max: 1.6, pas: 0.4, decimalesAxe: 1, unite: '×', seuils: [{ v: 1, texte: 'origine = 1' }],
        description: 'Profil de démarrage du flex v1 : pré-injection multipliée par 1,14 à 1,58 selon la température, injection de lancement par 1,41 au grand froid, 1,22 vers 10 °C et 1,16 moteur chaud',
        tableau: [['Élément', 'Température', 'Facteur réel'], pre.map(function (v, i) { return ['Pré-injection', temp[i] + ' °C', '×' + fr(v, 2)]; })
          .concat(lanc.map(function (l) { return ['Lancement', l[0], '×' + fr(l[1], 2)]; }))]
      });
    }
  }


  /* ------------------------------------------------------------------
     7. Garde-fou du moteur 3D : si le module moteur-3d.js n'a même pas pu
        s'exécuter (il signale lui-même les autres pannes), on l'explique ici.
     ------------------------------------------------------------------ */
  function surveillerMoteur() {
    const cadre = document.getElementById('moteur3d');
    if (!cadre) return;
    // Le moteur 3D ne se charge qu'à l'approche des parties 3D : le délai de 12 s ne démarre
    // donc que lorsque la maquette approche de l'écran (sinon, fausse alerte pour qui lit le haut de la page)
    const demarrer = function () { setTimeout(verifier, 12000); };
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(function (entrees) {
        if (entrees.some(function (e) { return e.isIntersecting; })) { obs.disconnect(); demarrer(); }
      }, { rootMargin: '100% 0px' });
      obs.observe(cadre);
    } else {
      demarrer();
    }
    function verifier() {
      // Onglet en arrière-plan : le navigateur ralentit tout, on revérifie plus tard
      if (document.hidden) { setTimeout(verifier, 12000); return; }
      if (cadre.classList.contains('est-pret') || cadre.querySelector('.moteur3d__cause')) return;
      // La librairie est chargée et la maquette se construit par étapes : moteur-3d.js signalera lui-même une panne
      if (cadre.classList.contains('est-en-cours')) return;
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
    }
  }


  // Outils de graphique partagés avec mesures-e39.js (mesures du 14/11)
  window.E39Graphiques = {
    svg: svg, fr: fr, quandVisible: quandVisible, montrerInfobulle: montrerInfobulle,
    cacherInfobulle: cacherInfobulle, tableau: tableau, legende: legende
  };

  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  surveillerMoteur();
  animerDebit();
  animerJauges();
  gererFichesPieces();
  gererComparaison();
  gererAgrandissement();
  gererPleinEcran();
  gererInfobulles();
  graphiquesReleves();
  graphiquesEthanol();
  cartographies();
})();
