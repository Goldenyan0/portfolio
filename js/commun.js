/* ==========================================================================
   commun.js — comportements partagés par les 3 pages
   - Préchargeur (si présent dans la page)
   - Navigation : flou au scroll, masquée en descendant, menu mobile
   - Révélations au scroll ([data-revele] → .est-visible)
   - Curseur personnalisé (souris uniquement)
   - Boutons magnétiques (.magnetique)
   Tout respecte prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  // L'utilisateur a-t-il demandé moins d'animations dans son système ?
  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // L'appareil a-t-il une vraie souris (pas un écran tactile) ?
  const sourisFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Petit outil exposé aux scripts de page (index.js, cv.js, e39.js)
  window.Site = { mouvementReduit: mouvementReduit, sourisFine: sourisFine };


  /* ------------------------------------------------------------------
     1. Préchargeur : compteur 0 → 100 %, barre, puis rideau vers le haut
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
     2. Navigation : flou après 40 px, cachée en descendant, visible en remontant
     ------------------------------------------------------------------ */
  function gererNavigation() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let dernierY = window.scrollY;
    let enAttente = false;

    function mettreAJour() {
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
      enAttente = false;
    }

    window.addEventListener('scroll', function () {
      if (!enAttente) {
        enAttente = true;
        requestAnimationFrame(mettreAJour);
      }
    }, { passive: true });
    mettreAJour();

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
     3. Révélations au scroll : ajoute .est-visible aux [data-revele]
        (+ titres .titre-section pour le soulignement qui se dessine)
     ------------------------------------------------------------------ */
  function gererRevelations() {
    const elements = document.querySelectorAll('[data-revele]');

    if (mouvementReduit || !('IntersectionObserver' in window)) {
      elements.forEach(function (el) { el.classList.add('est-visible'); });
      return;
    }

    const observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting) {
          entree.target.classList.add('est-visible');
          // L'élément est montré une seule fois
          observateur.unobserve(entree.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    elements.forEach(function (el) { observateur.observe(el); });
  }


  /* ------------------------------------------------------------------
     4. Curseur personnalisé : un point + un anneau qui suit avec retard
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
     5. Boutons magnétiques : le bouton est attiré vers la souris
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
  lancerPrechargeur();
  gererNavigation();
  gererRevelations();
  gererCurseur();
  gererMagnetisme();
})();
