/* ==========================================================================
   index.js — animations et interactions de la page d'accueil
   - Effet machine à écrire du hero
   - Parallax du hero (formes décoratives + contenu)
   - Compteurs "chiffres clés"
   - Barres de compétences
   - Filtre des projets (animation fluide) + inclinaison 3D des cartes
   - Timelines qui se dessinent au scroll
   - Formulaire de contact (EmailJS + champ piège anti-spam)
   Dépend de commun.js (objet window.Site).
   ========================================================================== */

(function () {
  'use strict';

  const mouvementReduit = window.Site.mouvementReduit;
  const sourisFine = window.Site.sourisFine;


  /* ------------------------------------------------------------------
     1. Machine à écrire : tape, attend, efface, phrase suivante
     ------------------------------------------------------------------ */
  function lancerTyping() {
    const cible = document.getElementById('typing');
    if (!cible || mouvementReduit) return; // mouvement réduit : le texte reste fixe

    const phrases = [
      'Alternant informatique',
      'Étudiant BTS SIO',
      'Cybersécurité & réseaux',
      'Développeur web & Lua',
      'IA générative au quotidien'
    ];
    let indexPhrase = 0;
    let indexLettre = phrases[0].length; // la 1re phrase est déjà affichée dans le HTML
    let efface = true;

    function etape() {
      const phrase = phrases[indexPhrase];
      if (efface) {
        indexLettre--;
        cible.textContent = phrase.slice(0, indexLettre);
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
     2. Parallax du hero : les formes bougent à des vitesses différentes
        selon le scroll et la position de la souris
     ------------------------------------------------------------------ */
  function gererParallax() {
    if (mouvementReduit) return;
    const formes = document.querySelectorAll('.hero__formes [data-profondeur]');
    const contenu = document.getElementById('hero-contenu');
    const visuel = document.getElementById('hero-visuel');
    const indicateur = document.getElementById('indicateur-scroll');

    let sourisX = 0, sourisY = 0;
    let enAttente = false;

    function appliquer() {
      const y = window.scrollY;
      enAttente = false;
      if (indicateur) indicateur.classList.toggle('est-masque', y > 60);
      if (y > window.innerHeight * 1.2) return; // hero hors écran : inutile de calculer

      formes.forEach(function (forme) {
        const p = parseFloat(forme.dataset.profondeur);
        forme.style.transform =
          'translate3d(' + sourisX * p * 60 + 'px,' + (y * p + sourisY * p * 60) + 'px,0)';
      });
      if (contenu) {
        contenu.style.transform = 'translate3d(0,' + y * 0.18 + 'px,0)';
        contenu.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.9)));
      }
      if (visuel) visuel.style.transform = 'translate3d(0,' + y * 0.3 + 'px,0)';
    }

    function demander() {
      if (!enAttente) {
        enAttente = true;
        requestAnimationFrame(appliquer);
      }
    }

    window.addEventListener('scroll', demander, { passive: true });
    if (sourisFine) {
      window.addEventListener('pointermove', function (e) {
        // Position de la souris ramenée entre -0,5 et 0,5
        sourisX = e.clientX / window.innerWidth - 0.5;
        sourisY = e.clientY / window.innerHeight - 0.5;
        demander();
      }, { passive: true });
    }
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
     3. Compteurs : de 0 à la valeur cible, avec ralentissement à la fin
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
     4. Barres de compétences : se remplissent quand le bloc apparaît
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
     5. Filtre des projets, avec animation "FLIP" :
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

    function filtrer(filtre) {
      // Version sans animation
      if (mouvementReduit || !Element.prototype.animate) {
        projets.forEach(function (p) {
          p.classList.toggle('est-filtre', !correspond(p, filtre));
          p.classList.add('est-visible');
        });
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
        projets.forEach(function (p) {
          p.getAnimations().forEach(function (a) { a.cancel(); });
          p.classList.toggle('est-filtre', !correspond(p, filtre));
          p.classList.add('est-visible');
        });

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
      }).then(function () { enCours = false; });
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
     6. Inclinaison 3D des cartes projets selon la position de la souris
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
     7. Timelines : le trait violet se dessine de haut en bas avec le scroll
     ------------------------------------------------------------------ */
  function gererTimelines() {
    const timelines = document.querySelectorAll('[data-timeline]');
    if (!timelines.length) return;

    if (mouvementReduit) {
      timelines.forEach(function (t) { t.style.setProperty('--progression', '1'); });
      return;
    }

    let enAttente = false;
    function mettreAJour() {
      enAttente = false;
      const repere = window.innerHeight * 0.7; // le trait suit ce point de l'écran
      timelines.forEach(function (t) {
        const zone = t.getBoundingClientRect();
        const progression = Math.min(Math.max((repere - zone.top) / zone.height, 0), 1);
        t.style.setProperty('--progression', progression.toFixed(3));
      });
    }
    window.addEventListener('scroll', function () {
      if (!enAttente) {
        enAttente = true;
        requestAnimationFrame(mettreAJour);
      }
    }, { passive: true });
    window.addEventListener('resize', mettreAJour);
    mettreAJour();
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

  gererParallax();
  gererCompteurs();
  gererBarres();
  gererFiltre();
  gererInclinaison();
  gererTimelines();
  gererFormulaire();
})();
