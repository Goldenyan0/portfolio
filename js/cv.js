/* ==========================================================================
   cv.js — page CV
   - Boutons "Télécharger / Imprimer" : ouvrent la fenêtre d'impression
     (le navigateur propose "Enregistrer en PDF")
   - Avant l'impression, tout le contenu est révélé (les animations
     d'entrée ne doivent pas laisser de blocs masqués sur le papier)
   ========================================================================== */

(function () {
  'use strict';

  function toutReveler() {
    document.querySelectorAll('[data-revele], [data-mots]').forEach(function (el) {
      el.classList.add('est-visible');
    });
  }

  document.querySelectorAll('[data-imprimer]').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      toutReveler();
      window.print();
    });
  });

  // Impression lancée autrement (Ctrl+P, menu du navigateur)
  window.addEventListener('beforeprint', toutReveler);
})();
