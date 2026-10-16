/* ==========================================================================
   moteur-3d.js — le moteur M54B22 et sa transmission en 3D (maquette stylisée)
   - Moteur : bloc, pistons et bielles, vilebrequin, culasse, 24 soupapes,
     2 arbres à cames, double VANOS, bougies, bobines, rampe, injecteurs,
     collecteurs, DISA, papillon, pompe à eau (turbine visible), poulies...
   - Transmission (propulsion) : volant moteur, embrayage, boîte de vitesses,
     arbre de transmission, pont arrière, roues motrices
   - Échappement : collecteurs, catalyseurs, silencieux, sortie
   - Mécanique animée : pistons et bielles, cames et soupapes, turbine,
     poulies, volant, arbre et roues
   - Rotation automatique + glisser à la souris / au doigt (OrbitControls)
   - Bouton "VUE ÉCLATÉE" : les pièces se séparent, étiquettes en français,
     et la rotation automatique s'arrête pour pouvoir viser les pièces
   - Survol : nom de la pièce ; clic : ouverture de la fiche correspondante
   - Mini-maquette 3D dans chaque fiche ouverte (événement "fiche:ouverte")
   Librairie : Three.js (importée via l'importmap de e39.html).
   Mouvement réduit : pas de rotation automatique ni de mécanique animée,
   la vue éclatée s'ouvre sans transition.
   ========================================================================== */

// Three.js est importé dynamiquement (voir "Démarrage") : si le chargement échoue,
// on peut l'attraper et afficher la vraie cause au lieu d'une page muette.
let THREE, OrbitControls, RoomEnvironment, RoundedBoxGeometry;

const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cadre = document.getElementById('moteur3d');
const zoneScene = document.getElementById('moteur-scene');
const zoneEtiquettes = document.getElementById('moteur-etiquettes');
const zoneSurvol = document.getElementById('moteur-survol');
const boutonEclate = document.getElementById('bouton-eclate');

// Teste WebGL 2 puis WebGL 1, sans option restrictive (pas de failIfMajorPerformanceCaveat).
// Renvoie null si tout va bien, sinon la cause en clair.
function diagnosticWebgl() {
  try {
    const essai = document.createElement('canvas');
    const contexte = essai.getContext('webgl2') || essai.getContext('webgl') || essai.getContext('experimental-webgl');
    if (contexte) {
      // On libère tout de suite ce contexte de test
      const ext = contexte.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return null;
    }
    return window.WebGLRenderingContext
      ? 'WebGL absent : le navigateur le connaît mais refuse de créer un contexte (accélération matérielle désactivée ?)'
      : 'WebGL absent : ce navigateur ne le prend pas en charge';
  } catch (e) {
    return 'WebGL absent : ' + e.message;
  }
}

// Affiche la cause réelle dans le cadre de repli (et dans la console pour le débogage)
function afficherEchec(cause) {
  if (!cadre) return;
  cadre.classList.remove('est-pret');
  const repli = document.getElementById('moteur-repli');
  if (repli) {
    repli.innerHTML = '';
    const p1 = document.createElement('p');
    p1.textContent = 'La vue 3D ne peut pas s\'afficher.';
    const p2 = document.createElement('p');
    p2.className = 'moteur3d__cause';
    p2.textContent = 'Cause : ' + cause;
    const p3 = document.createElement('p');
    p3.textContent = 'Toutes les fiches restent accessibles juste en dessous.';
    repli.append(p1, p2, p3);
  }
  console.warn('[Moteur 3D] ' + cause);
}
window.afficherEchecMoteur = afficherEchec;


/* ==========================================================================
   1. Matériaux et outils de géométrie
   ========================================================================== */
// side: 2 = THREE.DoubleSide (Three.js n'est pas encore chargé ici) :
// sert aux carters ouverts, dont on voit aussi l'intérieur.
const MATERIAUX = {
  fonte: { color: 0x9aa0aa, metalness: 0.55, roughness: 0.45, transparent: true, opacity: 0.42, depthWrite: false },
  alu: { color: 0xcfd3da, metalness: 0.8, roughness: 0.3 },
  aluOuvert: { color: 0xcfd3da, metalness: 0.8, roughness: 0.3, side: 2 },
  carterVitre: { color: 0xb9bec8, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false, side: 2 },
  acier: { color: 0xe4e7ee, metalness: 0.95, roughness: 0.18 },
  chrome: { color: 0xf5f6f8, metalness: 1, roughness: 0.08 },
  noir: { color: 0x26262e, metalness: 0.15, roughness: 0.55 },
  plastique: { color: 0x34343e, metalness: 0.05, roughness: 0.7 },
  echappement: { color: 0x8f7d70, metalness: 0.75, roughness: 0.38 },
  caoutchouc: { color: 0x18181c, metalness: 0, roughness: 0.9 },
  pneu: { color: 0x202026, metalness: 0, roughness: 0.82 },
  friction: { color: 0x6b5a4c, metalness: 0.15, roughness: 0.85 },
  ceramique: { color: 0xf2efe8, metalness: 0.05, roughness: 0.35 },
  violet: { color: 0x7c3aed, metalness: 0.3, roughness: 0.35 },
  cuivre: { color: 0xc07a45, metalness: 0.9, roughness: 0.3 }
};

// Chaque maillage reçoit sa propre copie du matériau : on peut ainsi
// en éclairer un seul au survol sans toucher aux autres.
function materiau(nom) {
  return new THREE.MeshStandardMaterial(MATERIAUX[nom]);
}

function maillage(geometrie, nomMateriau) {
  const m = new THREE.Mesh(geometrie, materiau(nomMateriau));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Positionne un objet et le renvoie (la propriété position ne peut pas être remplacée)
function place(m, x, y, z) {
  m.position.set(x, y, z);
  return m;
}

// Petits raccourcis de géométrie
const boite = (l, h, p, r) => new RoundedBoxGeometry(l, h, p, 3, r || 0.08);
const cylindre = (r, h, seg) => new THREE.CylinderGeometry(r, r, h, seg || 32);
const cone = (rHaut, rBas, h, seg) => new THREE.CylinderGeometry(rHaut, rBas, h, seg || 32);
// Cylindre ouvert, avec une découpe (en radians) tournée vers +Z, le côté vu par la caméra
const coque = (rHaut, rBas, h, decoupe) => new THREE.CylinderGeometry(rHaut, rBas, h, 48, 1, true,
  decoupe / 2, Math.PI * 2 - decoupe);
// Couche l'axe d'une géométrie (Y par défaut) le long de X ou de Z
const axeX = (g) => g.rotateZ(Math.PI / 2);
const axeZ = (g) => g.rotateX(Math.PI / 2);
// Tores (anneaux) autour des axes X, Y ou Z
const toreZ = (R, r, arc) => new THREE.TorusGeometry(R, r, 10, 48, arc);
const toreX = (R, r, arc) => toreZ(R, r, arc).rotateY(Math.PI / 2);
const toreY = (R, r, arc) => toreZ(R, r, arc).rotateX(Math.PI / 2);

// Tuyau courbe passant par une liste de points [x, y, z]
function tuyau(points, r, nomMateriau, options) {
  const o = options || {};
  const courbe = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.ferme);
  const geo = new THREE.TubeGeometry(courbe, o.segments || Math.max(24, points.length * 10), r, o.cotes || 12, !!o.ferme);
  return maillage(geo, nomMateriau);
}

// Extrusion d'un profil 2D, recentrée, avec l'épaisseur portée par l'axe X
function extruder(forme, epaisseur) {
  const g = new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -epaisseur / 2);
  return g.rotateY(Math.PI / 2);
}

// Roue dentée (pignon, couronne de démarreur), axe le long de X
function denture(rayon, dents, hauteurDent, epaisseur, alesage) {
  const forme = new THREE.Shape();
  const pas = Math.PI * 2 / dents;
  for (let i = 0; i < dents; i++) {
    [[0, rayon], [0.2, rayon + hauteurDent], [0.5, rayon + hauteurDent], [0.7, rayon]].forEach(([f, r], k) => {
      const a = (i + f) * pas;
      if (i === 0 && k === 0) forme.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else forme.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    });
  }
  forme.closePath();
  if (alesage) {
    const trou = new THREE.Path();
    trou.absarc(0, 0, alesage, 0, Math.PI * 2, true);
    forme.holes.push(trou);
  }
  return extruder(forme, epaisseur);
}

// Came en forme d'œuf : cercle de base + bossage tourné vers +Y, axe le long de X
function lobeCame(base, levee, epaisseur) {
  const forme = new THREE.Shape();
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const r = base + levee * Math.pow(Math.max(0, Math.cos(a)), 3);
    if (i) forme.lineTo(Math.sin(a) * r, Math.cos(a) * r);
    else forme.moveTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  return extruder(forme, epaisseur);
}

// Secteur de disque tourné vers -Y (masse d'équilibrage du vilebrequin), axe le long de X
function secteur(r, ouverture, epaisseur) {
  const forme = new THREE.Shape();
  forme.moveTo(0, 0);
  forme.absarc(0, 0, r, -Math.PI / 2 - ouverture / 2, -Math.PI / 2 + ouverture / 2, false);
  forme.lineTo(0, 0);
  return extruder(forme, epaisseur);
}

// Ressort hélicoïdal le long de Y (de 0 à hauteur)
function ressort(rayon, hauteur, spires, r, nomMateriau) {
  const points = [];
  const n = spires * 12;
  for (let i = 0; i <= n; i++) {
    const a = i / 12 * Math.PI * 2;
    points.push([Math.cos(a) * rayon, i / n * hauteur, Math.sin(a) * rayon]);
  }
  return tuyau(points, r, nomMateriau, { segments: n * 2, cotes: 5 });
}

// Répète "action(angle, i)" n fois autour d'un cercle
function autour(n, action) {
  for (let i = 0; i < n; i++) action(i / n * Math.PI * 2, i);
}


/* ==========================================================================
   2. Construction des pièces
   Repère : le moteur s'étend le long de X (cylindre 1 à gauche, côté distribution),
   Y vers le haut, admission côté +Z, échappement côté -Z.
   La transmission part vers l'arrière (+X) jusqu'aux roues.
   Chaque pièce est un THREE.Group avec :
   - userData.nom : libellé français
   - userData.fiche : fiche ouverte au clic
   - userData.eclate : déplacement en vue éclatée
   ========================================================================== */
const ENTRAXE = 1.05;                                            // distance entre deux cylindres
const X_CYL = [0, 1, 2, 3, 4, 5].map(i => (i - 2.5) * ENTRAXE);  // position X des 6 cylindres
// Déphasage de chaque maneton : ordre d'allumage 1-5-3-6-2-4 (combustion tous les 120°)
const PHASES = [0, 240, 120, 120, 240, 0].map(d => d * Math.PI / 180);
// Angle vilebrequin (sur 720°) de la combustion de chaque cylindre, dans l'ordre 1-5-3-6-2-4
const COMBUSTION = [0, 480, 240, 600, 120, 360].map(d => d * Math.PI / 180);
const R_MANIV = 0.42;     // rayon de manivelle (demi-course)
const L_BIELLE = 1.55;    // entraxe de bielle
const Y_VILO = -1.0;      // hauteur de l'axe du vilebrequin
const LEVEE = 0.09;       // levée maxi des soupapes (= bossage des cames)
const X_PONT = 9.6;       // position du pont arrière
const Y_PONT = -1.65;     // axe des roues : les pneus touchent le sol
const Z_ROUE = 2.4;       // demi-voie
const RAPPORT_ARBRE = 0.7;   // vitesse de l'arbre de transmission / moteur (rapport engagé, illustratif)
const RAPPORT_ROUES = 0.2;   // vitesse des roues / moteur (après le pont, illustratif)

// Calage des cames : la soupape d'admission est grande ouverte 90° après le PMH
// de fin d'échappement, celle d'échappement 90° avant (en angle vilebrequin).
const calageAdmission = (i) => Math.PI - (COMBUSTION[i] + Math.PI * 2.5) / 2;
const calageEchappement = (i) => Math.PI - (COMBUSTION[i] + Math.PI * 1.5) / 2;

function piece(id, nom, fiche, eclate) {
  const g = new THREE.Group();
  g.name = id;
  g.userData = { piece: true, id: id, nom: nom, fiche: fiche, eclate: new THREE.Vector3(...eclate), base: new THREE.Vector3() };
  return g;
}

function construireMoteur() {
  const moteur = new THREE.Group();
  const pieces = {};
  const ajouter = (g) => { pieces[g.name] = g; moteur.add(g); return g; };
  // Références des pièces animées (gardées hors de userData, qui est copié lors des clonages)
  const meca = { equipages: [], cames: [], soupapes: [], tournants: [], roues: [] };


  /* ---------------- Bas moteur ---------------- */

  // --- Bloc moteur (semi-transparent : on voit les pistons travailler) ---
  const bloc = ajouter(piece('bloc', 'Bloc moteur', 'cycle', [0, 0, 0]));
  bloc.add(maillage(boite(6.9, 2.4, 2.3, 0.15), 'fonte'));
  // Fûts des six cylindres
  X_CYL.forEach((x) => {
    bloc.add(place(maillage(new THREE.CylinderGeometry(0.43, 0.43, 2.3, 32, 1, true), 'fonte'), x, 0.05, 0));
  });
  // Nervures de renfort au droit des 7 paliers, des deux côtés
  for (let k = 0; k < 7; k++) {
    [-1.17, 1.17].forEach((z) => bloc.add(place(maillage(boite(0.14, 2.0, 0.1, 0.03), 'fonte'), (k - 3) * ENTRAXE, -0.1, z)));
  }
  // Pattes de support moteur
  [-1, 1].forEach((s) => bloc.add(place(maillage(boite(0.7, 0.45, 0.3, 0.06), 'alu'), 0.3, -0.55, s * 1.3)));

  // --- Pistons et bielles (posés à chaque image selon l'angle du vilebrequin) ---
  const pistons = ajouter(piece('pistons', 'Pistons et bielles ×6', 'cycle', [0, 1.9, 0]));
  X_CYL.forEach((x, i) => {
    const ensemble = new THREE.Group();
    ensemble.position.x = x;
    // Piston : jupe, calotte, 3 segments, axe
    const piston = new THREE.Group();
    piston.add(maillage(cylindre(0.39, 0.4, 40), 'alu'));
    piston.add(place(maillage(cone(0.37, 0.4, 0.05, 40), 'alu'), 0, 0.225, 0));
    [0.17, 0.12, 0.07].forEach((y) => piston.add(place(maillage(toreY(0.392, 0.013), 'noir'), 0, y, 0)));
    piston.add(maillage(axeX(cylindre(0.07, 0.7, 16)), 'acier'));
    // Bielle : pied (sur l'axe du piston), corps en I, tête et vis du chapeau
    const bielle = new THREE.Group();
    bielle.add(maillage(axeX(cylindre(0.1, 0.16, 20)), 'acier'));
    bielle.add(place(maillage(boite(0.06, L_BIELLE - 0.3, 0.16, 0.02), 'acier'), 0, -L_BIELLE / 2, 0));
    [-0.08, 0.08].forEach((z) => bielle.add(place(maillage(boite(0.14, L_BIELLE - 0.3, 0.035, 0.012), 'acier'), 0, -L_BIELLE / 2, z)));
    bielle.add(place(maillage(axeX(cylindre(0.21, 0.16, 28)), 'acier'), 0, -L_BIELLE, 0));
    [-0.17, 0.17].forEach((z) => bielle.add(place(maillage(cylindre(0.035, 0.22, 10), 'acier'), 0, -L_BIELLE - 0.06, z)));
    ensemble.add(piston, bielle);
    pistons.add(ensemble);
    meca.equipages.push({ piston: piston, bielle: bielle, phase: PHASES[i] });
  });

  // --- Vilebrequin : tourillons, manetons, bras et masses d'équilibrage (tourne) ---
  const vilebrequin = ajouter(piece('vilebrequin', 'Vilebrequin', 'cycle', [0, -1.0, 0]));
  const arbre = new THREE.Group();
  arbre.position.y = Y_VILO;
  arbre.add(maillage(axeX(cylindre(0.12, 7.4, 20)), 'acier'));
  arbre.add(place(maillage(axeX(cylindre(0.1, 0.3, 16)), 'acier'), -3.82, 0, 0));      // nez (poulie)
  for (let k = 0; k < 7; k++) arbre.add(place(maillage(axeX(cylindre(0.17, 0.2, 28)), 'acier'), (k - 3) * ENTRAXE, 0, 0));
  X_CYL.forEach((x, i) => {
    const phi = PHASES[i];
    arbre.add(place(maillage(axeX(cylindre(0.14, 0.42, 24)), 'acier'), x, R_MANIV * Math.cos(phi), R_MANIV * Math.sin(phi)));
    [-0.26, 0.26].forEach((dx) => {
      const bras = maillage(boite(0.1, R_MANIV + 0.34, 0.34, 0.04), 'acier');
      bras.geometry.translate(0, R_MANIV / 2, 0);
      bras.position.x = x + dx;
      bras.rotation.x = phi;
      const masse = maillage(secteur(0.5, 2.3, 0.1), 'acier');
      masse.position.x = x + dx;
      masse.rotation.x = phi;
      arbre.add(bras, masse);
    });
  });
  arbre.add(place(maillage(axeX(cylindre(0.32, 0.12, 32)), 'acier'), 3.62, 0, 0));    // bride du volant moteur
  vilebrequin.add(arbre);
  meca.arbre = arbre;

  // --- Carter d'huile : bride, cuvette, ailettes, bouchon de vidange ---
  const carter = ajouter(piece('carter', "Carter d'huile", 'lubrification', [0, -1.6, 0]));
  carter.add(place(maillage(boite(6.8, 0.07, 2.25, 0.03), 'alu'), 0, -1.24, 0));
  carter.add(place(maillage(boite(6.6, 0.6, 2.0, 0.12), 'alu'), 0, -1.55, 0));
  carter.add(place(maillage(boite(3.2, 0.5, 1.6, 0.12), 'alu'), 1.4, -1.95, 0));
  for (let k = 0; k < 5; k++) carter.add(place(maillage(boite(3.0, 0.08, 0.05, 0.02), 'alu'), 1.4, -2.22, -0.6 + k * 0.3));
  carter.add(place(maillage(axeZ(cylindre(0.08, 0.08, 6)), 'acier'), 2.4, -2.0, -0.82));


  /* ---------------- Haut moteur ---------------- */

  // --- Culasse : joint, paliers d'arbres à cames, puits de bougies, bossages des conduits ---
  const culasse = ajouter(piece('culasse', 'Culasse', 'distribution', [0, 2.4, 0]));
  culasse.add(place(maillage(boite(6.9, 0.85, 2.3, 0.12), 'alu'), 0, 1.65, 0));
  culasse.add(place(maillage(boite(6.94, 0.04, 2.34, 0.01), 'noir'), 0, 1.22, 0));
  for (let k = 0; k < 7; k++) {
    [0.48, -0.48].forEach((z) => culasse.add(place(maillage(boite(0.16, 0.32, 0.36, 0.04), 'alu'), (k - 3) * ENTRAXE, 2.18, z)));
  }
  X_CYL.forEach((x) => {
    culasse.add(place(maillage(cylindre(0.13, 0.04, 20), 'noir'), x, 2.08, 0));
    culasse.add(place(maillage(boite(0.55, 0.36, 0.08, 0.03), 'alu'), x, 1.55, -1.17));
  });

  // --- Soupapes ×24 : tête, tige, ressort, coupelle et poussoir (s'ouvrent au passage des cames) ---
  const soupapes = ajouter(piece('soupapes', 'Soupapes ×24', 'distribution', [0, 3.5, 0]));
  X_CYL.forEach((x, i) => {
    [-0.18, 0.18].forEach((dx) => {
      [1, -1].forEach((cote) => {                 // 1 = admission (+Z), -1 = échappement
        const support = new THREE.Group();        // incliné vers son arbre à cames
        support.position.set(x + dx, 1.27, cote * 0.2);
        support.rotation.x = cote * 0.3;
        const mobile = new THREE.Group();         // partie qui coulisse le long de l'axe
        mobile.add(maillage(cone(0.035, 0.13, 0.07, 24), 'acier'));
        mobile.add(place(maillage(cylindre(0.025, 0.8, 10), 'acier'), 0, 0.42, 0));
        mobile.add(place(maillage(cylindre(0.08, 0.03, 16), 'acier'), 0, 0.72, 0));
        mobile.add(place(maillage(cylindre(0.1, 0.1, 20), 'alu'), 0, 0.89, 0));
        support.add(mobile);
        support.add(place(ressort(0.065, 0.3, 5, 0.012, 'violet'), 0, 0.4, 0));
        soupapes.add(support);
        meca.soupapes.push({ mobile: mobile, calage: cote > 0 ? calageAdmission(i) : calageEchappement(i) });
      });
    });
  });

  // --- Arbres à cames (admission et échappement, tournent) ---
  const aac = ajouter(piece('aac', 'Arbres à cames ×2', 'distribution', [0, 3.9, 0]));
  [0.48, -0.48].forEach((z, j) => {
    const came = new THREE.Group();
    came.position.set(0, 2.3, z);
    came.add(maillage(axeX(cylindre(0.08, 6.9, 16)), 'acier'));
    for (let k = 0; k < 7; k++) came.add(place(maillage(axeX(cylindre(0.15, 0.14, 24)), 'acier'), (k - 3) * ENTRAXE, 0, 0));
    X_CYL.forEach((x, i) => {
      const calage = j === 0 ? calageAdmission(i) : calageEchappement(i);
      [-0.18, 0.18].forEach((dx) => {
        const lobe = maillage(lobeCame(0.13, LEVEE, 0.12), 'acier');
        lobe.position.x = x + dx;
        lobe.rotation.x = calage;
        came.add(lobe);
      });
    });
    came.add(place(maillage(axeX(cylindre(0.12, 0.12, 6)), 'acier'), -3.2, 0, 0));    // six pans de calage
    aac.add(came);
    meca.cames.push(came);
  });

  // --- Double VANOS : boîtier, pignons dentés, électrovannes, couvercles des pistons ---
  const vanos = ajouter(piece('vanos', 'Double VANOS', 'vanos', [-1.2, 3.9, 0]));
  vanos.add(place(maillage(boite(0.5, 0.95, 1.9, 0.14), 'noir'), -3.8, 2.3, 0));
  [0.48, -0.48].forEach((z) => {
    vanos.add(place(maillage(denture(0.38, 26, 0.06, 0.12, 0.1), 'violet'), -3.47, 2.3, z));
    vanos.add(place(maillage(axeX(cylindre(0.2, 0.08, 28)), 'alu'), -4.08, 2.12, z));
    vanos.add(place(maillage(axeX(cylindre(0.1, 0.35, 20)), 'acier'), -4.2, 2.52, z * 0.85));
    vanos.add(place(maillage(boite(0.14, 0.16, 0.22, 0.03), 'plastique'), -4.42, 2.52, z * 0.85));
  });

  // --- Cache-culbuteurs : nervures, bouchon de remplissage d'huile, vis ---
  const cache = ajouter(piece('cache', 'Cache-culbuteurs', 'distribution', [0, 4.3, 0]));
  cache.add(place(maillage(boite(6.6, 0.45, 2.0, 0.18), 'noir'), 0, 2.9, 0));
  [-0.62, 0.62].forEach((z) => cache.add(place(maillage(boite(6.2, 0.08, 0.1, 0.03), 'noir'), 0, 3.15, z)));
  cache.add(place(maillage(cylindre(0.2, 0.12, 24), 'plastique'), -3.05, 3.18, 0));
  cache.add(place(maillage(boite(0.36, 0.08, 0.08, 0.03), 'plastique'), -3.05, 3.27, 0));
  for (let k = 0; k < 8; k++) {
    [-0.86, 0.86].forEach((z) => cache.add(place(maillage(cylindre(0.045, 0.06, 6), 'acier'), -2.9 + k * 0.83, 3.1, z)));
  }

  // --- Bougies ×6 : électrodes, culot fileté, six pans, isolant céramique, borne ---
  const bougies = ajouter(piece('bougies', 'Bougies ×6', 'allumage', [0, 6.4, 0]));
  X_CYL.forEach((x) => {
    const b = new THREE.Group();
    b.position.set(x, 1.24, 0);
    b.add(place(maillage(boite(0.05, 0.03, 0.04, 0.01), 'acier'), 0.02, -0.02, 0));
    b.add(maillage(cylindre(0.014, 0.05, 8), 'ceramique'));
    b.add(place(maillage(cylindre(0.06, 0.24, 16), 'acier'), 0, 0.14, 0));
    b.add(place(maillage(cylindre(0.1, 0.1, 6), 'acier'), 0, 0.32, 0));
    b.add(place(maillage(cone(0.045, 0.06, 0.4, 20), 'ceramique'), 0, 0.57, 0));
    [0.5, 0.58, 0.66].forEach((y) => b.add(place(maillage(toreY(0.052, 0.01), 'ceramique'), 0, y, 0)));
    b.add(place(maillage(cylindre(0.025, 0.1, 10), 'acier'), 0, 0.82, 0));
    bougies.add(b);
  });

  // --- Bobines crayon ×6 : capuchon caoutchouc, corps nervuré, tête, connecteur, faisceau ---
  const bobines = ajouter(piece('bobines', 'Bobines ×6', 'allumage', [0, 7.0, 0]));
  X_CYL.forEach((x) => {
    bobines.add(place(maillage(cylindre(0.07, 0.75, 16), 'caoutchouc'), x, 2.55, 0));
    bobines.add(place(maillage(cylindre(0.11, 0.55, 24), 'plastique'), x, 3.25, 0));
    [3.1, 3.25, 3.4].forEach((y) => bobines.add(place(maillage(toreY(0.112, 0.012), 'noir'), x, y, 0)));
    bobines.add(place(maillage(boite(0.32, 0.18, 0.46, 0.05), 'noir'), x, 3.6, 0));
    bobines.add(place(maillage(boite(0.18, 0.14, 0.14, 0.03), 'plastique'), x, 3.62, 0.28));
  });
  bobines.add(place(maillage(axeX(cylindre(0.05, 5.8, 12)), 'plastique'), 0, 3.66, 0.42));


  /* ---------------- Admission et carburant ---------------- */

  // --- Rampe d'injection : tube, pattes, coupelles, valve de test, arrivée d'essence ---
  const rampe = ajouter(piece('rampe', "Rampe d'injection", 'carburant', [0, 2.6, 1.6]));
  rampe.add(place(maillage(axeX(cylindre(0.09, 6.4, 20)), 'acier'), 0, 2.42, 1.06));
  [-2.1, 0, 2.1].forEach((x) => rampe.add(place(maillage(boite(0.14, 0.25, 0.08, 0.03), 'acier'), x + 0.52, 2.3, 0.98)));
  X_CYL.forEach((x) => rampe.add(place(maillage(cylindre(0.08, 0.1, 16), 'acier'), x, 2.33, 1.08)));
  rampe.add(place(maillage(cylindre(0.04, 0.14, 10), 'cuivre'), 2.9, 2.55, 1.06));
  rampe.add(tuyau([[3.2, 2.42, 1.06], [3.55, 2.3, 1.06], [3.75, 1.7, 1.1]], 0.05, 'caoutchouc'));

  // --- Injecteurs ×6 : nez, joints toriques, corps, connecteur, tête ---
  const injecteurs = ajouter(piece('injecteurs', 'Injecteurs ×6', 'carburant', [0, 1.7, 2.6]));
  X_CYL.forEach((x) => {
    const inj = new THREE.Group();
    inj.position.set(x, 1.82, 1.22);
    inj.rotation.x = -0.28;
    inj.add(maillage(cone(0.035, 0.02, 0.08, 12), 'acier'));
    inj.add(place(maillage(toreY(0.045, 0.014), 'caoutchouc'), 0, 0.06, 0));
    inj.add(place(maillage(cylindre(0.055, 0.28, 16), 'violet'), 0, 0.22, 0));
    inj.add(place(maillage(boite(0.16, 0.09, 0.1, 0.02), 'noir'), 0.09, 0.27, 0));
    inj.add(place(maillage(cylindre(0.045, 0.1, 16), 'acier'), 0, 0.41, 0));
    inj.add(place(maillage(toreY(0.048, 0.013), 'caoutchouc'), 0, 0.43, 0));
    injecteurs.add(inj);
  });

  // --- Collecteur d'admission : bride, 6 pipes courbes, plénum nervuré ---
  const collAdm = ajouter(piece('collecteurAdm', "Collecteur d'admission", 'admission', [0, 1.4, 2.3]));
  collAdm.add(place(maillage(boite(6.5, 0.44, 0.08, 0.03), 'plastique'), 0, 1.6, 1.22));
  X_CYL.forEach((x) => {
    collAdm.add(tuyau([[x, 1.6, 1.24], [x, 2.15, 1.9], [x, 1.7, 2.6], [x, 0.9, 2.75]], 0.2, 'plastique', { cotes: 16 }));
  });
  collAdm.add(place(maillage(boite(6.4, 0.9, 0.8, 0.25), 'plastique'), 0, 0.6, 2.85));
  for (let k = 0; k < 6; k++) collAdm.add(place(maillage(boite(0.06, 0.95, 0.84, 0.02), 'plastique'), X_CYL[k] + 0.52, 0.6, 2.85));

  // --- Volet DISA (sur le plénum) : bride, joint, corps, capsule, connecteur ---
  const disa = ajouter(piece('disa', 'Volet DISA', 'disa', [0.6, 2.2, 2.9]));
  disa.add(place(maillage(axeZ(cylindre(0.24, 0.06, 28)), 'alu'), 1.6, 0.6, 3.27));
  disa.add(place(maillage(toreZ(0.2, 0.025), 'caoutchouc'), 1.6, 0.6, 3.3));
  disa.add(place(maillage(axeZ(cylindre(0.18, 0.3, 28)), 'violet'), 1.6, 0.6, 3.45));
  disa.add(place(maillage(boite(0.42, 0.42, 0.28, 0.08), 'noir'), 1.6, 0.6, 3.74));
  disa.add(place(maillage(boite(0.16, 0.12, 0.12, 0.03), 'plastique'), 1.6, 0.86, 3.74));

  // --- Papillon motorisé (MDK, à l'avant du plénum) : corps ouvert, volet, moteur ---
  const papillon = ajouter(piece('papillon', 'Papillon motorisé', 'mdk', [-1.4, 1.4, 2.3]));
  papillon.add(place(maillage(axeX(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 40, 1, true)), 'aluOuvert'), -3.5, 0.6, 2.85));
  [-3.73, -3.27].forEach((x) => papillon.add(place(maillage(toreX(0.37, 0.035), 'alu'), x, 0.6, 2.85)));
  const volet = place(maillage(axeX(cylindre(0.33, 0.02, 40)), 'acier'), -3.5, 0.6, 2.85);
  volet.rotation.y = 0.6;                                                         // volet entrouvert
  papillon.add(volet);
  papillon.add(place(maillage(cylindre(0.025, 0.76, 10), 'acier'), -3.5, 0.6, 2.85));
  papillon.add(place(maillage(boite(0.38, 0.36, 0.55, 0.08), 'noir'), -3.5, 1.04, 2.85));
  papillon.add(place(maillage(boite(0.16, 0.14, 0.16, 0.03), 'plastique'), -3.5, 1.04, 3.2));


  /* ---------------- Échappement ---------------- */

  // --- Collecteurs d'échappement (2 × 3 cylindres) : brides, tubes, réunion, descente ---
  const collEch = ajouter(piece('collecteurEch', "Collecteurs d'échappement", 'echappement', [0, 0.6, -2.3]));
  [[0, 1, 2], [3, 4, 5]].forEach((groupe) => {
    const xFin = (X_CYL[groupe[0]] + X_CYL[groupe[2]]) / 2;
    groupe.forEach((i) => {
      collEch.add(place(maillage(boite(0.5, 0.38, 0.06, 0.03), 'echappement'), X_CYL[i], 1.55, -1.24));
      collEch.add(tuyau([
        [X_CYL[i], 1.55, -1.2], [X_CYL[i], 1.2, -1.8],
        [(X_CYL[i] + xFin) / 2, 0.5, -2.0], [xFin, -0.2, -2.0]
      ], 0.15, 'echappement'));
    });
    collEch.add(place(maillage(cone(0.3, 0.22, 0.3, 24), 'echappement'), xFin, -0.25, -2.0));
    collEch.add(place(maillage(cylindre(0.22, 1.3, 24), 'echappement'), xFin, -1.0, -2.0));
    collEch.add(place(maillage(cylindre(0.32, 0.06, 24), 'echappement'), xFin, -1.66, -2.0));
  });

  // --- Ligne d'échappement : 2 catalyseurs, silencieux central, silencieux arrière, sortie ---
  const ligne = ajouter(piece('ligneEch', "Ligne d'échappement", 'echappement', [0.6, -0.1, -3.4]));
  [{ x0: X_CYL[1], z: -1.2, cata: [-0.4, 0.9] }, { x0: X_CYL[4], z: -1.72, cata: [2.6, 3.9] }].forEach((l) => {
    const milieu = (l.cata[0] + l.cata[1]) / 2;
    const longueur = l.cata[1] - l.cata[0];
    ligne.add(place(maillage(cylindre(0.32, 0.06, 24), 'echappement'), l.x0, -1.72, -2.0));
    ligne.add(tuyau([[l.x0, -1.72, -2.0], [l.x0 + 0.15, -2.06, (l.z - 2.0) / 2], [l.x0 + 0.55, -2.2, l.z], [l.cata[0] - 0.15, -2.2, l.z]], 0.11, 'echappement'));
    // Catalyseur : corps, cônes d'entrée et de sortie, cerclages
    ligne.add(place(maillage(axeX(cylindre(0.27, longueur, 32)), 'echappement'), milieu, -2.2, l.z));
    ligne.add(place(maillage(axeX(cone(0.11, 0.27, 0.2, 32)), 'echappement'), l.cata[0] - 0.1, -2.2, l.z));
    ligne.add(place(maillage(axeX(cone(0.27, 0.11, 0.2, 32)), 'echappement'), l.cata[1] + 0.1, -2.2, l.z));
    [-0.4, 0, 0.4].forEach((d) => ligne.add(place(maillage(toreX(0.275, 0.015), 'acier'), milieu + d, -2.2, l.z)));
    // Tube jusqu'au silencieux central
    const debut = l.cata[1] + 0.2, fin = 6.05;
    ligne.add(place(maillage(axeX(cylindre(0.1, fin - debut, 16)), 'echappement'), (debut + fin) / 2, -2.2, l.z));
  });
  const central = place(maillage(axeX(cylindre(0.36, 1.6, 40)), 'echappement'), 6.8, -2.2, -1.46);
  central.scale.set(1, 0.8, 1.25);
  ligne.add(central);
  [6.0, 7.6].forEach((x) => {
    const cerclage = place(maillage(toreX(0.36, 0.02), 'acier'), x, -2.2, -1.46);
    cerclage.scale.set(1, 0.8, 1.25);
    ligne.add(cerclage);
  });
  ligne.add(tuyau([[7.6, -2.2, -1.46], [9.0, -2.26, -1.46], [10.4, -2.22, -1.46], [10.95, -2.05, -1.2]], 0.1, 'echappement'));
  const arriere = place(maillage(axeZ(cylindre(0.38, 3.0, 40)), 'echappement'), 11.15, -2.05, -0.2);
  arriere.scale.set(1.15, 0.75, 1);
  ligne.add(arriere);
  ligne.add(tuyau([[11.3, -2.1, 1.1], [11.7, -2.15, 1.1], [11.95, -2.18, 1.1]], 0.09, 'echappement'));
  ligne.add(place(maillage(axeX(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 32, 1, true)), 'aluOuvert'), 12.05, -2.18, 1.1));

  // --- Sondes lambda (2 amont sur les descentes, 2 aval après les catalyseurs) ---
  const sondes = ajouter(piece('sondes', 'Sondes lambda ×4', 'lambda', [0, 0.2, -3.2]));
  function sonde() {
    const s = new THREE.Group();
    s.add(maillage(cylindre(0.04, 0.12, 12), 'cuivre'));
    s.add(place(maillage(cylindre(0.07, 0.07, 6), 'acier'), 0, 0.09, 0));
    s.add(place(maillage(cylindre(0.045, 0.18, 12), 'acier'), 0, 0.21, 0));
    s.add(tuyau([[0, 0.3, 0], [0, 0.5, 0], [0.15, 0.62, 0.05], [0.4, 0.66, 0.1]], 0.02, 'caoutchouc'));
    return s;
  }
  [X_CYL[1], X_CYL[4]].forEach((x) => {
    const amont = place(sonde(), x + 0.05, -0.75, -2.2);
    amont.rotation.x = -Math.PI / 2;                                              // couchée, vers l'extérieur
    sondes.add(amont);
  });
  sondes.add(place(sonde(), 1.15, -2.1, -1.2));
  sondes.add(place(sonde(), 4.15, -2.1, -1.72));


  /* ---------------- Accessoires de façade ---------------- */

  // --- Pompe à eau : bride, volute ouverte, turbine à aubes (tourne), arbre, tubulures ---
  const pompeEau = ajouter(piece('pompeEau', 'Pompe à eau', 'refroidissement', [-1.8, 0.6, 0.4]));
  const pe = new THREE.Group();
  pe.position.set(-3.7, 0.5, 0.4);
  pompeEau.add(pe);
  pe.add(place(maillage(boite(0.08, 0.95, 1.0, 0.06), 'alu'), 0.21, 0, 0));
  [[0.38, 0.4], [0.38, -0.4], [-0.38, 0.4], [-0.38, -0.4]].forEach(([y, z]) => {
    pe.add(place(maillage(axeX(cylindre(0.06, 0.12, 12)), 'alu'), 0.15, y, z));
  });
  // Corps en fonte d'alu, ouvert côté visible pour montrer la turbine
  pe.add(place(maillage(axeX(coque(0.4, 0.4, 0.3, 1.8)), 'aluOuvert'), 0.02, 0, 0));
  const volute = place(maillage(toreX(0.43, 0.08, Math.PI * 2 - 1.8), 'alu'), 0.02, 0, 0);
  volute.rotation.x = Math.PI + 0.9;                                              // spirale ouverte du même côté
  pe.add(volute);
  pe.add(place(maillage(axeX(cylindre(0.4, 0.03, 40)), 'alu'), 0.16, 0, 0));
  pe.add(place(maillage(axeX(cone(0.12, 0.18, 0.12, 24)), 'alu'), -0.19, 0, 0));
  pe.add(place(maillage(axeX(cylindre(0.045, 0.3, 12)), 'acier'), -0.3, 0, 0));
  pe.add(tuyau([[0.0, 0.4, -0.05], [0.0, 0.7, -0.15], [0.1, 0.95, -0.35]], 0.09, 'alu'));
  pe.add(tuyau([[0.0, -0.15, -0.38], [0.0, -0.3, -0.6], [0.05, -0.35, -0.82]], 0.08, 'alu'));
  // Turbine : flasque, moyeu et 7 aubes courbées
  const turbine = new THREE.Group();
  turbine.position.x = 0.02;
  turbine.add(place(maillage(axeX(cylindre(0.33, 0.025, 40)), 'acier'), 0.11, 0, 0));
  turbine.add(maillage(axeX(cylindre(0.08, 0.26, 20)), 'acier'));
  autour(7, (a) => {
    const bras = new THREE.Group();
    bras.rotation.x = a;
    const aube = place(maillage(boite(0.22, 0.03, 0.2, 0.01), 'violet'), 0, 0, 0.19);
    aube.rotation.x = 0.55;
    bras.add(aube);
    turbine.add(bras);
  });
  pe.add(turbine);
  meca.tournants.push({ objet: turbine, rapport: 1.48 });

  // --- Poulies (multi-gorges) et courroie, poulie amortisseur du vilebrequin ---
  const poulies = ajouter(piece('poulies', 'Poulies et courroie', 'refroidissement', [-2.4, 0, 0]));
  const positionsPoulies = [[-1.0, 0, 0.62], [0.5, 0.4, 0.42], [0.2, -0.75, 0.3], [-0.2, 1.2, 0.36]];
  positionsPoulies.forEach(([y, z, r], k) => {
    const p = new THREE.Group();
    p.position.set(-4.0, y, z);
    p.add(maillage(axeX(cylindre(r, 0.18, 48)), 'acier'));
    [-0.05, 0, 0.05].forEach((dx) => p.add(place(maillage(toreX(r + 0.004, 0.012), 'acier'), dx, 0, 0)));
    p.add(place(maillage(axeX(cylindre(r * 0.35, 0.24, 24)), 'alu'), -0.02, 0, 0));
    autour(4, (a) => p.add(place(maillage(axeX(cylindre(0.03, 0.04, 6)), 'acier'), -0.15, Math.sin(a) * r * 0.22, Math.cos(a) * r * 0.22)));
    if (k === 0) {
      // Amortisseur de vibrations : bague caoutchouc entre deux flasques
      p.add(place(maillage(axeX(cylindre(r * 0.8, 0.06, 48)), 'caoutchouc'), 0.12, 0, 0));
      p.add(place(maillage(axeX(cylindre(r * 0.95, 0.08, 48)), 'acier'), 0.19, 0, 0));
    }
    poulies.add(p);
    meca.tournants.push({ objet: p, rapport: 0.62 / r });
  });
  poulies.add(tuyau([
    [-4.0, -1.62, 0], [-4.0, -1.0, -0.62], [-4.0, 0.2, -1.05], [-4.0, 1.4, 0.0],
    [-4.0, 0.9, 0.82], [-4.0, -0.4, 0.62]
  ], 0.05, 'caoutchouc', { ferme: true, segments: 80, cotes: 8 }));

  // --- Thermostat piloté : boîtier, bride, tubulures, connecteur de la résistance ---
  const thermostat = ajouter(piece('thermostat', 'Thermostat piloté', 'thermostat', [-1.2, 1.4, -0.6]));
  const th = new THREE.Group();
  th.position.set(-3.6, 1.35, -0.75);
  thermostat.add(th);
  th.add(maillage(cylindre(0.24, 0.36, 32), 'violet'));
  th.add(place(maillage(cylindre(0.28, 0.05, 32), 'alu'), 0, -0.2, 0));
  th.add(place(maillage(toreY(0.245, 0.02), 'alu'), 0, 0.1, 0));
  th.add(tuyau([[0, 0.05, -0.2], [0, 0.1, -0.45], [-0.15, 0.2, -0.7]], 0.1, 'alu'));
  th.add(tuyau([[-0.2, 0, 0], [-0.45, 0, 0], [-0.6, -0.1, 0.1]], 0.09, 'alu'));
  th.add(place(maillage(boite(0.16, 0.12, 0.16, 0.03), 'noir'), 0, 0.24, 0.12));

  // --- Reniflard (CCV) : corps, couvercle, durites vers la culasse et le carter ---
  const ccv = ajouter(piece('ccv', 'Reniflard (CCV)', 'ccv', [0.6, -0.8, 1.6]));
  const cc = new THREE.Group();
  cc.position.set(2.2, -0.2, 1.42);
  ccv.add(cc);
  cc.add(maillage(cylindre(0.28, 0.6, 32), 'noir'));
  cc.add(place(maillage(cylindre(0.3, 0.08, 32), 'plastique'), 0, 0.32, 0));
  cc.add(place(maillage(toreY(0.285, 0.02), 'plastique'), 0, -0.1, 0));
  cc.add(tuyau([[0, 0.36, 0], [-0.05, 0.9, 0], [-0.1, 1.6, -0.05], [-0.1, 2.25, -0.25]], 0.05, 'caoutchouc'));
  cc.add(tuyau([[0, -0.3, 0], [0, -0.6, 0.05], [0.1, -0.75, -0.2]], 0.06, 'caoutchouc'));

  // --- Pompe à air secondaire : moteur ailetté, volute, entrée, durite ---
  const pompeAir = ajouter(piece('pompeAir', 'Pompe à air secondaire', 'airsecondaire', [-1.0, -0.6, -1.4]));
  const pa = new THREE.Group();
  pa.position.set(-3.3, -0.4, -1.9);
  pompeAir.add(pa);
  pa.add(maillage(axeZ(cylindre(0.26, 0.45, 32)), 'noir'));
  [-0.12, 0, 0.12].forEach((z) => pa.add(place(maillage(toreZ(0.27, 0.015), 'noir'), 0, 0, z)));
  pa.add(place(maillage(axeZ(cylindre(0.3, 0.16, 32)), 'plastique'), 0, 0, 0.3));
  pa.add(place(maillage(axeZ(cylindre(0.13, 0.2, 20)), 'plastique'), 0, 0, -0.32));
  pa.add(tuyau([[0, 0.25, 0.3], [0, 0.55, 0.35], [0.4, 0.8, 0.5], [0.9, 0.9, 0.6]], 0.07, 'caoutchouc'));

  // --- Calculateur MS43 (DME), représenté à côté du moteur ---
  const dme = ajouter(piece('dme', 'Calculateur MS43', 'gestion', [1.2, 1.4, 1.2]));
  const d = new THREE.Group();
  d.position.set(4.2, 2.0, 1.8);
  dme.add(d);
  d.add(maillage(boite(1.0, 0.22, 0.75, 0.04), 'alu'));
  for (let k = 0; k < 7; k++) d.add(place(maillage(boite(0.9, 0.05, 0.03, 0.01), 'alu'), 0, 0.13, -0.3 + k * 0.1));
  [-0.3, 0, 0.3].forEach((x) => d.add(place(maillage(boite(0.26, 0.16, 0.18, 0.03), 'noir'), x, 0.04, -0.44)));
  d.add(tuyau([[0, 0.05, -0.55], [-0.3, 0, -0.8], [-0.8, 0.2, -1.0]], 0.06, 'plastique'));


  /* ---------------- Transmission (propulsion) ---------------- */

  // --- Volant moteur : disque, couronne de démarreur, face d'appui, vis (tourne) ---
  const volant = ajouter(piece('volant', 'Volant moteur', 'transmission', [0.5, 0.6, 0]));
  const vm = new THREE.Group();
  vm.position.set(3.82, Y_VILO, 0);
  volant.add(vm);
  vm.add(maillage(axeX(cylindre(0.88, 0.12, 64)), 'acier'));
  vm.add(place(maillage(denture(0.9, 72, 0.05, 0.1), 'acier'), -0.01, 0, 0));
  vm.add(place(maillage(axeX(cylindre(0.75, 0.06, 64)), 'alu'), 0.09, 0, 0));
  vm.add(place(maillage(axeX(cylindre(0.3, 0.06, 32)), 'acier'), -0.08, 0, 0));
  autour(8, (a) => vm.add(place(maillage(axeX(cylindre(0.035, 0.05, 6)), 'acier'), -0.13, Math.sin(a) * 0.2, Math.cos(a) * 0.2)));
  autour(6, (a) => vm.add(place(maillage(axeX(cylindre(0.07, 0.125, 16)), 'noir'), 0, Math.sin(a) * 0.55, Math.cos(a) * 0.55)));
  meca.tournants.push({ objet: vm, rapport: 1 });

  // --- Embrayage : disque (garnitures, ressorts, moyeu), mécanisme, diaphragme, butée (tourne) ---
  const embrayage = ajouter(piece('embrayage', 'Embrayage', 'transmission', [1.2, 1.2, 0]));
  const em = new THREE.Group();
  em.position.set(4.05, Y_VILO, 0);
  embrayage.add(em);
  em.add(place(maillage(axeX(cylindre(0.7, 0.05, 64)), 'friction'), -0.06, 0, 0));
  em.add(place(maillage(axeX(cylindre(0.36, 0.03, 40)), 'acier'), -0.02, 0, 0));
  autour(6, (a) => {
    const r = place(maillage(cylindre(0.035, 0.14, 10), 'violet'), -0.02, Math.cos(a) * 0.22, Math.sin(a) * 0.22);
    r.rotation.x = a + Math.PI / 2;                                               // ressorts tangents au cercle
    em.add(r);
  });
  em.add(place(maillage(axeX(cylindre(0.1, 0.14, 16)), 'acier'), -0.02, 0, 0));
  em.add(place(maillage(axeX(cone(0.8, 0.72, 0.16, 48)), 'acier'), 0.08, 0, 0));
  autour(18, (a) => {
    const bras = new THREE.Group();
    bras.rotation.x = a;
    bras.add(place(maillage(boite(0.02, 0.36, 0.07, 0.008), 'acier'), 0.17, 0.32, 0));
    em.add(bras);
  });
  em.add(place(maillage(axeX(cylindre(0.14, 0.1, 24)), 'alu'), 0.27, 0, 0));
  meca.tournants.push({ objet: em, rapport: 1 });

  // --- Boîte de vitesses : cloche ouverte (on voit l'embrayage), carter nervuré, sortie, sélection ---
  const bv = ajouter(piece('boite', 'Boîte de vitesses', 'transmission', [2.2, 0.2, 0]));
  const g = new THREE.Group();
  g.position.y = Y_VILO;
  bv.add(g);
  g.add(place(maillage(axeX(coque(1.12, 0.82, 1.05, 1.8)), 'carterVitre'), 4.08, 0, 0));
  const brideCloche = place(maillage(toreX(1.12, 0.04, Math.PI * 2 - 1.8), 'alu'), 3.56, 0, 0);
  brideCloche.rotation.x = Math.PI + 0.9;
  g.add(brideCloche);
  g.add(place(maillage(axeX(cone(0.8, 0.5, 1.95, 40)), 'alu'), 5.58, 0, 0));
  for (let k = 0; k < 5; k++) g.add(place(maillage(toreX(0.778 - k * 0.065, 0.03), 'alu'), 4.75 + k * 0.42, 0, 0));
  g.add(place(maillage(axeX(cylindre(0.3, 0.35, 32)), 'alu'), 6.72, 0, 0));
  g.add(place(maillage(axeX(cylindre(0.26, 0.05, 32)), 'acier'), 6.92, 0, 0));
  g.add(place(maillage(cylindre(0.04, 0.6, 12), 'acier'), 6.0, 0.75, 0));
  g.add(place(maillage(cone(0.1, 0.18, 0.18, 20), 'caoutchouc'), 6.0, 0.6, 0));
  g.add(place(maillage(axeZ(cylindre(0.06, 0.06, 6)), 'acier'), 5.3, -0.3, -0.7));

  // --- Arbre de transmission : flector, 2 tronçons, palier central, cardan, bride (tourne) ---
  const arbreT = ajouter(piece('arbre', 'Arbre de transmission', 'transmission', [2.7, 0.6, 0]));
  const P0 = new THREE.Vector3(6.97, Y_VILO, 0);
  const P1 = new THREE.Vector3(8.05, -1.28, 0);
  const P2 = new THREE.Vector3(8.82, -1.62, 0);
  // Un tronçon : pivot orienté de a vers b, et rotor qui tourne autour de son axe
  function troncon(a, b) {
    const dir = b.clone().sub(a);
    const pivot = new THREE.Group();
    pivot.position.copy(a);
    pivot.rotation.z = Math.atan2(dir.y, dir.x);
    const rotor = new THREE.Group();
    pivot.add(rotor);
    arbreT.add(pivot);
    meca.tournants.push({ objet: rotor, rapport: RAPPORT_ARBRE });
    return { rotor: rotor, longueur: dir.length() };
  }
  const t1 = troncon(P0, P1);
  t1.rotor.add(place(maillage(axeX(cylindre(0.24, 0.08, 32)), 'caoutchouc'), 0.04, 0, 0));
  autour(6, (a) => t1.rotor.add(place(maillage(axeX(cylindre(0.03, 0.14, 6)), 'acier'), 0.04, Math.sin(a) * 0.17, Math.cos(a) * 0.17)));
  t1.rotor.add(place(maillage(axeX(cylindre(0.12, t1.longueur - 0.2, 24)), 'acier'), t1.longueur / 2, 0, 0));
  t1.rotor.add(place(maillage(axeX(cylindre(0.15, 0.25, 24)), 'acier'), t1.longueur - 0.25, 0, 0));
  const t2 = troncon(P1, P2);
  t2.rotor.add(maillage(axeZ(cylindre(0.04, 0.26, 10)), 'acier'));               // croisillon du cardan
  t2.rotor.add(maillage(cylindre(0.04, 0.26, 10), 'acier'));
  t2.rotor.add(place(maillage(axeX(cylindre(0.11, t2.longueur - 0.2, 24)), 'acier'), t2.longueur / 2, 0, 0));
  t2.rotor.add(place(maillage(axeX(cylindre(0.2, 0.05, 32)), 'acier'), t2.longueur, 0, 0));
  // Palier central (fixe) : roulement en caoutchouc et sa traverse
  arbreT.add(place(maillage(axeX(cylindre(0.2, 0.14, 24)), 'caoutchouc'), P1.x - 0.12, P1.y + 0.02, 0));
  arbreT.add(place(maillage(boite(0.16, 0.08, 0.8, 0.02), 'acier'), P1.x - 0.12, P1.y + 0.24, 0));

  // --- Pont arrière (différentiel) : carter, nez du pignon d'attaque, couvercle nervuré, sorties ---
  const pont = ajouter(piece('pont', 'Pont arrière', 'transmission', [3.0, 1.1, 0]));
  const pg = new THREE.Group();
  pg.position.set(X_PONT, Y_PONT, 0);
  pont.add(pg);
  pg.add(maillage(new THREE.SphereGeometry(0.45, 32, 24), 'alu'));
  pg.add(place(maillage(axeX(cone(0.16, 0.32, 0.45, 32)), 'alu'), -0.5, 0.03, 0));
  pg.add(place(maillage(axeX(cylindre(0.2, 0.05, 32)), 'acier'), -0.75, 0.03, 0));
  pg.add(place(maillage(axeX(cylindre(0.42, 0.08, 40)), 'alu'), 0.38, 0, 0));
  for (let k = 0; k < 5; k++) pg.add(place(maillage(boite(0.06, 0.6, 0.04, 0.01), 'alu'), 0.44, 0, -0.24 + k * 0.12));
  [-1, 1].forEach((s) => {
    pg.add(place(maillage(axeZ(cylindre(0.16, 0.2, 24)), 'alu'), 0, 0, s * 0.5));
    pg.add(place(maillage(axeZ(cylindre(0.1, 0.14, 16)), 'caoutchouc'), 0.25, 0.42, s * 0.35));
  });

  // --- Roues motrices : demi-arbres et soufflets, pneus, jantes, disques, étriers (tournent) ---
  const roues = ajouter(piece('roues', 'Roues motrices ×2', 'transmission', [3.0, 0, 0]));
  const profilPneu = [[0.78, -0.36], [1.0, -0.38], [1.11, -0.34], [1.15, -0.25], [1.15, 0.25], [1.11, 0.34], [1.0, 0.38], [0.78, 0.36]]
    .map(([r, h]) => new THREE.Vector2(r, h));
  [-1, 1].forEach((s) => {
    // Demi-arbre (tourne avec la roue)
    const da = new THREE.Group();
    da.position.set(X_PONT, Y_PONT, 0);
    da.add(place(maillage(axeZ(cylindre(0.07, 1.4, 16)), 'acier'), 0, 0, s * 1.3));
    da.add(place(maillage(axeZ(cone(s > 0 ? 0.08 : 0.16, s > 0 ? 0.16 : 0.08, 0.3, 20)), 'caoutchouc'), 0, 0, s * 0.78));
    da.add(place(maillage(axeZ(cone(s > 0 ? 0.16 : 0.08, s > 0 ? 0.08 : 0.16, 0.3, 20)), 'caoutchouc'), 0, 0, s * 1.82));
    roues.add(da);
    meca.roues.push(da);
    // Roue
    const roue = new THREE.Group();
    roue.position.set(X_PONT, Y_PONT, s * Z_ROUE);
    roues.add(roue);
    const tournant = new THREE.Group();
    roue.add(tournant);
    tournant.add(maillage(axeZ(new THREE.LatheGeometry(profilPneu, 64)), 'pneu'));
    tournant.add(maillage(axeZ(new THREE.CylinderGeometry(0.78, 0.78, 0.66, 48, 1, true)), 'aluOuvert'));
    [-0.33, 0.33].forEach((z) => tournant.add(place(maillage(toreZ(0.79, 0.03), 'alu'), 0, 0, z)));
    tournant.add(place(maillage(axeZ(cylindre(0.17, 0.12, 24)), 'alu'), 0, 0, s * 0.2));
    autour(5, (a) => {
      const branche = new THREE.Group();
      branche.rotation.z = a;
      branche.add(place(maillage(boite(0.13, 0.62, 0.06, 0.02), 'alu'), 0, 0.46, s * 0.22));
      tournant.add(branche);
      tournant.add(place(maillage(axeZ(cylindre(0.03, 0.06, 6)), 'acier'), Math.sin(a) * 0.1, Math.cos(a) * 0.1, s * 0.28));
    });
    tournant.add(place(maillage(axeZ(cylindre(0.55, 0.06, 48)), 'acier'), 0, 0, -s * 0.05));
    meca.roues.push(tournant);
    // Étrier de frein (fixe)
    roue.add(place(maillage(boite(0.36, 0.22, 0.2, 0.05), 'violet'), -0.35, 0.36, -s * 0.05));
  });

  // Pose initiale de la mécanique (utile aussi en mouvement réduit)
  meca.poser = function (angle) {
    meca.arbre.rotation.x = angle;
    meca.equipages.forEach((e) => {
      const t = angle + e.phase;
      const decalage = R_MANIV * Math.sin(t);
      const y = Y_VILO + R_MANIV * Math.cos(t) + Math.sqrt(L_BIELLE * L_BIELLE - decalage * decalage);
      e.piston.position.y = y;
      e.bielle.position.y = y;
      e.bielle.rotation.x = -Math.asin(decalage / L_BIELLE);                      // la bielle suit le maneton
    });
    // Les arbres à cames tournent deux fois moins vite que le vilebrequin
    meca.cames.forEach((c) => { c.rotation.x = angle / 2; });
    // Chaque soupape s'enfonce quand le bossage de sa came pointe vers le bas
    meca.soupapes.forEach((s) => {
      const c = -Math.cos(angle / 2 + s.calage);
      s.mobile.position.y = c > 0 ? -LEVEE * c * c * c : 0;
    });
    meca.tournants.forEach((t) => { t.objet.rotation.x = angle * t.rapport; });
    meca.roues.forEach((r) => { r.rotation.z = angle * RAPPORT_ROUES; });
  };
  meca.poser(0);

  moteur.position.y = 0.2;
  return { moteur: moteur, pieces: pieces, meca: meca };
}

// Pièces montrées dans la mini-maquette de chaque fiche
const PIECES_PAR_FICHE = {
  cycle: ['bloc', 'pistons', 'vilebrequin'],
  admission: ['collecteurAdm', 'disa', 'papillon'],
  carburant: ['rampe', 'injecteurs'],
  allumage: ['bobines', 'bougies'],
  distribution: ['aac', 'soupapes', 'vanos'],
  echappement: ['collecteurEch', 'ligneEch', 'sondes'],
  refroidissement: ['pompeEau', 'poulies', 'thermostat'],
  lubrification: ['carter', 'vilebrequin'],
  ccv: ['ccv', 'cache'],
  gestion: ['dme', 'bobines', 'rampe', 'injecteurs'],
  transmission: ['volant', 'embrayage', 'boite', 'arbre', 'pont', 'roues'],
  vanos: ['vanos', 'aac'],
  disa: ['disa', 'collecteurAdm'],
  thermostat: ['thermostat', 'pompeEau'],
  airsecondaire: ['pompeAir', 'collecteurEch'],
  lambda: ['sondes', 'collecteurEch'],
  mdk: ['papillon'],
  gicleurs: ['pistons', 'vilebrequin']
};


/* ==========================================================================
   3. Scène commune (lumières, environnement, sol)
   ========================================================================== */
function preparerRendu(conteneur, ombres) {
  const rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  rendu.shadowMap.enabled = ombres;
  rendu.shadowMap.type = THREE.PCFSoftShadowMap;
  conteneur.appendChild(rendu.domElement);

  const scene = new THREE.Scene();
  // Reflets réalistes sur les métaux : environnement de type "studio"
  const pmrem = new THREE.PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e2f5, 0.9));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
  soleil.position.set(-6, 12, 8);
  if (ombres) {
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    Object.assign(soleil.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
    soleil.shadow.camera.updateProjectionMatrix();
    soleil.shadow.bias = -0.0005;
  }
  scene.add(soleil);
  const contre = new THREE.DirectionalLight(0xc4b5fd, 0.8);  // contre-jour violet discret
  contre.position.set(8, 4, -10);
  scene.add(contre);

  return { rendu: rendu, scene: scene };
}


/* ==========================================================================
   4. Vue principale
   ========================================================================== */
function demarrer() {
  const { rendu, scene } = preparerRendu(zoneScene, true);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 300);

  // Sol qui ne montre que l'ombre
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.14 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -2.6;
  sol.receiveShadow = true;
  scene.add(sol);

  const { moteur, pieces, meca } = construireMoteur();
  scene.add(moteur);
  window.MoteurM54 = { pieces: pieces };

  // Toute la chaîne (moteur → roues) est centrée sur l'origine
  const centreBrut = new THREE.Box3().setFromObject(moteur).getCenter(new THREE.Vector3());
  moteur.position.x -= centreBrut.x;
  moteur.position.z -= centreBrut.z;

  // Sphères englobantes des vues assemblée et éclatée : servent au cadrage
  function mesurer(t) {
    Object.values(pieces).forEach((p) => p.position.copy(p.userData.eclate).multiplyScalar(t));
    moteur.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(moteur).getBoundingSphere(new THREE.Sphere());
  }
  const vueEclatee = mesurer(1);
  const vueAssemblee = mesurer(0);

  // Caméra placée devant, à gauche et au-dessus, à une distance qui fait tenir toute la chaîne
  const distance = vueAssemblee.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.78;
  camera.position.copy(vueAssemblee.center).addScaledVector(new THREE.Vector3(-11, 6.2, 13).normalize(), distance);

  // Contrôles : glisser pour tourner, rotation automatique, pas de zoom (ne gêne pas le scroll)
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = !mouvementReduit;
  controles.enableZoom = false;
  controles.enablePan = false;
  controles.autoRotate = !mouvementReduit;
  controles.autoRotateSpeed = 0.8;
  controles.target.copy(vueAssemblee.center);
  controles.minPolarAngle = 0.35;
  controles.maxPolarAngle = 1.75;
  // Sur écran tactile : un doigt fait défiler la page, deux doigts font tourner le moteur
  controles.touches = { ONE: null, TWO: THREE.TOUCH.ROTATE };
  rendu.domElement.style.touchAction = 'pan-y';

  /* ---------- Cadrage : en vue éclatée, la caméra suit le centre et recule ---------- */
  let zoomBase = 1;
  const centreVise = new THREE.Vector3();
  function cadrer() {
    const t = eclate * eclate * (3 - 2 * eclate);
    centreVise.copy(vueAssemblee.center).lerp(vueEclatee.center, t);
    camera.position.add(centreVise).sub(controles.target);                        // la caméra suit sa cible
    controles.target.copy(centreVise);
    camera.zoom = zoomBase * vueAssemblee.radius / THREE.MathUtils.lerp(vueAssemblee.radius, vueEclatee.radius, t);
    camera.updateProjectionMatrix();
  }

  /* ---------- Taille ---------- */
  function redimensionner() {
    const l = zoneScene.clientWidth, h = zoneScene.clientHeight;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    // Recul de la caméra pour que toute la chaîne tienne aussi en portrait (mobile)
    zoomBase = Math.min(1, camera.aspect);
    cadrer();
    demanderRendu();
  }
  new ResizeObserver(redimensionner).observe(zoneScene);

  /* ---------- Étiquettes françaises (vue éclatée) ---------- */
  const etiquettes = Object.values(pieces).map((p) => {
    const el = document.createElement('span');
    el.className = 'etiquette-piece';
    el.textContent = p.userData.nom;
    zoneEtiquettes.appendChild(el);
    return { piece: p, el: el, boite: new THREE.Box3(), point: new THREE.Vector3() };
  });

  function placerEtiquettes() {
    const l = zoneScene.clientWidth, h = zoneScene.clientHeight;
    // 1. Position idéale : au-dessus du centre de chaque pièce
    etiquettes.forEach((e) => {
      e.boite.setFromObject(e.piece);
      e.boite.getCenter(e.point);
      e.point.y = e.boite.max.y;
      e.point.project(camera);
      e.x = (e.point.x + 1) / 2 * l;
      e.y = (1 - e.point.y) / 2 * h;
      e.largeur = e.el.offsetWidth || 120;
    });
    // 2. Anti-chevauchement : de haut en bas, une étiquette qui en recouvre
    //    une autre déjà placée descend d'un cran
    const placees = [];
    etiquettes.slice().sort((a, b) => a.y - b.y).forEach((e) => {
      for (let essai = 0; essai < 8; essai++) {
        const gene = placees.find((o) => Math.abs(o.x - e.x) < (o.largeur + e.largeur) / 2 + 6 && Math.abs(o.y - e.y) < 30);
        if (!gene) break;
        e.y = gene.y + 30;
      }
      placees.push(e);
      e.el.style.transform = 'translate(-50%, -120%) translate(' + e.x.toFixed(1) + 'px,' + e.y.toFixed(1) + 'px)';
      e.el.style.visibility = e.point.z < 1 ? 'visible' : 'hidden';
    });
  }

  /* ---------- Vue éclatée ---------- */
  let eclate = 0;        // 0 = assemblé, 1 = éclaté (valeur animée)
  let cibleEclate = 0;

  function appliquerEclate() {
    // Courbe douce pour un mouvement plus naturel
    const t = eclate * eclate * (3 - 2 * eclate);
    Object.values(pieces).forEach((p) => {
      p.position.copy(p.userData.eclate).multiplyScalar(t);
    });
    cadrer();
  }

  boutonEclate.addEventListener('click', () => {
    cibleEclate = cibleEclate ? 0 : 1;
    boutonEclate.setAttribute('aria-pressed', String(!!cibleEclate));
    boutonEclate.querySelector('[data-libelle]').textContent = cibleEclate ? 'RÉASSEMBLER' : 'VUE ÉCLATÉE';
    cadre.classList.toggle('est-eclate', !!cibleEclate);
    // En vue éclatée, le moteur arrête de tourner tout seul : les pièces restent faciles à viser
    controles.autoRotate = !mouvementReduit && !cibleEclate;
    if (mouvementReduit) { eclate = cibleEclate; appliquerEclate(); }
    demanderRendu();
  });

  /* ---------- Survol et clic sur une pièce ---------- */
  const rayon = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let survolee = null;

  function pieceSous(e) {
    const zone = rendu.domElement.getBoundingClientRect();
    pointeur.set(((e.clientX - zone.left) / zone.width) * 2 - 1, -((e.clientY - zone.top) / zone.height) * 2 + 1);
    rayon.setFromCamera(pointeur, camera);
    const touche = rayon.intersectObject(moteur, true)[0];
    let o = touche && touche.object;
    while (o && !(o.userData && o.userData.piece)) o = o.parent;
    return o || null;
  }

  function surligner(p, actif) {
    if (!p) return;
    p.traverse((o) => {
      if (o.isMesh) {
        o.material.emissive.setHex(actif ? 0x7c3aed : 0x000000);
        o.material.emissiveIntensity = actif ? 0.45 : 0;
      }
    });
  }

  function changerSurvol(p) {
    if (p === survolee) return;
    surligner(survolee, false);
    survolee = p;
    surligner(survolee, true);
    zoneSurvol.textContent = p ? p.userData.nom + ' — cliquer pour la fiche' : '';
    zoneSurvol.classList.toggle('est-visible', !!p);
    rendu.domElement.style.cursor = p ? 'pointer' : '';
    etiquettes.forEach((e) => e.el.classList.toggle('est-active', e.piece === p));
    demanderRendu();
  }

  rendu.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') changerSurvol(pieceSous(e));
  });
  rendu.domElement.addEventListener('pointerleave', () => changerSurvol(null));

  // Un clic (et pas un glisser) ouvre la fiche de la pièce
  let depart = null;
  rendu.domElement.addEventListener('pointerdown', (e) => { depart = { x: e.clientX, y: e.clientY }; });
  rendu.domElement.addEventListener('pointerup', (e) => {
    if (!depart || Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 6) return;
    const p = pieceSous(e);
    if (!p) return;
    if (e.pointerType !== 'mouse') changerSurvol(p);
    if (window.ouvrirFiche) window.ouvrirFiche(p.userData.fiche);
  });

  /* ---------- Boucle de rendu ---------- */
  const horloge = new THREE.Clock();
  let angle = 0;            // angle du vilebrequin
  let visible = true;
  let enCours = false;

  function image() {
    enCours = false;
    const dt = Math.min(horloge.getDelta(), 0.05);
    if (!mouvementReduit) {
      angle += dt * 2.2;
      meca.poser(angle);
    }
    if (Math.abs(cibleEclate - eclate) > 0.001) {
      eclate += (cibleEclate - eclate) * Math.min(1, dt * 3.2);
      appliquerEclate();
    }
    controles.update();
    rendu.render(scene, camera);
    if (cibleEclate || eclate > 0.01) placerEtiquettes();
    // On continue tant que quelque chose bouge et que la vue est à l'écran
    if (visible && !document.hidden && (!mouvementReduit || Math.abs(cibleEclate - eclate) > 0.001)) demanderRendu();
  }

  function demanderRendu() {
    if (!enCours) {
      enCours = true;
      requestAnimationFrame(image);
    }
  }

  controles.addEventListener('change', demanderRendu);
  new IntersectionObserver((entrees) => {
    visible = entrees[0].isIntersecting;
    if (visible) { horloge.getDelta(); demanderRendu(); }
  }).observe(zoneScene);
  document.addEventListener('visibilitychange', demanderRendu);

  redimensionner();
  cadre.classList.add('est-pret');
  return pieces;
}


/* ==========================================================================
   5. Mini-maquette dans la fiche ouverte
   ========================================================================== */
function brancherMiniMaquette(pieces) {
  let mini = null;     // { rendu, scene, camera, racine }
  let actif = false;

  document.addEventListener('fiche:ouverte', (e) => {
    const conteneur = e.detail.conteneur;
    const liste = PIECES_PAR_FICHE[e.detail.systeme];
    if (!conteneur || !liste) return;

    if (!mini) {
      const { rendu, scene } = preparerRendu(document.createElement('div'), false);
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      mini = { rendu: rendu, scene: scene, camera: camera, racine: null };
    }
    conteneur.appendChild(mini.rendu.domElement);

    // Copie des pièces concernées, assemblées et centrées
    if (mini.racine) mini.scene.remove(mini.racine);
    const racine = new THREE.Group();
    liste.forEach((id) => {
      const copie = pieces[id].clone(true);
      copie.position.set(0, 0, 0);
      copie.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive.setHex(0); } });
      racine.add(copie);
    });
    const boite = new THREE.Box3().setFromObject(racine);
    const centre = boite.getCenter(new THREE.Vector3());
    const taille = boite.getSize(new THREE.Vector3()).length();
    racine.children.forEach((c) => c.position.sub(centre));
    const pivot = new THREE.Group();
    pivot.add(racine);
    mini.scene.add(pivot);
    mini.racine = pivot;

    mini.camera.position.set(-0.9, 0.55, 1).normalize().multiplyScalar(taille * 1.6);
    mini.camera.lookAt(0, 0, 0);

    const l = conteneur.clientWidth || 300, h = conteneur.clientHeight || 220;
    mini.rendu.setSize(l, h, false);
    mini.camera.aspect = l / h;
    mini.camera.updateProjectionMatrix();

    actif = true;
    const horloge = new THREE.Clock();
    (function boucle() {
      if (!actif) return;
      if (!mouvementReduit) pivot.rotation.y += horloge.getDelta() * 0.5;
      mini.rendu.render(mini.scene, mini.camera);
      if (!mouvementReduit) requestAnimationFrame(boucle);
    })();
  });

  document.addEventListener('fiche:fermee', () => { actif = false; });
}


/* ==========================================================================
   Démarrage
   ========================================================================== */
async function lancer() {
  if (!cadre) return;
  // 1. WebGL
  const causeWebgl = diagnosticWebgl();
  if (causeWebgl) { afficherEchec(causeWebgl); return; }

  // 2. Librairie 3D
  try {
    const modules = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js')
    ]);
    THREE = modules[0];
    OrbitControls = modules[1].OrbitControls;
    RoomEnvironment = modules[2].RoomEnvironment;
    RoundedBoxGeometry = modules[3].RoundedBoxGeometry;
  } catch (e) {
    afficherEchec('librairie 3D non chargée (' + e.message + ')');
    return;
  }

  // 3. Construction de la scène
  try {
    const pieces = demarrer();
    brancherMiniMaquette(pieces);
  } catch (e) {
    afficherEchec('erreur JS : ' + e.message);
  }
}
lancer();
