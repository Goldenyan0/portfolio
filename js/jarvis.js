/* ==========================================================================
   jarvis.js — page "Jarvis, assistant vocal IA"
   - Captures de l'interface : un clic (ou Entrée / Espace) les ouvre en grand,
     fenêtre fermée par un clic, Échap ou le bouton (même visionneuse que e39.js)
   Dépend de commun.js (window.Site) pour mettre en pause le défilement fluide.
   ========================================================================== */

(function () {
  'use strict';

  const Site = window.Site || {};

  function gererAgrandissement() {
    const photos = Array.from(document.querySelectorAll('main img[data-grande]'));
    const dialogue = document.createElement('dialog');
    if (!photos.length || typeof dialogue.showModal !== 'function') return;
    dialogue.className = 'visionneuse';
    dialogue.innerHTML = '<button class="fiche-dialog__fermer" type="button" aria-label="Fermer"><svg class="icone" aria-hidden="true"><use href="#i-fermer"/></svg></button><img alt="" />';
    document.body.appendChild(dialogue);
    const grande = dialogue.querySelector('img');
    let declencheur = null;

    function ouvrir(img) {
      declencheur = img;
      grande.src = img.dataset.grande;   // capture en pleine taille
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

  gererAgrandissement();
})();
