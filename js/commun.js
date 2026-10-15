/* ==========================================================================
   commun.js — comportements partagés par les 3 pages
   - Défilement fluide (Lenis) + liens d'ancre
   - Préchargeur (si présent dans la page)
   - Navigation : flou au scroll, masquée en descendant, menu mobile
   - Titres découpés mot à mot ([data-mots])
   - Révélations au scroll ([data-revele] → .est-visible)
   - Moteur de scroll partagé : volets entre sections ([data-volet]),
     parallax ([data-parallax]) et grands mots de fond ([data-glisse])
   - Curseur personnalisé (souris uniquement) et boutons magnétiques
   Tout respecte prefers-reduced-motion : dans ce cas, rien ne bouge
   et la classe .anime n'est pas posée sur <html> (voir le <head>).
   ========================================================================== */

(function () {
  'use strict';

  // L'utilisateur a-t-il demandé moins d'animations dans son système ?
  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // L'appareil a-t-il une vraie souris (pas un écran tactile) ?
  const sourisFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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
    borner: function (v, min, max) { return Math.min(Math.max(v, min), max); }
  };


  /* ------------------------------------------------------------------
     1. Défilement fluide avec Lenis (désactivé si mouvement réduit)
     ------------------------------------------------------------------ */
  function lancerLenis() {
    if (mouvementReduit || typeof window.Lenis === 'undefined') return;

    const lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    window.Site.lenis = lenis;

    function boucle(temps) {
      lenis.raf(temps);
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);

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
      lenis.scrollTo(id === '#accueil' ? 0 : cible, { duration: 1.4 });
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
        requestAnimationFrame(etape);
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
      requestAnimationFrame(etape);
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
    requestAnimationFrame(function () {
      miseAJourDemandee = false;
      ecouteursScroll.forEach(function (fn) { fn(); });
    });
  }
  window.addEventListener('scroll', demanderMiseAJour, { passive: true });
  window.addEventListener('resize', demanderMiseAJour);

  function gererEffetsScroll() {
    if (mouvementReduit) return;
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
     7. Curseur personnalisé : un point + un anneau qui suit avec retard
     ------------------------------------------------------------------ */
  function gererCurseur() {
    if (!sourisFine) return;
    const point = document.querySelector('.curseur');
    const anneau = document.querySelector('.curseur-anneau');
    if (!point || !anneau) return;

    let sourisX = -100, sourisY = -100;
    let anneauX = -100, anneauY = -100;
    let actif = false;

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      sourisX = e.clientX;
      sourisY = e.clientY;
      if (!actif) {
        actif = true;
        anneauX = sourisX;
        anneauY = sourisY;
        document.documentElement.classList.add('curseur-actif');
      }
    }, { passive: true });

    // La souris quitte la fenêtre : on cache le curseur
    document.addEventListener('mouseleave', function () {
      document.documentElement.classList.remove('curseur-actif');
      actif = false;
    });

    // L'anneau grossit au-dessus des éléments cliquables
    const cliquables = 'a, button, [role="button"], label, .projet__carte';
    document.addEventListener('pointerover', function (e) {
      if (e.target.closest(cliquables)) anneau.classList.add('est-survol');
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest(cliquables)) anneau.classList.remove('est-survol');
    });

    // Avec mouvement réduit, l'anneau suit la souris sans traînée
    const lissage = mouvementReduit ? 1 : 0.18;

    function boucle() {
      anneauX += (sourisX - anneauX) * lissage;
      anneauY += (sourisY - anneauY) * lissage;
      point.style.transform = 'translate3d(' + sourisX + 'px,' + sourisY + 'px,0)';
      anneau.style.transform = 'translate3d(' + anneauX + 'px,' + anneauY + 'px,0)';
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);
  }


  /* ------------------------------------------------------------------
     8. Boutons magnétiques : le bouton est attiré vers la souris
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
  gererCurseur();
  gererMagnetisme();
})();
