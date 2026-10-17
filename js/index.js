/* ==========================================================================
   index.js — animations et interactions de la page d'accueil
   - Effet machine à écrire du hero
   - Hero en scrollytelling (le titre se réduit et s'efface, le fond 3D zoome)
   - "Pourquoi moi" épinglé : une comparaison par écran
     (sauf pendant le voyage 3D : le hero et "Pourquoi moi" sont alors des cartes fixes)
   - Compteurs, barres de compétences (les timelines sont dans commun.js)
   - Filtre de la grille des projets (animation fluide) + inclinaison 3D des cartes
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
          if (t < 1) requestAnimationFrame(etape);
        }
        requestAnimationFrame(etape);
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
     6 bis. Sélecteur immersif des projets : carrousel 3D qui tourne à 360°
        Les cartes sont posées en anneau ; l'anneau tourne pour amener la carte
        choisie devant. Flèches, glisser (souris ou doigt), clavier (← →) et clic
        sur une carte de côté. Le filtre reconstruit l'anneau avec les projets retenus.
        Sans JavaScript, la grille d'origine reste affichée.
     ------------------------------------------------------------------ */
  function gererCarrousel() {
    const grille = document.getElementById('grille-projets');
    const commandes = document.getElementById('carrousel-commandes');
    if (!grille || !commandes) return null;
    const projets = Array.from(grille.querySelectorAll('.projet'));
    if (projets.length < 2) return null;

    const anneau = document.createElement('div');
    anneau.className = 'carrousel__anneau';
    projets.forEach(function (p) { anneau.appendChild(p); });
    grille.appendChild(anneau);
    racine.classList.add('carrousel-actif');
    commandes.hidden = false;
    const aide = document.querySelector('.carrousel__aide');
    if (aide) aide.hidden = false;
    grille.setAttribute('tabindex', '0');
    grille.setAttribute('role', 'region');
    grille.setAttribute('aria-roledescription', 'carrousel');
    grille.setAttribute('aria-label', 'Projets : flèches gauche et droite pour changer de projet');

    const texteRang = commandes.querySelector('[data-rang]');
    const texteTotal = commandes.querySelector('[data-total]');
    const texteNom = commandes.querySelector('[data-nom]');
    let visibles = projets.slice();
    let index = 0, angle = 0, pas = 360 / projets.length;

    // Rayon de l'anneau : assez grand pour que les cartes ne se chevauchent pas
    function mesurer() {
      const largeur = projets[0].offsetWidth || 320;
      pas = 360 / Math.max(1, visibles.length);
      const rayon = visibles.length < 2 ? 0 : Math.round(largeur / 2 / Math.tan(Math.PI / Math.max(3, visibles.length)) + 36);
      grille.style.setProperty('--rayon-anneau', rayon + 'px');
      // Hauteur : celle de la plus haute carte retenue (la carte de devant ne déborde jamais)
      const haute = Math.max.apply(null, visibles.map(function (p) { return p.offsetHeight; }).concat([300]));
      grille.style.height = (haute + 28) + 'px';
    }
    function placer() {
      projets.forEach(function (p) {
        const i = visibles.indexOf(p);
        p.classList.toggle('est-filtre', i < 0);
        if (i >= 0) p.style.setProperty('--a', (i * pas).toFixed(2) + 'deg');
      });
      anneau.style.setProperty('--angle', angle.toFixed(2) + 'deg');
      majEtat();
    }
    function majEtat() {
      visibles.forEach(function (p, i) {
        const active = i === index;
        p.classList.toggle('est-active', active);
        p.setAttribute('aria-hidden', String(!active));
        p.querySelectorAll('a, button').forEach(function (l) { l.tabIndex = active ? 0 : -1; });
      });
      texteRang.textContent = String(index + 1);
      texteTotal.textContent = String(visibles.length);
      texteNom.textContent = visibles[index] ? visibles[index].querySelector('h3').textContent : '';
    }
    // Va au projet i (le chemin le plus court autour de l'anneau)
    function aller(i) {
      const n = visibles.length;
      if (!n) return;
      let d = i - index;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      angle -= d * pas;
      index = ((index + d) % n + n) % n;
      anneau.style.setProperty('--angle', angle.toFixed(2) + 'deg');
      majEtat();
    }

    commandes.querySelectorAll('[data-sens]').forEach(function (b) {
      b.addEventListener('click', function () { aller(index + Number(b.dataset.sens)); });
    });
    grille.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { aller(index + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { aller(index - 1); e.preventDefault(); }
    });

    // Glisser : l'anneau suit la souris ou le doigt, puis se cale sur la carte la plus proche
    let depart = null, dernierGlisse = 0;
    grille.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      depart = { x: e.clientX, angle: angle, glisse: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!depart) return;
      const dx = e.clientX - depart.x;
      if (!depart.glisse && Math.abs(dx) < 8) return;
      depart.glisse = true;
      anneau.classList.add('est-glisse');
      anneau.style.setProperty('--angle', (depart.angle + dx * 0.22).toFixed(2) + 'deg');
    });
    window.addEventListener('pointerup', function (e) {
      if (!depart) return;
      if (depart.glisse) {
        dernierGlisse = performance.now();
        anneau.classList.remove('est-glisse');
        const pasFaits = Math.round(-((e.clientX - depart.x) * 0.22) / pas);
        anneau.style.setProperty('--angle', angle.toFixed(2) + 'deg');
        aller(index + pasFaits);
      }
      depart = null;
    });
    // Clic : une carte de côté vient devant (au lieu d'ouvrir son lien) ; pas de clic après un glisser
    anneau.addEventListener('click', function (e) {
      const p = e.target.closest('.projet');
      if (!p) return;
      if (performance.now() - dernierGlisse < 300) { e.preventDefault(); e.stopPropagation(); return; }
      const i = visibles.indexOf(p);
      if (i >= 0 && i !== index) { e.preventDefault(); e.stopPropagation(); aller(i); }
    }, true);

    mesurer();
    placer();
    window.addEventListener('resize', function () { mesurer(); placer(); });
    // Les polices et les images changent la hauteur des cartes : on remesure
    if ('ResizeObserver' in window) {
      const obs = new ResizeObserver(function () { mesurer(); });
      projets.forEach(function (p) { obs.observe(p); });
    }

    return {
      filtrer: function (filtre) {
        visibles = projets.filter(function (p) { return filtre === 'tout' || p.dataset.categories.split(' ').indexOf(filtre) !== -1; });
        projets.forEach(function (p) { p.classList.toggle('est-filtre', visibles.indexOf(p) < 0); });
        index = 0;
        angle = 0;
        mesurer();
        placer();
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

      if (typeof window.emailjs === 'undefined') {
        afficherStatut("Le service d'envoi est indisponible. Écrivez-moi directement à y.poulain04@gmail.com.", 'erreur');
        return;
      }

      bouton.disabled = true;
      bouton.querySelector('.bouton__texte').textContent = 'Envoi…';
      afficherStatut('', '');

      window.emailjs.init({ publicKey: CLE_PUBLIQUE });
      window.emailjs.send(SERVICE, MODELE, {
        from_name: formulaire.elements.nom.value,
        from_email: formulaire.elements.email.value,
        subject: formulaire.elements.objet.value,
        message: formulaire.elements.message.value
      }).then(function () {
        formulaire.reset();
        finir('Message envoyé. Je vous réponds vite !', 'succes');
      }, function () {
        finir("L'envoi a échoué. Réessayez ou écrivez-moi à y.poulain04@gmail.com.", 'erreur');
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
  gererFiltre(gererCarrousel());
  gererInclinaison();
  gererFormulaire();
})();
