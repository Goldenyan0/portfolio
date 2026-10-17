/* ==========================================================================
   pieces-e39.js — les fiches individuelles des pièces de la maquette E39
   Une fiche = une seule pièce (ou une paire identique : disques avant, ailes…).
   - nom, description courte ; maVoiture : valeurs et interventions déjà
     documentées sur la page (chantiers, relevés) ; systeme : fiche « système »
     de la documentation qui l'explique plus en détail
   - pieces : identifiants des pièces de la maquette 3D (par défaut, celui de la fiche)
   - photo : photo réelle détourée, photos-pieces/<dossier de la catégorie>/<id>.png
     (calculée plus bas ; aucune pour les pièces de PHOTOS-MANQUANTES.txt)
   Les ouvrants (capot, coffre, portes) n'ont pas de fiche : ils s'ouvrent au clic.
   Utilisé par e39.js (index en accordéons, fenêtre des fiches) et moteur-3d.js.
   ========================================================================== */

window.PIECES_E39 = [
  {
    categorie: 'Moteur', dossier: 'moteur', fiches: {
      bloc: { nom: 'Bloc moteur', systeme: 'cycle', description: 'La pièce maîtresse du M54 : six cylindres en ligne dans un bloc en aluminium à chemises en fonte. Il porte le vilebrequin en bas, reçoit la culasse en haut, et ses galeries font circuler l\'huile et le liquide de refroidissement.' },
      pistons: { nom: 'Pistons et bielles', systeme: 'cycle', description: 'Six pistons en aluminium coulissent dans les cylindres (alésage 80 mm, course 72 mm). Chacun est relié au vilebrequin par une bielle : le va-et-vient devient une rotation.' },
      vilebrequin: { nom: 'Vilebrequin', systeme: 'cycle', description: 'Il transforme la poussée des pistons en rotation. Ses manetons sont décalés de 120° : une combustion tous les 120°, dans l\'ordre 1-5-3-6-2-4.', maVoiture: ['Ralenti : 749 tr/min (V519, 08/10/2026) et 752 tr/min (V519, relevé non daté).'] },
      culasse: { nom: 'Culasse', systeme: 'distribution', description: 'Elle ferme le haut des cylindres : chambres de combustion, 24 soupapes (4 par cylindre), deux arbres à cames et puits de bougies.' },
      soupapes: { nom: 'Soupapes', systeme: 'distribution', description: 'Deux soupapes d\'admission et deux d\'échappement par cylindre. Poussées par les cames, rappelées par leurs ressorts, elles s\'ouvrent et se ferment à chaque cycle.' },
      aac: { nom: 'Arbres à cames', systeme: 'distribution', description: 'Deux arbres en tête (admission et échappement) entraînés par la chaîne de distribution. Ils tournent deux fois moins vite que le vilebrequin et commandent les soupapes.' },
      vanos: { nom: 'Double VANOS', systeme: 'vanos', description: 'À l\'avant de la culasse, il décale chaque arbre à cames de quelques degrés grâce à la pression d\'huile : plus de couple en bas, plus de puissance en haut.', maVoiture: ['INPA, échappement : réel −105,38° pour une consigne de −105,00°.', 'Log du 08/10/2026 : la position réelle suit la consigne des deux côtés.'] },
      cache: { nom: 'Cache-culbuteurs', systeme: 'distribution', description: 'Le couvercle qui ferme le haut de la culasse et retient l\'huile projetée sur les arbres à cames ; il porte la goulotte de remplissage d\'huile.' },
      cacheBobines: { nom: 'Cache-bobines', systeme: 'allumage', description: 'Le capot plastique nervuré qui coiffe et protège les six bobines crayon.' },
      cacheMoteur: { nom: 'Cache moteur BMW', systeme: 'allumage', description: 'Le cache plastique du dessus du moteur, avec ses inserts argent nervurés et le lettrage BMW, prolongé par le cache à alvéoles du collecteur d\'admission. On le retire pour accéder aux bobines ; sur la maquette, un clic le retire ou le repose.' },
      poulies: { nom: 'Courroie et poulies d\'accessoires', systeme: 'refroidissement', description: 'Une seule courroie, entraînée par la poulie du vilebrequin, fait tourner la pompe à eau et le ventilateur, l\'alternateur et la pompe de direction assistée ; un galet tendeur la garde tendue.' }
    }
  },
  {
    categorie: 'Allumage', dossier: 'allumage', fiches: {
      bougies: { nom: 'Bougies d\'allumage', systeme: 'allumage', description: 'Une bougie par cylindre, vissée au centre de la chambre de combustion : l\'étincelle entre ses électrodes enflamme le mélange.' },
      bobines: { nom: 'Bobines crayon', systeme: 'allumage', description: 'Une bobine posée sur chaque bougie : elle transforme le 12 V en plusieurs dizaines de milliers de volts, à l\'instant décidé par le calculateur.', maVoiture: ['Avance au ralenti : 2° (SPARKADV, V519, relevé non daté, 752 tr/min).'] }
    }
  },
  {
    categorie: 'Admission', dossier: 'admission', fiches: {
      boiteAir: { nom: 'Boîte à air (filtre à air)', systeme: 'admission', description: 'Le grand boîtier noir du coin avant gauche : l\'air y entre par l\'avant et traverse le filtre avant de repartir vers le débitmètre.' },
      debitmetre: { nom: 'Débitmètre d\'air (MAF)', systeme: 'admission', description: 'Monté à la sortie de la boîte à air, il mesure la masse d\'air aspirée grâce à un film chauffé ; le calculateur en déduit la quantité d\'essence à injecter.', maVoiture: ['Ancien : Siemens 5WK9 605 (2001) — 121 g/s mesurés en pleine charge contre 129 à 140 g/s attendus (08/10/2026).', 'Remplacé le 13/10/2026 par un Pierburg 7.07759.09.0.'] },
      manchon: { nom: 'Manchon d\'admission', systeme: 'admission', description: 'Le soufflet en caoutchouc entre le débitmètre et le papillon. Une fissure y laisse entrer de l\'air non mesuré : le mélange devient pauvre.', maVoiture: ['Test fumée du 14/10/2026 : la fuite était au manchon d\'admission — manchon et raccord en F remplacés.'] },
      papillon: { nom: 'Papillon motorisé (MDK)', systeme: 'mdk', description: 'À l\'entrée du collecteur, un volet entraîné par un moteur électrique dose l\'air : la pédale d\'accélérateur n\'a pas de câble, elle informe le calculateur.' },
      collecteurAdm: { nom: 'Collecteur d\'admission', systeme: 'admission', description: 'En plastique, il répartit l\'air du papillon vers les six cylindres par des pipes longues et courbes, qui partent d\'un plénum le long du moteur.' },
      disa: { nom: 'Vanne DISA', systeme: 'disa', description: 'Centrée sur le collecteur, elle commande un volet qui change la longueur du chemin de l\'air : chemin long pour le couple à bas régime, chemin court pour la puissance vers 4 000 tr/min.', maVoiture: ['Joint légèrement aplati (contrôle visuel et test de dépression) : remplacé le 13/10/2026.'] }
    }
  },
  {
    categorie: 'Carburant', dossier: 'carburant', fiches: {
      reservoir: { nom: 'Réservoir de carburant', systeme: 'carburant', description: 'Un réservoir en selle de 70 L sous la banquette arrière : il enjambe l\'arbre de transmission et contient la pompe immergée.' },
      pompeEssence: { nom: 'Pompe à essence', systeme: 'carburant', description: 'Pompe électrique immergée dans le réservoir : elle envoie l\'essence sous pression vers le filtre et la rampe.', maVoiture: ['Pompe d\'origine fatiguée : pression de rampe trop basse au kit manomètre.', 'Remplacée le 03/10/2026 par une AEM 340 L/h (réf. 50-1220), compatible E85.'] },
      filtreEssence: { nom: 'Filtre à essence et régulateur', systeme: 'carburant', description: 'Sous le plancher : il retient les impuretés, et son régulateur intégré maintient 3,5 bar dans la rampe en renvoyant le surplus au réservoir.' },
      duriteEssence: { nom: 'Conduites de carburant', systeme: 'carburant', description: 'Départ de la pompe vers le filtre puis vers la rampe, et retour du régulateur vers le réservoir.' },
      rampe: { nom: 'Rampe d\'injection', systeme: 'carburant', description: 'Le tube qui distribue l\'essence sous pression aux six injecteurs, sur le côté admission de la culasse.' },
      injecteurs: { nom: 'Injecteurs', systeme: 'carburant', description: 'Six électrovannes qui pulvérisent l\'essence dans les conduits d\'admission ; le calculateur règle leur temps d\'ouverture.', maVoiture: ['Duty cycle maximal : 42 % à 4 646 tr/min (10,90 ms d\'ouverture), le 08/10/2026 — loin du seuil de 85 %.'] }
    }
  },
  {
    categorie: 'Échappement', dossier: 'echappement', fiches: {
      collecteurEch: { nom: 'Collecteurs d\'échappement', systeme: 'echappement', description: 'Deux collecteurs « 3 en 1 » : cylindres 1 à 3 et 4 à 6. Ils récupèrent les gaz brûlés à la sortie de la culasse.' },
      sondes: { nom: 'Sondes lambda', systeme: 'lambda', description: 'Quatre sondes : deux avant les catalyseurs pour régler le mélange, deux après pour surveiller les catalyseurs.', maVoiture: ['Log du 08/10/2026 : les sondes aval oscillent presque autant que les sondes amont (écart-type ~0,32 V contre ~0,35 V).'] },
      ligneEch: { nom: 'Ligne d\'échappement', systeme: 'echappement', description: 'Deux catalyseurs, un silencieux central et un silencieux arrière transversal ; une seule sortie, à gauche, sous le bouclier.' },
      pompeAir: { nom: 'Pompe à air secondaire', systeme: 'airsecondaire', description: 'À froid, elle souffle de l\'air frais dans l\'échappement pendant les premières minutes pour brûler les imbrûlés et chauffer plus vite les catalyseurs.' }
    }
  },
  {
    categorie: 'Refroidissement', dossier: 'refroidissement', fiches: {
      radiateur: { nom: 'Radiateur', systeme: 'refroidissement', description: 'À l\'avant, derrière la calandre : le liquide chaud circule dans un faisceau d\'ailettes refroidi par l\'air de la route et le ventilateur.', maVoiture: ['Fuite colmatée à l\'époxy le 6 octobre en attendant les pièces.', 'Remplacé par un Nissens 60648A (kit monté le 18/10/2026).'] },
      vase: { nom: 'Vase d\'expansion', systeme: 'refroidissement', description: 'Accolé au radiateur, il absorbe la dilatation du liquide ; son bouchon taré maintient le circuit sous pression.', maVoiture: ['02/10/2026 : liquide qui sort par un bouchon 1,4 bar neuf — surpression réelle.'] },
      pompeEau: { nom: 'Pompe à eau', systeme: 'refroidissement', description: 'Entraînée par la courroie, sa turbine fait circuler le liquide dans le bloc, la culasse et le radiateur.', maVoiture: ['Remplacée par une Meyle 313 011 2001 (kit monté le 18/10/2026).'] },
      thermostat: { nom: 'Thermostat piloté', systeme: 'thermostat', description: 'Il garde le moteur en petit circuit tant qu\'il est froid ; une résistance commandée par le calculateur peut l\'ouvrir plus tôt.', maVoiture: ['Mahle TM 13 97 neuf, monté le 18/10/2026.'] },
      ventilateur: { nom: 'Ventilateur et visco-coupleur', systeme: 'refroidissement', description: 'Monté sur la poulie de la pompe à eau, il aspire l\'air à travers le radiateur ; le visco-coupleur l\'entraîne davantage quand l\'air qui le traverse est chaud.' },
      durites: { nom: 'Durites de refroidissement', systeme: 'refroidissement', description: 'La durite supérieure amène le liquide chaud au radiateur, l\'inférieure renvoie le liquide refroidi vers le thermostat et la pompe.', maVoiture: ['Liquide : 83 à 98 °C sur le roulage du 08/10/2026 ; 90 °C au V519.'] }
    }
  },
  {
    categorie: 'Lubrification', dossier: 'lubrification', fiches: {
      carter: { nom: 'Carter d\'huile', systeme: 'lubrification', description: 'Sous le moteur, il contient la réserve d\'huile ; on le vidange par son bouchon.', maVoiture: ['Vidange effectuée à 164 292 km.', 'Huile (valeur modélisée par le calculateur) : 99 à 102 °C sur le roulage du 08/10/2026.'] },
      pompeHuile: { nom: 'Pompe à huile', systeme: 'lubrification', description: 'Entraînée par le vilebrequin, elle aspire l\'huile du carter à travers la crépine et la pousse vers le filtre puis dans les galeries du moteur.' },
      filtreHuile: { nom: 'Boîtier de filtre à huile', systeme: 'lubrification', description: 'À l\'avant du moteur, côté admission : la cartouche filtrante se change par le dessus, en dévissant le couvercle à six pans.' },
      jauge: { nom: 'Jauge à huile', systeme: 'lubrification', description: 'La tige qui plonge dans le carter pour lire le niveau d\'huile, avec sa poignée rouge, côté admission.' },
      ccv: { nom: 'Reniflard (CCV)', systeme: 'ccv', description: 'Il aspire les gaz passés sous les pistons, en sépare l\'huile pour la renvoyer au carter et réinjecte les gaz dans l\'admission.' }
    }
  },
  {
    categorie: 'Électricité et gestion', dossier: 'electricite', fiches: {
      dme: { nom: 'Calculateur moteur (MS43)', systeme: 'gestion', description: 'Le calculateur Siemens MS43 lit les capteurs et commande injecteurs, bobines, VANOS et papillon. Il est logé dans un boîtier à l\'arrière droit du compartiment.', maVoiture: ['Log complet MS430DS0 d\'environ 110 points le 08/10/2026 ; lectures INPA par câble K+DCAN.'] },
      alternateur: { nom: 'Alternateur', systeme: 'alternateur', description: 'Entraîné par la courroie, il produit le courant quand le moteur tourne : il recharge la batterie et alimente la voiture.' },
      demarreur: { nom: 'Démarreur', systeme: 'demarreur', description: 'Un moteur électrique dont le pignon engrène sur la couronne du volant moteur pour lancer le moteur.' },
      batterie: { nom: 'Batterie', systeme: 'alternateur', description: 'Logée à droite du coffre, sous le plancher : sur la E39, elle n\'est pas sous le capot. Elle alimente le démarreur et la voiture moteur coupé ; l\'alternateur la recharge.', maVoiture: ['Varta Dynamic SLI E11 : 12 V, 74 Ah, 680 A (EN), référence 574 012 068.'] }
    }
  },
  {
    categorie: 'Transmission', dossier: 'transmission', fiches: {
      volant: { nom: 'Volant moteur', systeme: 'transmission', description: 'Le disque lourd vissé au bout du vilebrequin : il régularise la rotation, porte la couronne du démarreur et sert d\'appui à l\'embrayage.' },
      embrayage: { nom: 'Embrayage', systeme: 'transmission', description: 'Un disque à garnitures pincé entre le volant moteur et le mécanisme à diaphragme ; en appuyant sur la pédale, on le libère pour changer de rapport.' },
      boite: { nom: 'Boîte de vitesses manuelle', systeme: 'transmission', description: 'Cinq rapports commandés par le levier : elle adapte le régime du moteur à la vitesse de la voiture.' },
      arbre: { nom: 'Arbre de transmission', systeme: 'transmission', description: 'En deux tronçons avec un palier central, il transmet le mouvement de la boîte au pont arrière (propulsion).' },
      pont: { nom: 'Pont arrière (différentiel)', systeme: 'transmission', description: 'Il renvoie le mouvement vers les roues arrière et laisse chaque roue tourner à sa vitesse dans les virages.' },
      demiArbres: { nom: 'Demi-arbres', systeme: 'transmission', description: 'Les deux arbres à cardans qui relient le différentiel aux roues arrière motrices.' }
    }
  },
  {
    categorie: 'Freinage', dossier: 'freinage', fiches: {
      disqueAv: { nom: 'Disques de frein avant', systeme: 'freinage', pieces: ['disqueAvG', 'disqueAvD'], description: 'Deux disques ventilés : deux pistes reliées par des ailettes, pour mieux évacuer la chaleur.' },
      disqueAr: { nom: 'Disques de frein arrière', systeme: 'freinage', pieces: ['disqueArG', 'disqueArD'], description: 'Deux disques pleins, plus fins qu\'à l\'avant : l\'essentiel du freinage se fait sur les roues avant.' },
      etrierAv: { nom: 'Étriers de frein avant', systeme: 'freinage', pieces: ['etrierAvG', 'etrierAvD'], description: 'À chaque freinage, le piston de l\'étrier serre les deux plaquettes contre le disque.' },
      etrierAr: { nom: 'Étriers de frein arrière', systeme: 'freinage', pieces: ['etrierArG', 'etrierArD'], description: 'Même principe qu\'à l\'avant, sur les disques arrière.' },
      maitreCylindre: { nom: 'Maître-cylindre et bocal', systeme: 'freinage', description: 'Poussé par la pédale avec l\'aide du servofrein, il met le liquide de frein sous pression ; le bocal translucide garde la réserve de liquide.' },
      servoFrein: { nom: 'Servofrein', systeme: 'freinage', description: 'Le gros tambour noir sur le tablier : la dépression du moteur multiplie l\'effort du pied sur la pédale.' },
      blocAbs: { nom: 'Bloc ABS', systeme: 'freinage', description: 'Bloc hydraulique et son calculateur, à l\'avant droit du compartiment. Quand une roue va se bloquer, il module la pression de son frein plusieurs fois par seconde.' },
      conduitesFrein: { nom: 'Conduites de frein', systeme: 'freinage', description: 'Des tubes rigides relient le maître-cylindre au bloc ABS, puis le bloc à chaque roue ; des flexibles prennent le relais près des étriers.' }
    }
  },
  {
    categorie: 'Pédalier', dossier: 'pedalier', fiches: {
      pedaleEmbrayage: { nom: 'Pédale d\'embrayage', description: 'À gauche : elle actionne l\'émetteur d\'embrayage, qui commande hydrauliquement le récepteur monté sur la boîte.' },
      pedaleFrein: { nom: 'Pédale de frein', systeme: 'freinage', description: 'Au centre : elle pousse la tige du servofrein et du maître-cylindre.' },
      pedaleAccelerateur: { nom: 'Pédale d\'accélérateur', systeme: 'mdk', description: 'À droite : sans câble, elle transmet sa position au calculateur, qui ouvre le papillon motorisé.' }
    }
  },
  {
    categorie: 'Direction', dossier: 'direction', fiches: {
      boitierDirection: { nom: 'Boîtier de direction et biellettes', systeme: 'direction', description: 'Le boîtier transforme la rotation de la colonne en mouvement de la timonerie et des biellettes, qui orientent les roues avant ; l\'huile sous pression réduit l\'effort.' },
      colonneDirection: { nom: 'Colonne de direction', systeme: 'direction', description: 'L\'arbre articulé par des cardans qui relie le volant, à gauche, au boîtier de direction.' },
      pompeDA: { nom: 'Pompe de direction assistée', systeme: 'direction', description: 'Entraînée par la courroie, elle met l\'huile de direction sous pression.' },
      bocalDA: { nom: 'Bocal de direction assistée', systeme: 'direction', description: 'La réserve d\'huile de direction, au bouchon nervuré, à côté du boîtier de filtre à huile.' }
    }
  },
  {
    categorie: 'Suspension et roues', dossier: 'suspension-roues', fiches: {
      berceauAv: { nom: 'Berceau avant', systeme: 'suspension', description: 'La traverse sous le moteur : elle porte les supports moteur et les articulations des bras avant.' },
      brasAv: { nom: 'Bras de suspension avant', systeme: 'suspension', description: 'Deux bras par côté guident le bas du pivot de roue ; leurs silentblocs filtrent les vibrations.' },
      jambesAv: { nom: 'Jambes de force avant', systeme: 'suspension', description: 'Suspension McPherson : chaque jambe réunit l\'amortisseur, le ressort et la coupelle fixée en haut de la tourelle.' },
      berceauAr: { nom: 'Berceau arrière', systeme: 'suspension', description: 'Le cadre qui porte le pont et l\'essieu multibras arrière, fixé à la caisse par des silentblocs.' },
      brasAr: { nom: 'Bras de suspension arrière', systeme: 'suspension', description: 'Plusieurs bras par roue (essieu multibras) tiennent précisément les roues arrière motrices.' },
      ressortsAr: { nom: 'Ressorts arrière', systeme: 'suspension', description: 'Ils portent le poids de l\'arrière de la voiture et absorbent les bosses.' },
      amortisseursAr: { nom: 'Amortisseurs arrière', systeme: 'suspension', description: 'Ils freinent les oscillations des ressorts pour garder les roues au contact de la route.' },
      roue: { nom: 'Roues (jantes et pneus)', systeme: 'freinage', pieces: ['roueAvG', 'roueAvD', 'roueArG', 'roueArD'], description: 'Sur ma voiture : jantes 17 pouces à branches doubles et pneus 235/45 R17. Les roues arrière sont motrices, les roues avant directrices.' },
      roueSecours: { nom: 'Roue de secours', systeme: 'freinage', description: 'Rangée à plat sous le plancher du coffre, dans son logement.' }
    }
  },
  {
    categorie: 'Carrosserie et équipements', dossier: 'carrosserie', fiches: {
      faceAvant: { nom: 'Bouclier avant', systeme: 'carrosserie', description: 'Pare-chocs avec projecteurs à anneaux lumineux, antibrouillards et entrées d\'air. Sur la maquette, sa forme est celle du modèle 3D d\'origine (une M5).' },
      aileAv: { nom: 'Ailes avant', systeme: 'carrosserie', pieces: ['aileAvG', 'aileAvD'], description: 'Elles couvrent les roues avant et entourent les projecteurs ; le répétiteur de clignotant blanc est celui de la phase 2.' },
      custode: { nom: 'Ailes arrière (custodes)', systeme: 'carrosserie', pieces: ['custodeG', 'custodeD'], description: 'Soudées à la caisse, elles portent la partie extérieure des feux arrière et la trappe à carburant.' },
      toit: { nom: 'Pavillon', systeme: 'carrosserie', description: 'Le toit de la voiture, posé sur les montants.' },
      pareBrise: { nom: 'Pare-brise', systeme: 'carrosserie', description: 'Vitre feuilletée collée à la caisse ; les essuie-glaces balaient sa base.' },
      lunette: { nom: 'Lunette arrière', systeme: 'carrosserie', description: 'La vitre arrière, avec le troisième feu stop à sa base.' },
      feuxAr: { nom: 'Feux arrière', systeme: 'carrosserie', description: 'Feux de phase 2 : partie extérieure sur l\'aile, partie intérieure sur le couvercle de coffre.' },
      faceArriere: { nom: 'Bouclier arrière', systeme: 'carrosserie', description: 'Le pare-chocs arrière ; la sortie d\'échappement unique est à gauche, cachée dessous.' },
      baieMoteur: { nom: 'Baie moteur', systeme: 'carrosserie', description: 'Le compartiment moteur, peint couleur caisse : le tablier qui le sépare de l\'habitacle, les tourelles des jambes de force et les longerons.' },
      filtresHabitacle: { nom: 'Boîtiers de filtre d\'habitacle', systeme: 'carrosserie', description: 'Les deux grands boîtiers noirs devant le pare-brise : ils filtrent l\'air envoyé dans l\'habitacle.' },
      laveGlace: { nom: 'Réservoir de lave-glace', systeme: 'carrosserie', description: 'Le bidon blanc translucide à l\'avant droit, avec sa pompe.' },
      habitacle: { nom: 'Habitacle', systeme: 'carrosserie', description: 'Sièges, planche de bord, volant à gauche et console centrale. Il se visite depuis la place du conducteur dans l\'encyclopédie.' }
    }
  }
];

// Pièces sans photo fiable (voir PHOTOS-MANQUANTES.txt) : leur fiche n'affiche pas de photo
const SANS_PHOTO = ['custode', 'toit', 'lunette', 'roueSecours'];

// Pièce de la maquette → fiche (une fiche peut regrouper une paire de pièces identiques)
window.FICHE_DE_PIECE = {};
window.PIECES_E39.forEach(function (groupe) {
  Object.keys(groupe.fiches).forEach(function (id) {
    const fiche = groupe.fiches[id];
    fiche.categorie = groupe.categorie;
    fiche.pieces = fiche.pieces || [id];
    fiche.photo = SANS_PHOTO.includes(id) ? null : 'photos-pieces/' + groupe.dossier + '/' + id + (id === 'baieMoteur' ? '.jpg' : '.png');
    fiche.pieces.forEach(function (piece) { window.FICHE_DE_PIECE[piece] = id; });
  });
});
