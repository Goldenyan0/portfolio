/* ==========================================================================
   commun.js — comportements partagés par les 3 pages
   - Défilement fluide (Lenis) + liens d'ancre (Site.allerA : par les cartes pendant le voyage 3D)
   - Préchargeur (si présent dans la page)
   - Navigation : flou au scroll, masquée en descendant, menu mobile
   - Titres découpés mot à mot ([data-mots])
   - Révélations au scroll ([data-revele] → .est-visible)
   - Moteur de scroll partagé : volets entre sections ([data-volet]),
     parallax ([data-parallax]) et grands mots de fond ([data-glisse])
   - Panneaux flottants (CV) ; pendant le voyage 3D (accueil, page voiture), les sections
     sont des cartes (espace-3d.js) : pas de volets, de parallax ni de panneaux
   - Boutons magnétiques (souris uniquement ; curseur natif du système)
   Tout respecte prefers-reduced-motion : dans ce cas, rien ne bouge
   et la classe .anime n'est pas posée sur <html> (voir le <head>).
   ========================================================================== */

(function () {
  'use strict';

  // L'utilisateur a-t-il demandé moins d'animations dans son système ?
  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // L'appareil a-t-il une vraie souris (pas un écran tactile) ?
  const sourisFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Voyage 3D (espace-3d.js) : les sections sont des cartes, pas de scènes épinglées ni de volets
  const voyage = document.documentElement.classList.contains('voyage');

  // Fonctions de scroll enregistrées par les scripts de page (index.js…)
  const ecouteursScroll = [];

  // Outils exposés aux scripts de page
  window.Site = {
    mouvementReduit: mouvementReduit,
    sourisFine: sourisFine,
    lenis: null,
    progressionHero: 0,
    // Enregistre une fonction appelée à chaque image où la page défile
    surScroll: function (fn) { ecouteursScroll.push(fn); fn(); },
    // Force un recalcul (après un changement de mise en page)
    rafraichir: function () { demanderMiseAJour(); },
    // Borne une valeur entre min et max
    borner: function (v, min, max) { return Math.min(Math.max(v, min), max); },
    // Défile jusqu'à un élément (remplacée par espace-3d.js pendant le voyage : la carte qui le contient)
    allerA: function (el) {
      if (window.Site.lenis) window.Site.lenis.scrollTo(el, { duration: 1.4 });
      else el.scrollIntoView({ behavior: mouvementReduit ? 'auto' : 'smooth' });
    }
  };


  /* ------------------------------------------------------------------
     0. Une seule boucle requestAnimationFrame par page : Lenis et les scènes 3D
        (espace-3d.js, moteur-3d.js) y inscrivent leur prochaine image
     ------------------------------------------------------------------ */
  const aFaire = new Set();
  let planifie = false;
  let derniereAction = 0;
  // Une action qui peut faire défiler la page relance la boucle
  ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'].forEach(function (type) {
    window.addEventListener(type, function () { derniereAction = performance.now(); planifier(); }, { passive: true });
  });
  function planifier() {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(executer);
  }
  function executer(temps) {
    planifie = false;
    // Lenis ne demande des images que pendant un défilement (ou juste après une action de
    // l'utilisateur) : à l'arrêt, la page ne fait plus tourner de boucle
    const lenis = window.Site.lenis;
    if (lenis) {
      lenis.raf(temps);
      if (lenis.isScrolling || temps - derniereAction < 300) planifier();
    }
    const liste = Array.from(aFaire);
    aFaire.clear();
    liste.forEach(function (fn) { fn(temps); });
  }
  window.Site.image = function (fn) { aFaire.add(fn); planifier(); };


  /* ------------------------------------------------------------------
     1. Défilement fluide avec Lenis (désactivé si mouvement réduit)
     ------------------------------------------------------------------ */
  function lancerLenis() {
    if (mouvementReduit || typeof window.Lenis === 'undefined') return;

    const lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    window.Site.lenis = lenis;

    // Un défilement demandé par le site (liens, sommaire, cartes) relance aussi la boucle
    const scrollTo = lenis.scrollTo.bind(lenis);
    lenis.scrollTo = function (cible, options) { derniereAction = performance.now(); scrollTo(cible, options); planifier(); };
    planifier();

    // Les liens internes (#section) défilent en douceur au lieu de sauter
    document.addEventListener('click', function (e) {
      const lien = e.target.closest('a[href^="#"]');
      if (!lien) return;
      const id = lien.getAttribute('href');
      if (id === '#' || id === '#contenu') return; // le lien d'évitement garde son comportement natif
      const cible = document.querySelector(id);
      if (!cible) return;
      e.preventDefault();
      // Le hero est épinglé : pour y revenir, on remonte tout en haut
      if (id === '#accueil' && !voyage) lenis.scrollTo(0, { duration: 1.4 });
      else window.Site.allerA(cible);
    });
  }


  /* ------------------------------------------------------------------
     2. Préchargeur : compteur 0 → 100 %, barre, puis rideau vers le haut
     ------------------------------------------------------------------ */
  function lancerPrechargeur() {
    const prechargeur = document.getElementById('prechargeur');

    // Pas de préchargeur sur cette page : on signale tout de suite que la page est prête
    if (!prechargeur) {
      document.body.classList.add('hero-pret');
      document.dispatchEvent(new CustomEvent('site:pret'));
      return;
    }

    const valeur = document.getElementById('prechargeur-valeur');
    const barre = document.getElementById('prechargeur-barre');
    document.body.classList.add('scroll-bloque');
    if (window.Site.lenis) window.Site.lenis.stop();

    // Durée minimale pour que le compteur soit lisible ; la page doit aussi être chargée
    const dureeMin = mouvementReduit ? 0 : 1400;
    const debut = performance.now();
    let pageChargee = document.readyState === 'complete';
    window.addEventListener('load', function () { pageChargee = true; });
    // Sécurité : on ne bloque jamais le visiteur plus de 4 s
    setTimeout(function () { pageChargee = true; }, 4000);

    let affiche = 0;

    function etape(maintenant) {
      // Progression liée au temps écoulé ; plafonnée à 90 % tant que la page n'est pas chargée
      const brut = Math.min((maintenant - debut) / dureeMin, 1) * 100;
      const cible = pageChargee ? brut : Math.min(brut, 90);
      // Le chiffre affiché rattrape la cible en douceur
      affiche += (cible - affiche) * 0.15;
      if (cible - affiche < 0.5) affiche = cible;

      valeur.textContent = Math.floor(affiche);
      barre.style.transform = 'scaleX(' + affiche / 100 + ')';

      if (affiche >= 100 && pageChargee) {
        terminer();
      } else {
        window.Site.image(etape);
      }
    }

    function terminer() {
      valeur.textContent = '100';
      barre.style.transform = 'scaleX(1)';
      setTimeout(function () {
        prechargeur.classList.add('est-termine');
        document.body.classList.remove('scroll-bloque');
        if (window.Site.lenis) window.Site.lenis.start();
        // La cascade du hero démarre pendant que le rideau se lève
        setTimeout(function () {
          document.body.classList.add('hero-pret');
          document.dispatchEvent(new CustomEvent('site:pret'));
        }, mouvementReduit ? 0 : 350);
        setTimeout(function () { prechargeur.classList.add('est-retire'); }, mouvementReduit ? 0 : 1100);
      }, mouvementReduit ? 0 : 200);
    }

    if (mouvementReduit) {
      // Pas de compteur animé : on attend juste le chargement
      const attendre = function () { pageChargee ? terminer() : setTimeout(attendre, 50); };
      attendre();
    } else {
      window.Site.image(etape);
    }
  }


  /* ------------------------------------------------------------------
     3. Navigation : flou après 40 px, cachée en descendant, visible en remontant
     ------------------------------------------------------------------ */
  function gererNavigation() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let dernierY = window.scrollY;
    window.Site.surScroll(function () {
      const y = window.scrollY;
      nav.classList.toggle('nav--floue', y > 40);

      const menuOuvert = document.body.classList.contains('menu-ouvert');
      // On cache seulement après le premier écran et si on descend franchement
      if (!menuOuvert && y > 400 && y > dernierY + 4) {
        nav.classList.add('nav--cachee');
      } else if (y < dernierY - 4 || y <= 400) {
        nav.classList.remove('nav--cachee');
      }
      dernierY = y;
    });

    // Menu mobile
    const burger = document.getElementById('burger');
    const menu = document.getElementById('menu-mobile');
    if (!burger || !menu) return;

    function basculerMenu(ouvrir) {
      burger.setAttribute('aria-expanded', String(ouvrir));
      burger.querySelector('.visuellement-cache').textContent = ouvrir ? 'Fermer le menu' : 'Ouvrir le menu';
      menu.classList.toggle('est-ouvert', ouvrir);
      document.body.classList.toggle('menu-ouvert', ouvrir);
      document.body.classList.toggle('scroll-bloque', ouvrir);
      if (window.Site.lenis) ouvrir ? window.Site.lenis.stop() : window.Site.lenis.start();
    }

    burger.addEventListener('click', function () {
      basculerMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    // Un clic sur un lien ferme le menu
    menu.querySelectorAll('a').forEach(function (lien) {
      lien.addEventListener('click', function () { basculerMenu(false); });
    });
    // Échap ferme le menu
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('est-ouvert')) {
        basculerMenu(false);
        burger.focus();
      }
    });
  }


  /* ------------------------------------------------------------------
     4. Titres découpés mot à mot : chaque mot est enveloppé dans
        <span class="mot"><span class="mot__interieur">…</span></span>
        (les balises internes comme <em> sont conservées)
     ------------------------------------------------------------------ */
  function decouperTitres() {
    if (mouvementReduit) return;

    document.querySelectorAll('[data-mots]').forEach(function (titre) {
      // Les lecteurs d'écran lisent le titre entier, pas mot par mot
      titre.setAttribute('aria-label', titre.textContent.replace(/\s+/g, ' ').trim());
      let rang = 0;

      function traiter(noeud) {
        Array.from(noeud.childNodes).forEach(function (enfant) {
          if (enfant.nodeType === Node.TEXT_NODE) {
            const morceaux = enfant.textContent.split(/(\s+)/);
            const fragment = document.createDocumentFragment();
            morceaux.forEach(function (morceau) {
              if (morceau === '') return;
              if (/^\s+$/.test(morceau)) {
                fragment.appendChild(document.createTextNode(' '));
                return;
              }
              const mot = document.createElement('span');
              mot.className = 'mot';
              mot.setAttribute('aria-hidden', 'true');
              const interieur = document.createElement('span');
              interieur.className = 'mot__interieur';
              interieur.style.setProperty('--i', rang++);
              interieur.textContent = morceau;
              mot.appendChild(interieur);
              fragment.appendChild(mot);
            });
            enfant.replaceWith(fragment);
          } else if (enfant.nodeType === Node.ELEMENT_NODE) {
            traiter(enfant);
          }
        });
      }
      traiter(titre);
    });
  }


  /* ------------------------------------------------------------------
     5. Révélations au scroll : ajoute .est-visible aux [data-revele] et [data-mots]
     ------------------------------------------------------------------ */
  function gererRevelations() {
    const elements = Array.from(document.querySelectorAll('[data-revele], [data-mots]'));

    if (mouvementReduit) {
      elements.forEach(function (el) { el.classList.add('est-visible'); });
      return;
    }

    // Remarque : on n'utilise pas IntersectionObserver ici, car il tient compte
    // du clip-path — un élément encore "replié" (clip-path à 100 %) n'est jamais vu.
    // getBoundingClientRect, lui, donne la vraie place de l'élément.
    let enAttente = elements;
    window.Site.surScroll(function () {
      if (!enAttente.length) return;
      const h = window.innerHeight;
      const l = window.innerWidth;
      enAttente = enAttente.filter(function (el) {
        const zone = el.getBoundingClientRect();
        const visible = zone.top < h * 0.9 && zone.bottom > 0 && zone.left < l && zone.right > 0;
        // L'élément est montré une seule fois
        if (visible) el.classList.add('est-visible');
        return !visible;
      });
    });
  }


  /* ------------------------------------------------------------------
     6. Moteur de scroll partagé
        Une seule boucle par image : toutes les fonctions enregistrées
        avec Site.surScroll() sont appelées quand la page défile.
     ------------------------------------------------------------------ */
  let miseAJourDemandee = false;
  function demanderMiseAJour() {
    if (miseAJourDemandee) return;
    miseAJourDemandee = true;
    window.Site.image(function () {
      miseAJourDemandee = false;
      ecouteursScroll.forEach(function (fn) { fn(); });
    });
  }
  window.addEventListener('scroll', demanderMiseAJour, { passive: true });
  window.addEventListener('resize', demanderMiseAJour);

  function gererEffetsScroll() {
    if (mouvementReduit || voyage) return;
    const borner = window.Site.borner;

    // Volets : --volet passe de 0 à 1 pendant que la section entre dans l'écran
    const volets = document.querySelectorAll('[data-volet]');
    // Parallax : décalage vertical proportionnel à la distance au centre de l'écran
    const parallaxes = document.querySelectorAll('[data-parallax]');
    // Grands mots de fond : glissent horizontalement pendant la traversée de leur section
    const glisses = document.querySelectorAll('[data-glisse]');

    window.Site.surScroll(function () {
      const h = window.innerHeight;

      volets.forEach(function (el) {
        const haut = el.getBoundingClientRect().top;
        el.style.setProperty('--volet', borner((h - haut) / (h * 0.75), 0, 1).toFixed(3));
      });

      parallaxes.forEach(function (el) {
        // On retire le décalage déjà appliqué pour mesurer la position "naturelle"
        const actuel = parseFloat(el.dataset.decalage || '0');
        const zone = el.getBoundingClientRect();
        const centre = zone.top - actuel + zone.height / 2;
        const decalage = (h / 2 - centre) * parseFloat(el.dataset.parallax);
        el.dataset.decalage = decalage.toFixed(1);
        el.style.setProperty('--py', decalage.toFixed(1) + 'px');
      });

      glisses.forEach(function (el) {
        const zone = el.parentElement.getBoundingClientRect();
        const traversee = borner((h - zone.top) / (h + zone.height), 0, 1); // 0 → 1
        const decalage = (0.5 - traversee) * parseFloat(el.dataset.glisse) * window.innerWidth;
        el.style.setProperty('--gx', decalage.toFixed(1) + 'px');
      });
    });
  }


  /* ------------------------------------------------------------------
     Timelines ([data-timeline]) : le trait violet se dessine de haut en bas
     avec le scroll (utilisées par l'accueil et le CV)
     ------------------------------------------------------------------ */
  function gererTimelines() {
    const timelines = document.querySelectorAll('[data-timeline]');
    if (!timelines.length) return;

    if (mouvementReduit) {
      timelines.forEach(function (t) { t.style.setProperty('--progression', '1'); });
      return;
    }

    window.Site.surScroll(function () {
      const repere = window.innerHeight * 0.7; // le trait suit ce point de l'écran
      timelines.forEach(function (t) {
        const zone = t.getBoundingClientRect();
        t.style.setProperty('--progression', window.Site.borner((repere - zone.top) / zone.height, 0, 1).toFixed(3));
      });
    });
  }


  /* ------------------------------------------------------------------
     Panneaux flottants : le contenu des sections (et la feuille du CV)
     devient un panneau de verre posé dans l'espace 3D (voir espace-3d.js).
     --approche varie de -1 (panneau qui s'éloigne, au-dessus) à 1 (panneau
     qui arrive, en dessous) ; il vaut 0 tant que le panneau occupe le centre
     de l'écran. Le CSS en tire profondeur, inclinaison et transparence.
     ------------------------------------------------------------------ */
  function gererPanneaux() {
    const selecteur = '.section > .conteneur, .chiffres > .conteneur, .projets__ecran, .cv-feuille, .cv-actions';
    // Exclus : scènes épinglées, maquette 3D, visite guidée et éléments qui ont déjà leur propre animation d'entrée
    const exclus = '.hero-scene, .pourquoi, .moteur, .documentation, .e39-hero, .encyclopedie';
    const panneaux = Array.from(document.querySelectorAll(selecteur)).filter(function (el) {
      return !el.closest(exclus) && !el.hasAttribute('data-revele');
    });
    if (voyage) return;
    panneaux.forEach(function (p, i) {
      p.classList.add('panneau');
      p.style.setProperty('--cote', i % 2 ? '1' : '-1');
    });
    if (!panneaux.length || mouvementReduit) return;

    const borner = window.Site.borner;
    window.Site.surScroll(function () {
      const h = window.innerHeight;
      panneaux.forEach(function (p) {
        const zone = p.getBoundingClientRect();
        let a = 0;
        if (zone.top > h * 0.62) a = (zone.top - h * 0.62) / h;
        else if (zone.bottom < h * 0.38) a = (zone.bottom - h * 0.38) / h;
        a = borner(a, -1, 1);
        if (Math.abs(a - (p.approche || 0)) < 0.002) return;
        p.approche = a;
        p.style.setProperty('--approche', a.toFixed(3));
      });
    });
  }


  /* ------------------------------------------------------------------
     7. Boutons magnétiques : le bouton est attiré vers la souris
     ------------------------------------------------------------------ */
  function gererMagnetisme() {
    if (!sourisFine || mouvementReduit) return;

    document.querySelectorAll('.magnetique').forEach(function (bouton) {
      const texte = bouton.querySelector('.bouton__texte');

      bouton.addEventListener('pointermove', function (e) {
        const zone = bouton.getBoundingClientRect();
        const dx = e.clientX - (zone.left + zone.width / 2);
        const dy = e.clientY - (zone.top + zone.height / 2);
        bouton.style.transform = 'translate(' + dx * 0.3 + 'px,' + dy * 0.4 + 'px)';
        if (texte) texte.style.transform = 'translate(' + dx * 0.12 + 'px,' + dy * 0.15 + 'px)';
      });

      bouton.addEventListener('pointerleave', function () {
        bouton.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        bouton.style.transform = '';
        if (texte) {
          texte.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
          texte.style.transform = '';
        }
        setTimeout(function () {
          bouton.style.transition = '';
          if (texte) texte.style.transition = '';
        }, 600);
      });
    });
  }


  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  lancerLenis();
  lancerPrechargeur();
  gererNavigation();
  decouperTitres();
  gererRevelations();
  gererEffetsScroll();
  gererTimelines();
  gererPanneaux();
  gererMagnetisme();
})();
