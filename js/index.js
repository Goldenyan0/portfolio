/* ==========================================================================
   index.js — animations et interactions de la page d'accueil
   - Effet machine à écrire du hero
   - Hero en scrollytelling (le titre se réduit et s'efface, le fond 3D zoome)
   - "Pourquoi moi" épinglé : une comparaison par écran
     (sauf pendant le voyage 3D : le hero et "Pourquoi moi" sont alors des cartes fixes)
   - Compteurs, barres de compétences (les timelines sont dans commun.js)
   - Filtre de la grille des projets (animation fluide) + inclinaison 3D des cartes
   - Carrousel : piste à défilement natif (scroll-snap), glisser à la souris avec élan,
     flèches et clavier ; bouton « Voir le projet »
     sur les cartes qui ont un lien (même destination que la carte)
   - Formulaire de contact (EmailJS + champ piège anti-spam)
   Dépend de commun.js (objet window.Site).
   ========================================================================== */

(function () {
  'use strict';

  const Site = window.Site;
  const mouvementReduit = Site.mouvementReduit;
  const sourisFine = Site.sourisFine;
  const borner = Site.borner;
  const racine = document.documentElement;

  // Progression (0 → 1) d'une "scène" épinglée : 0 quand son haut touche le haut
  // de l'écran, 1 quand son bas touche le bas de l'écran.
  function progressionScene(scene) {
    const zone = scene.getBoundingClientRect();
    const course = zone.height - window.innerHeight;
    return course > 0 ? borner(-zone.top / course, 0, 1) : 0;
  }


  /* ------------------------------------------------------------------
     1. Machine à écrire : tape, attend, efface, phrase suivante
     ------------------------------------------------------------------ */
  function lancerTyping() {
    const cible = document.getElementById('typing');
    if (!cible || mouvementReduit) return; // mouvement réduit : le texte reste fixe

    const phrases = [
      'Alternant informatique',
      'Étudiant BTS SIO',
      'Systèmes & réseaux',
      'Cybersécurité',
      'IA générative au quotidien'
    ];
    let indexPhrase = 0;
    let indexLettre = phrases[0].length; // la 1re phrase est déjà affichée dans le HTML
    let efface = true;

    function etape() {
      if (efface) {
        indexLettre--;
        cible.textContent = phrases[indexPhrase].slice(0, indexLettre);
        if (indexLettre === 0) {
          efface = false;
          indexPhrase = (indexPhrase + 1) % phrases.length;
          setTimeout(etape, 350);
          return;
        }
        setTimeout(etape, 35);
      } else {
        indexLettre++;
        cible.textContent = phrases[indexPhrase].slice(0, indexLettre);
        if (indexLettre === phrases[indexPhrase].length) {
          efface = true;
          setTimeout(etape, 2200);
          return;
        }
        setTimeout(etape, 70);
      }
    }
    // Premier effacement après un temps de lecture
    setTimeout(etape, 2600);
  }


  /* ------------------------------------------------------------------
     2. Hero en scrollytelling
        Pendant la traversée de la scène (hero épinglé) :
        - les deux lignes du nom s'écartent, rétrécissent et s'effacent
        - le reste du contenu monte et disparaît, le visuel s'envole
        - le fond 3D zoome (reseau-3d.js lit Site.progressionHero)
        - en fin de course, le hero se détache comme une carte
     ------------------------------------------------------------------ */
  function gererHero() {
    const scene = document.getElementById('hero-scene');
    // Voyage 3D : le hero est une carte comme les autres, il n'est pas épinglé
    if (!scene || mouvementReduit || racine.classList.contains('voyage')) return;

    const hero = document.getElementById('accueil');
    const grille = hero.querySelector('.hero__grille');
    const ligne1 = document.getElementById('hero-ligne-1');
    const ligne2 = document.getElementById('hero-ligne-2');
    const haut = document.getElementById('hero-haut');
    const suite = document.getElementById('hero-suite');
    const visuel = document.getElementById('hero-visuel');
    const indicateur = document.getElementById('indicateur-scroll');
    const formes = hero.querySelectorAll('[data-profondeur]');

    // Sur un écran trop petit pour tout le contenu, le hero n'est pas épinglé
    function verifierPlace() {
      const besoin = grille.offsetHeight + 200; // marges haute (navigation) et basse
      racine.classList.toggle('hero-libre', besoin > window.innerHeight);
    }
    verifierPlace();
    window.addEventListener('resize', verifierPlace);

    // Position de la souris (-0,5 → 0,5) pour décaler les formes décoratives
    let sourisX = 0, sourisY = 0;
    if (sourisFine) {
      window.addEventListener('pointermove', function (e) {
        sourisX = e.clientX / window.innerWidth - 0.5;
        sourisY = e.clientY / window.innerHeight - 0.5;
        Site.rafraichir();
      }, { passive: true });
    }

    Site.surScroll(function () {
      const p = racine.classList.contains('hero-libre')
        ? borner(window.scrollY / window.innerHeight, 0, 1)
        : progressionScene(scene);
      Site.progressionHero = p;
      const vw = window.innerWidth / 100;

      // Le nom : les deux lignes s'écartent, rétrécissent et s'effacent
      const echelle = 1 - p * 0.45;
      const opaciteTitre = String(borner(1 - p * 1.5, 0, 1));
      ligne1.style.transform = 'translate3d(' + (-p * 22 * vw) + 'px,' + (-p * 40) + 'px,0) scale(' + echelle + ')';
      ligne2.style.transform = 'translate3d(' + (p * 22 * vw) + 'px,' + (-p * 40) + 'px,0) scale(' + echelle + ')';
      ligne1.style.opacity = opaciteTitre;
      ligne2.style.opacity = opaciteTitre;

      // Le reste du contenu part plus vite (effet de profondeur)
      haut.style.transform = 'translate3d(0,' + (-p * 140) + 'px,0)';
      haut.style.opacity = String(borner(1 - p * 2.5, 0, 1));
      suite.style.transform = 'translate3d(0,' + (-p * 180) + 'px,0)';
      suite.style.opacity = String(borner(1 - p * 2.2, 0, 1));
      visuel.style.transform = 'translate3d(0,' + (-p * 260) + 'px,0) scale(' + (1 + p * 0.25) + ') rotate(' + p * 10 + 'deg)';
      visuel.style.opacity = String(borner(1 - p * 1.6, 0, 1));

      // Formes décoratives : vitesses différentes + suivi de la souris
      formes.forEach(function (forme) {
        const prof = parseFloat(forme.dataset.profondeur);
        forme.style.transform = 'translate3d(' + sourisX * prof * 60 + 'px,' +
          (-p * prof * 900 + sourisY * prof * 60) + 'px,0)';
      });

      // Fin de course : le hero se détache comme une carte qui s'éloigne
      const k = borner((p - 0.7) / 0.3, 0, 1);
      hero.style.transform = k ? 'scale(' + (1 - k * 0.07) + ')' : '';
      hero.style.borderRadius = k ? (k * 40) + 'px' : '';

      if (indicateur) indicateur.classList.toggle('est-masque', p > 0.02);
    });
  }


  /* ------------------------------------------------------------------
     3. "Pourquoi moi" épinglé : 4 comparaisons, une par écran.
        La suivante recouvre la précédente en volet depuis le bas ;
        la rature se dessine avec le scroll, puis la contre-valeur apparaît.
     ------------------------------------------------------------------ */
  function gererPourquoi() {
    const scene = document.getElementById('pourquoi-scene');
    if (!scene || !racine.classList.contains('anime') || racine.classList.contains('voyage')) return;

    const comparaisons = Array.from(document.querySelectorAll('#comparaisons .comparaison'));
    const index = document.getElementById('pourquoi-index');
    const barre = scene.querySelector('.pourquoi__progression');
    const n = comparaisons.length;

    Site.surScroll(function () {
      const p = progressionScene(scene);
      const t = p * n; // de 0 à n
      const active = Math.min(Math.floor(t), n - 1);

      comparaisons.forEach(function (comp, i) {
        // Volet d'entrée : la comparaison i arrive entre t = i - 0,3 et t = i
        const entree = i === 0 ? 1 : borner((t - i + 0.3) / 0.3, 0, 1);
        // Recul quand la suivante la recouvre
        const suivante = i + 1 < n ? borner((t - i - 0.7) / 0.3, 0, 1) : 0;
        comp.style.setProperty('--entree', entree.toFixed(3));
        comp.style.setProperty('--recul', (1 - suivante * 0.06).toFixed(3));
        comp.style.setProperty('--rature', borner((t - i) / 0.35, 0, 1).toFixed(3));
        comp.classList.toggle('est-contre', t - i > 0.4);
      });

      index.textContent = String(active + 1).padStart(2, '0');
      barre.style.setProperty('--progression', p.toFixed(3));
    });
  }


  /* ------------------------------------------------------------------
     Outil : appelle "action" une seule fois quand "element" devient visible
     ------------------------------------------------------------------ */
  function quandVisible(element, action, seuil) {
    if (!('IntersectionObserver' in window)) { action(); return; }
    const obs = new IntersectionObserver(function (entrees) {
      if (entrees[0].isIntersecting) {
        action();
        obs.disconnect();
      }
    }, { threshold: seuil || 0.3 });
    obs.observe(element);
  }


  /* ------------------------------------------------------------------
     4. Compteurs : de 0 à la valeur cible, avec ralentissement à la fin
     ------------------------------------------------------------------ */
  function gererCompteurs() {
    if (mouvementReduit) return; // les valeurs finales sont déjà dans le HTML

    document.querySelectorAll('.compteur').forEach(function (compteur) {
      const cible = parseInt(compteur.dataset.cible, 10);
      compteur.textContent = '0';

      quandVisible(compteur, function () {
        const duree = 1800;
        const debut = performance.now();
        function etape(maintenant) {
          const t = Math.min((maintenant - debut) / duree, 1);
          const adouci = 1 - Math.pow(2, -10 * t); // courbe "ease-out expo"
          compteur.textContent = String(Math.round(cible * (t === 1 ? 1 : adouci)));
          if (t < 1) Site.image(etape);
        }
        Site.image(etape);
      }, 0.6);
    });
  }


  /* ------------------------------------------------------------------
     5. Barres de compétences : se remplissent quand le bloc apparaît
     ------------------------------------------------------------------ */
  function gererBarres() {
    const bloc = document.getElementById('competences');
    if (!bloc) return;
    const barres = bloc.querySelectorAll('.competence__remplissage');

    quandVisible(bloc, function () {
      barres.forEach(function (barre, i) {
        // Petit décalage entre chaque barre pour un effet de vague
        barre.style.transitionDelay = (mouvementReduit ? 0 : i * 0.06) + 's';
        barre.style.width = barre.dataset.niveau + '%';
      });
    }, 0.15);
  }


  /* ------------------------------------------------------------------
     6 bis. Carrousel des projets : une piste horizontale à défilement natif
        (scroll-snap), donc fluide au doigt comme au pavé tactile.
        - souris : on attrape la piste et on la fait glisser, avec un élan au lâcher ;
        - flèches (boutons), clavier (← → Début Fin), clic sur une carte de côté ;
        - la carte au centre est mise en avant (classe seulement : transform et opacity) ;
        - la position n'est lue qu'une fois par image (requestAnimationFrame).
        Sans JavaScript, la grille d'origine reste affichée.
     ------------------------------------------------------------------ */
  function gererCarrousel() {
    const grille = document.getElementById('grille-projets');
    const commandes = document.getElementById('carrousel-commandes');
    if (!grille || !commandes) return null;
    const projets = Array.from(grille.querySelectorAll('.projet'));
    if (projets.length < 2) return null;

    racine.classList.add('carrousel-actif');
    commandes.hidden = false;
    const aide = document.querySelector('.carrousel__aide');
    if (aide) aide.hidden = false;
    grille.tabIndex = 0;
    grille.setAttribute('role', 'region');
    grille.setAttribute('aria-roledescription', 'carrousel');
    grille.setAttribute('aria-label', 'Projets : faites glisser, ou utilisez les flèches gauche et droite');

    const texteRang = commandes.querySelector('[data-rang]');
    const texteTotal = commandes.querySelector('[data-total]');
    const texteNom = commandes.querySelector('[data-nom]');
    const fleches = commandes.querySelectorAll('[data-sens]');
    let visibles = projets.slice();
    let index = -1;
    let centres = [];
    let aGauche = false;   // grand écran : cartes calées à gauche (alignées sur le titre), sinon centrées
    let marge = 0;

    // Bouton « Voir le projet » : sur chaque carte qui a un lien, vers la même destination
    projets.forEach(function (p) {
      const lien = p.querySelector('.projet__lien');
      if (!lien) return;
      const b = document.createElement('a');
      b.className = 'projet__bouton';
      b.href = lien.href;
      if (lien.target) { b.target = lien.target; b.rel = lien.rel; }
      b.innerHTML = 'Voir le projet <svg class="icone" aria-hidden="true"><use href="#i-fleche"/></svg>';
      b.setAttribute('aria-label', lien.textContent.trim() || 'Voir le projet');
      p.querySelector('.projet__corps').appendChild(b);
    });

    // Centre de chaque carte dans la piste (mesuré seulement quand la taille change)
    function mesurer() {
      aGauche = visibles.length > 0 && getComputedStyle(visibles[0]).scrollSnapAlign.indexOf('start') !== -1;
      marge = parseFloat(getComputedStyle(grille).paddingLeft) || 0;
      centres = visibles.map(function (p) { return aGauche ? p.offsetLeft : p.offsetLeft + p.offsetWidth / 2; });
    }
    // Point de lecture de la piste : son bord gauche (cartes calées à gauche) ou son centre
    function repere() { return aGauche ? grille.scrollLeft + marge : grille.scrollLeft + grille.clientWidth / 2; }
    function plusProche(x) {
      let k = 0;
      for (let i = 1; i < centres.length; i++) if (Math.abs(centres[i] - x) < Math.abs(centres[k] - x)) k = i;
      return k;
    }
    function gauchePour(i) { return aGauche ? centres[i] - marge : centres[i] - grille.clientWidth / 2; }

    function majEtat(i, force) {
      if (i === index && !force) return;
      index = i;
      visibles.forEach(function (p, k) { p.classList.toggle('est-active', k === i); });
      texteRang.textContent = String(i + 1);
      texteTotal.textContent = String(visibles.length);
      texteNom.textContent = visibles[i] ? visibles[i].querySelector('h3').textContent : '';
    }

    // Va au projet i (en boucle avec les flèches)
    function aller(i, immediat) {
      const n = visibles.length;
      if (!n) return;
      i = ((i % n) + n) % n;
      if (!centres.length) mesurer();
      grille.scrollTo({ left: gauchePour(i), behavior: immediat || mouvementReduit ? 'auto' : 'smooth' });
      majEtat(i);
    }

    // Défilement (doigt, pavé tactile, molette horizontale) : une lecture par image au plus
    let lecture = false;
    grille.addEventListener('scroll', function () {
      if (lecture || glisse) return;
      lecture = true;
      requestAnimationFrame(function () {
        lecture = false;
        majEtat(plusProche(repere()));
      });
    }, { passive: true });

    fleches.forEach(function (b) {
      b.addEventListener('click', function () { aller(index + Number(b.dataset.sens)); });
    });
    grille.addEventListener('keydown', function (e) {
      const touches = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: visibles.length - 1 };
      // Début / Fin seulement sur la piste elle-même (pas dans un lien d'une carte)
      if (!(e.key in touches) || (e.key === 'Home' || e.key === 'End') && e.target !== grille) return;
      e.preventDefault();
      aller(touches[e.key]);
    });
    // Tabulation : la carte qui reçoit le focus vient au centre
    grille.addEventListener('focusin', function (e) {
      const p = e.target.closest('.projet');
      const i = p ? visibles.indexOf(p) : -1;
      if (i >= 0 && i !== index) aller(i);
    });

    // Souris : glisser la piste, puis élan et calage sur la carte la plus proche
    let glisse = null, dernierGlisse = 0;
    grille.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      glisse = { x: e.clientX, gauche: grille.scrollLeft, bouge: false, v: 0, t: performance.now(), dernierX: e.clientX };
    });
    window.addEventListener('pointermove', function (e) {
      if (!glisse) return;
      const dx = e.clientX - glisse.x;
      if (!glisse.bouge && Math.abs(dx) < 6) return;
      if (!glisse.bouge) { glisse.bouge = true; grille.classList.add('est-glisse'); }
      const t = performance.now();
      // Vitesse lissée (px/ms) pour l'élan au lâcher
      glisse.v = glisse.v * 0.7 + ((e.clientX - glisse.dernierX) / Math.max(1, t - glisse.t)) * 0.3;
      glisse.t = t;
      glisse.dernierX = e.clientX;
      grille.scrollLeft = glisse.gauche - dx;
    }, { passive: true });
    window.addEventListener('pointerup', function () {
      if (!glisse) return;
      const fini = glisse;
      glisse = null;
      if (!fini.bouge) return;
      dernierGlisse = performance.now();
      grille.classList.remove('est-glisse');
      // Élan : la piste continue dans le sens du geste, proportionnellement à sa vitesse
      const projete = repere() - fini.v * 260;
      aller(Math.max(0, Math.min(visibles.length - 1, plusProche(projete))));
    });
    // Après un glisser, pas de clic ; une carte de côté vient au centre au lieu d'ouvrir son lien
    grille.addEventListener('click', function (e) {
      if (performance.now() - dernierGlisse < 250) { e.preventDefault(); e.stopPropagation(); return; }
      const p = e.target.closest('.projet');
      const i = p ? visibles.indexOf(p) : -1;
      if (i >= 0 && i !== index) { e.preventDefault(); e.stopPropagation(); aller(i); }
    }, true);
    grille.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // Taille de l'écran ou des cartes (polices, images) : on remesure et on garde la carte courante
    const remesurer = function () { mesurer(); if (index >= 0) grille.scrollLeft = gauchePour(index); };
    if ('ResizeObserver' in window) new ResizeObserver(remesurer).observe(grille);
    else window.addEventListener('resize', remesurer);
    mesurer();
    majEtat(0, true);

    return {
      // Amène un projet au centre (liens « Projets à la une » du hero)
      montrer: function (p) {
        if (visibles.indexOf(p) < 0) {
          const tout = document.querySelector('.filtre[data-filtre="tout"]');
          if (tout) tout.click();
        }
        aller(visibles.indexOf(p), true);
      },
      filtrer: function (filtre) {
        visibles = projets.filter(function (p) { return filtre === 'tout' || p.dataset.categories.split(' ').indexOf(filtre) !== -1; });
        projets.forEach(function (p) {
          p.classList.toggle('est-filtre', visibles.indexOf(p) < 0);
          p.classList.remove('est-active');
        });
        mesurer();
        grille.scrollLeft = 0;
        majEtat(0, true);
        aller(0, true);
        Site.rafraichir();
      }
    };
  }


  /* ------------------------------------------------------------------
     6. Filtre des projets (cartes de la grille), avec animation "FLIP" :
        on mémorise la position des cartes, on filtre, puis on anime
        chaque carte de son ancienne position vers la nouvelle.
     ------------------------------------------------------------------ */
  function gererFiltre(carrousel) {
    const boutons = document.querySelectorAll('.filtre');
    const projets = Array.from(document.querySelectorAll('.projet'));
    if (!boutons.length) return;

    // Carrousel actif : le filtre reconstruit l'anneau avec les seuls projets retenus
    if (carrousel) {
      boutons.forEach(function (bouton) {
        bouton.addEventListener('click', function () {
          if (bouton.getAttribute('aria-pressed') === 'true') return;
          boutons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === bouton)); });
          carrousel.filtrer(bouton.dataset.filtre);
        });
      });
      return;
    }

    let enCours = false;

    function correspond(projet, filtre) {
      return filtre === 'tout' || projet.dataset.categories.split(' ').indexOf(filtre) !== -1;
    }

    function appliquer(filtre) {
      projets.forEach(function (p) {
        p.classList.toggle('est-filtre', !correspond(p, filtre));
        p.classList.add('est-visible');
      });
    }

    function filtrer(filtre) {
      // Version sans animation
      if (mouvementReduit || !Element.prototype.animate) {
        appliquer(filtre);
        return;
      }
      if (enCours) return;
      enCours = true;

      const sortants = projets.filter(function (p) { return !p.classList.contains('est-filtre') && !correspond(p, filtre); });

      // Étape 1 : les cartes qui partent rétrécissent et disparaissent
      const sorties = sortants.map(function (p) {
        return p.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.85)' }],
          { duration: 250, easing: 'ease-in', fill: 'forwards' }
        ).finished;
      });

      Promise.all(sorties).then(function () {
        // Étape 2 : on mémorise les positions avant le changement (First)
        const avant = new Map();
        projets.forEach(function (p) {
          if (!p.classList.contains('est-filtre')) avant.set(p, p.getBoundingClientRect());
        });

        // On applique le filtre (Last)
        projets.forEach(function (p) { p.getAnimations().forEach(function (a) { a.cancel(); }); });
        appliquer(filtre);

        // Étape 3 : on anime de l'ancienne position vers la nouvelle (Invert + Play)
        const animations = [];
        projets.forEach(function (p) {
          if (p.classList.contains('est-filtre')) return;
          const apres = p.getBoundingClientRect();
          const ancienne = avant.get(p);
          if (ancienne) {
            const dx = ancienne.left - apres.left;
            const dy = ancienne.top - apres.top;
            if (dx || dy) {
              animations.push(p.animate(
                [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
                { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
              ).finished);
            }
          } else {
            // Carte qui arrive : elle grandit en apparaissant
            animations.push(p.animate(
              [{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'none' }],
              { duration: 500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
            ).finished);
          }
        });
        return Promise.all(animations);
      }).then(function () {
        enCours = false;
        // La hauteur de la grille a changé : on recalcule les effets liés au scroll
        Site.rafraichir();
      });
    }

    boutons.forEach(function (bouton) {
      bouton.addEventListener('click', function () {
        if (enCours || bouton.getAttribute('aria-pressed') === 'true') return;
        boutons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === bouton)); });
        filtrer(bouton.dataset.filtre);
      });
    });
  }


  /* ------------------------------------------------------------------
     7. Inclinaison 3D des cartes projets selon la position de la souris
     ------------------------------------------------------------------ */
  function gererInclinaison() {
    if (!sourisFine || mouvementReduit) return;

    document.querySelectorAll('.projet__carte').forEach(function (carte) {
      carte.addEventListener('pointermove', function (e) {
        const zone = carte.getBoundingClientRect();
        const x = (e.clientX - zone.left) / zone.width;   // 0 → 1
        const y = (e.clientY - zone.top) / zone.height;   // 0 → 1
        carte.classList.add('est-incline');
        carte.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
        carte.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
        carte.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        carte.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      carte.addEventListener('pointerleave', function () {
        carte.classList.remove('est-incline');
        carte.style.setProperty('--rx', '0deg');
        carte.style.setProperty('--ry', '0deg');
      });
    });
  }


  /* ------------------------------------------------------------------
     8. Formulaire de contact : EmailJS + champ piège anti-spam
     ------------------------------------------------------------------ */
  function gererFormulaire() {
    const formulaire = document.getElementById('formulaire-contact');
    if (!formulaire) return;

    const statut = document.getElementById('statut-formulaire');
    const bouton = document.getElementById('bouton-envoi');
    const texteBouton = bouton.querySelector('.bouton__texte').innerHTML;

    // Identifiants EmailJS (clé publique : elle est faite pour être visible côté navigateur)
    const CLE_PUBLIQUE = 'JtUl0J90CJlNwDdIh';
    const SERVICE = 'service_fei2w6o';
    const MODELE = 'template_9ffu7qt';

    // EmailJS n'est chargé que si le visiteur utilise le formulaire (aucune requête vers un
    // service tiers sinon) ; l'empreinte SRI garantit que le fichier reçu n'a pas été modifié
    const URL_EMAILJS = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
    const SRI_EMAILJS = 'sha384-SALc35EccAf6RzGw4iNsyj7kTPr33K7RoGzYu+7heZhT8s0GZouafRiCg1qy44AS';
    let chargementEmailjs = null;
    function chargerEmailjs() {
      if (window.emailjs) return Promise.resolve(window.emailjs);
      if (!chargementEmailjs) {
        chargementEmailjs = new Promise(function (resoudre, rejeter) {
          const script = document.createElement('script');
          script.src = URL_EMAILJS;
          script.integrity = SRI_EMAILJS;
          script.crossOrigin = 'anonymous';
          script.onload = function () { window.emailjs ? resoudre(window.emailjs) : rejeter(); };
          script.onerror = function () { chargementEmailjs = null; script.remove(); rejeter(); };
          document.head.appendChild(script);
        });
      }
      return chargementEmailjs;
    }
    formulaire.addEventListener('focusin', function () { chargerEmailjs().catch(function () {}); }, { once: true });

    function afficherStatut(message, type) {
      statut.textContent = message;
      statut.className = 'formulaire__statut' + (type ? ' est-' + type : '');
    }

    function finir(message, type) {
      afficherStatut(message, type);
      bouton.disabled = false;
      bouton.querySelector('.bouton__texte').innerHTML = texteBouton;
    }

    formulaire.addEventListener('submit', function (e) {
      e.preventDefault();

      // Vérification des champs obligatoires
      if (!formulaire.checkValidity()) {
        const premierInvalide = formulaire.querySelector(':invalid');
        afficherStatut('Merci de remplir tous les champs avec une adresse e-mail valide.', 'erreur');
        if (premierInvalide) premierInvalide.focus();
        return;
      }

      // Champ piège rempli = robot : on fait semblant d'envoyer, sans rien envoyer
      if (formulaire.elements.site_web.value !== '') {
        formulaire.reset();
        afficherStatut('Message envoyé. Merci !', 'succes');
        return;
      }

      bouton.disabled = true;
      bouton.querySelector('.bouton__texte').textContent = 'Envoi…';
      afficherStatut('', '');

      chargerEmailjs().then(function (emailjs) {
        emailjs.init({ publicKey: CLE_PUBLIQUE });
        return emailjs.send(SERVICE, MODELE, {
          from_name: formulaire.elements.nom.value.trim(),
          from_email: formulaire.elements.email.value.trim(),
          subject: formulaire.elements.objet.value.trim(),
          message: formulaire.elements.message.value.trim()
        }).then(function () {
          formulaire.reset();
          finir('Message envoyé. Je vous réponds vite !', 'succes');
        }, function () {
          finir("L'envoi a échoué. Réessayez ou écrivez-moi à y.poulain04@gmail.com.", 'erreur');
        });
      }, function () {
        finir("Le service d'envoi est indisponible. Écrivez-moi directement à y.poulain04@gmail.com.", 'erreur');
      });
    });
  }


  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  // La machine à écrire attend la fin du préchargeur
  document.addEventListener('site:pret', lancerTyping, { once: true });
  if (document.body.classList.contains('hero-pret')) lancerTyping();

  gererHero();
  gererPourquoi();
  gererCompteurs();
  gererBarres();
  const carrousel = gererCarrousel();
  gererFiltre(carrousel);
  // Liens « Projets à la une » du hero : la section Projets s'ouvre sur le bon projet
  document.querySelectorAll('[data-aller-projet]').forEach(function (lien) {
    lien.addEventListener('click', function () {
      const projet = document.querySelector('.projet.' + lien.dataset.allerProjet);
      if (carrousel && projet) carrousel.montrer(projet);
    });
  });
  gererInclinaison();
  gererFormulaire();
})();
