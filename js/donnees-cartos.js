/* donnees-cartos.js — les 3 tables modifiées par le fichier flex v1 (MS43, logiciel 430037), origine et flex.
   Lues dans la copie de référence du 08/11/2026 et dans le fichier flex v1 avec la définition 430037 v1.15,
   puis recoupées avec la liste des modifications validée (écart nul). Valeurs stockées dans les tables :
   le facteur d'injection ×1,297 de la base s'y ajoute au moment de l'injection. */
window.CARTOS = {
  lancement: {
    titre: 'Injection de lancement', nom: 'ip_ti_cst__n__tco', unite: 'ms', decimales: 1,
    colonnes: { nom: 'Température d\'eau', unite: '°C', valeurs: [-30, -20.25, -9.75, 0, 9.75, 30, 60, 90] },
    lignes: { nom: 'Régime', unite: 'tr/min', valeurs: [80, 320, 920] },
    origine: [
      [109.189, 102.107, 82.256, 61.216, 44.651, 27.029, 16.144, 11.024],
      [82.4, 76.213, 58.853, 42.251, 31.413, 18.992, 12.4, 8.427],
      [53.403, 49.621, 38.949, 28.069, 21.365, 12.971, 8.581, 6.891]
    ],
    flex: [
      [118.715, 111.013, 89.429, 66.555, 42.005, 24.176, 14.443, 9.861],
      [89.589, 82.859, 63.989, 45.936, 29.552, 16.987, 11.093, 7.536],
      [58.059, 53.952, 42.347, 30.517, 20.101, 11.6, 7.675, 6.165]
    ]
  },
  preinjection: {
    titre: 'Pré-injection au démarrage', nom: 'ip_tipr_cst__tco', unite: 'ms', decimales: 1,
    colonnes: { nom: 'Température d\'eau', unite: '°C', valeurs: [-30, -20.25, -9.75, 0, 9.75, 30, 60, 90] },
    lignes: { nom: '', unite: '', valeurs: [''] },
    origine: [[175.984, 138.96, 98.901, 66.789, 47.227, 28.608, 18.267, 12.293]],
    flex: [[176.411, 166.08, 120.491, 81.371, 51.344, 25.589, 16.059, 10.805]]
  },
  adaptation: {
    titre: 'Prise en compte de la MUL à froid', nom: 'ip_ti_ad_fac_fac__tco__ti_ad_fac', unite: '', decimales: 3,
    // L'axe des colonnes change lui aussi : son premier point passe de -12 % à -30 %
    colonnes: { nom: 'MUL', unite: '%', valeurs: [-12, -4, 0, 6, 15], valeursFlex: [-30, -4, 0, 6, 15] },
    lignes: { nom: 'Température d\'eau', unite: '°C', valeurs: [-30, 17.25, 33, 51.75, 90] },
    origine: [
      [0.4023, 0.8008, 0.8008, 0.8008, 0.6016],
      [0.4531, 0.9023, 0.9531, 0.9531, 0.6719],
      [0.5, 0.9961, 0.9961, 0.9961, 0.7031],
      [0.6016, 0.9961, 0.9961, 0.9961, 0.8008],
      [0.9961, 0.9961, 0.9961, 0.9961, 0.9961]
    ],
    flex: [
      [0.9961, 0.8008, 0.8008, 0.8008, 0.6016],
      [0.9961, 0.9023, 0.9531, 0.9531, 0.6719],
      [0.9961, 0.9961, 0.9961, 0.9961, 0.7031],
      [0.9961, 0.9961, 0.9961, 0.9961, 0.8008],
      [0.9961, 0.9961, 0.9961, 0.9961, 0.9961]
    ]
  }
};
