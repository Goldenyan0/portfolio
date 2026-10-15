/* ==========================================================================
   index.js — animations et interactions de la page d'accueil
   - Effet machine à écrire du hero
   - Hero en scrollytelling (le titre se réduit et s'efface, le fond 3D zoome)
   - "Pourquoi moi" épinglé : une comparaison par écran
   - Projets : défilement horizontal piloté par le scroll vertical
   - Compteurs, barres de compétences (les timelines sont dans commun.js)
   - Filtre des projets (animation fluide) + inclinaison 3D des cartes
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
    if (!scene || mouvementReduit) return;

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
    if (!scene || !racine.classList.contains('anime')) return;

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
     4. Projets : sur grand écran, la section est épinglée et la rangée
        de cartes défile horizontalement pendant qu'on scrolle verticalement.
     ------------------------------------------------------------------ */
  let reglerProjets = function () {};

  function gererProjetsHorizontaux() {
    const scene = document.getElementById('projets-scene');
    const piste = document.getElementById('grille-projets');
    const ecran = scene && scene.querySelector('.projets__ecran');
    const barre = scene && scene.querySelector('.projets__progression');
    if (!scene || !racine.classList.contains('anime')) return;

    let debordement = 0;

    // Calcule la hauteur de la scène = hauteur d'écran + longueur à faire défiler
    reglerProjets = function () {
      const actif = window.innerWidth >= 720;
      racine.classList.toggle('projets-horizontal', actif);
      if (!actif) { scene.style.removeProperty('--hauteur-scene'); return; }

      // Si les cartes ne tiennent pas en hauteur (petit écran), on revient à la grille
      if (ecran.scrollHeight > ecran.clientHeight + 2) {
        racine.classList.remove('projets-horizontal');
        scene.style.removeProperty('--hauteur-scene');
        return;
      }
      debordement = Math.max(0, piste.scrollWidth - window.innerWidth);
      scene.style.setProperty('--hauteur-scene', (window.innerHeight + debordement) + 'px');
      Site.rafraichir();
    };

    reglerProjets();
    window.addEventListener('resize', reglerProjets);
    if (document.fonts) document.fonts.ready.then(reglerProjets);

    const medias = piste.querySelectorAll('.projet__media img');

    Site.surScroll(function () {
      if (!racine.classList.contains('projets-horizontal')) return;
      const p = progressionScene(scene);
      piste.style.setProperty('--tx', (-p * debordement).toFixed(1) + 'px');
      barre.style.setProperty('--progression', p.toFixed(3));

      // Parallax des images : chacune glisse un peu à contre-sens de sa carte
      const milieu = window.innerWidth / 2;
      medias.forEach(function (img) {
        const zone = img.parentElement.getBoundingClientRect();
        if (zone.right < 0 || zone.left > window.innerWidth) return;
        const ecart = (zone.left + zone.width / 2 - milieu) / milieu; // -1 → 1
        img.style.setProperty('--ix', (-ecart * 28).toFixed(1) + 'px');
      });
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
     5. Compteurs : de 0 à la valeur cible, avec ralentissement à la fin
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
     6. Barres de compétences : se remplissent quand le bloc apparaît
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
     7. Filtre des projets, avec animation "FLIP" :
        on mémorise la position des cartes, on filtre, puis on anime
        chaque carte de son ancienne position vers la nouvelle.
     ------------------------------------------------------------------ */
  function gererFiltre() {
    const boutons = document.querySelectorAll('.filtre');
    const projets = Array.from(document.querySelectorAll('.projet'));
    if (!boutons.length) return;

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
        reglerProjets();
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
        // La rangée a changé de longueur : on recalcule le défilement horizontal
        reglerProjets();
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
     8. Inclinaison 3D des cartes projets selon la position de la souris
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
     9. Formulaire de contact : EmailJS + champ piège anti-spam
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
  gererProjetsHorizontaux();
  gererCompteurs();
  gererBarres();
  gererFiltre();
  gererInclinaison();
  gererFormulaire();
})();
