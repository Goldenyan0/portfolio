/* ==========================================================================
   moteur-3d.js — le moteur M54B22 en 3D (maquette stylisée)
   - 22 pièces : bloc, culasse, 6 pistons animés, vilebrequin, 2 arbres à cames,
     double VANOS, collecteurs, DISA, papillon, injecteurs, bobines, carter...
   - Rotation automatique + glisser à la souris / au doigt (OrbitControls)
   - Bouton "VUE ÉCLATÉE" : les pièces se séparent, étiquettes en français
   - Survol : nom de la pièce ; clic : ouverture de la fiche correspondante
   - Mini-maquette 3D dans chaque fiche ouverte (événement "fiche:ouverte")
   Librairie : Three.js (importée via l'importmap de e39.html).
   Mouvement réduit : pas de rotation automatique ni de pistons qui bougent,
   la vue éclatée s'ouvre sans transition.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cadre = document.getElementById('moteur3d');
const zoneScene = document.getElementById('moteur-scene');
const zoneEtiquettes = document.getElementById('moteur-etiquettes');
const zoneSurvol = document.getElementById('moteur-survol');
const boutonEclate = document.getElementById('bouton-eclate');

function webglDisponible() {
  try {
    const essai = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (essai.getContext('webgl2') || essai.getContext('webgl')));
  } catch (e) {
    return false;
  }
}


/* ==========================================================================
   1. Matériaux
   ========================================================================== */
const MATERIAUX = {
  fonte: { color: 0x9aa0aa, metalness: 0.55, roughness: 0.45, transparent: true, opacity: 0.42, depthWrite: false },
  alu: { color: 0xcfd3da, metalness: 0.8, roughness: 0.3 },
  acier: { color: 0xe4e7ee, metalness: 0.95, roughness: 0.18 },
  noir: { color: 0x26262e, metalness: 0.15, roughness: 0.55 },
  plastique: { color: 0x34343e, metalness: 0.05, roughness: 0.7 },
  echappement: { color: 0x8f7d70, metalness: 0.75, roughness: 0.38 },
  caoutchouc: { color: 0x18181c, metalness: 0, roughness: 0.9 },
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

// Positionne un maillage et le renvoie (la propriété position ne peut pas être remplacée)
function place(m, x, y, z) {
  m.position.set(x, y, z);
  return m;
}

// Petits raccourcis de géométrie
const boite = (l, h, p, r) => new RoundedBoxGeometry(l, h, p, 3, r || 0.08);
const cylindre = (r, h, seg) => new THREE.CylinderGeometry(r, r, h, seg || 32);


/* ==========================================================================
   2. Construction des pièces
   Repère : le moteur s'étend le long de X (cylindre 1 à gauche, côté distribution),
   Y vers le haut, admission côté +Z, échappement côté -Z.
   Chaque pièce est un THREE.Group avec :
   - userData.nom : libellé français
   - userData.fiche : fiche ouverte au clic
   - userData.eclate : déplacement en vue éclatée
   ========================================================================== */
const ENTRAXE = 1.05;                                            // distance entre deux cylindres
const X_CYL = [0, 1, 2, 3, 4, 5].map(i => (i - 2.5) * ENTRAXE);  // position X des 6 cylindres
// Déphasage de chaque maneton : ordre d'allumage 1-5-3-6-2-4 (combustion tous les 120°)
const PHASES = [0, 240, 120, 120, 240, 0].map(d => THREE.MathUtils.degToRad(d));
const COURSE = 0.42;                                             // demi-course des pistons

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

  // --- Bloc moteur (semi-transparent : on voit les pistons travailler) ---
  const bloc = ajouter(piece('bloc', 'Bloc moteur', 'cycle', [0, 0, 0]));
  bloc.add(maillage(boite(6.9, 2.4, 2.3, 0.15), 'fonte'));

  // --- Pistons (avec bielle) ---
  const pistons = ajouter(piece('pistons', 'Pistons ×6', 'cycle', [0, 1.9, 0]));
  X_CYL.forEach((x, i) => {
    const p = new THREE.Group();
    const tete = maillage(cylindre(0.4, 0.5), 'alu');
    const bielle = maillage(boite(0.14, 1.0, 0.12, 0.03), 'acier');
    bielle.position.y = -0.7;
    p.add(tete, bielle);
    p.position.set(x, 0.4, 0);
    p.userData.phase = PHASES[i];
    pistons.add(p);
  });

  // --- Vilebrequin (tourne) ---
  const vilebrequin = ajouter(piece('vilebrequin', 'Vilebrequin', 'cycle', [0, -1.0, 0]));
  const arbre = new THREE.Group();
  const axe = maillage(cylindre(0.16, 7.2), 'acier');
  axe.rotation.z = Math.PI / 2;
  arbre.add(axe);
  X_CYL.forEach((x, i) => {
    const bras = maillage(boite(0.16, 0.55, 0.42, 0.05), 'acier');
    bras.position.set(x, 0, 0);
    bras.rotation.x = PHASES[i];
    bras.geometry.translate(0, 0.2, 0);
    arbre.add(bras);
  });
  arbre.position.y = -1.0;
  vilebrequin.add(arbre);

  // --- Carter d'huile ---
  const carter = ajouter(piece('carter', "Carter d'huile", 'lubrification', [0, -1.6, 0]));
  const c1 = maillage(boite(6.6, 0.6, 2.0, 0.12), 'alu');
  c1.position.y = -1.55;
  const c2 = maillage(boite(3.2, 0.5, 1.6, 0.12), 'alu');
  c2.position.set(1.4, -1.95, 0);
  carter.add(c1, c2);

  // --- Culasse ---
  const culasse = ajouter(piece('culasse', 'Culasse', 'distribution', [0, 2.6, 0]));
  culasse.add(place(maillage(boite(6.9, 0.85, 2.3, 0.12), 'alu'), 0, 1.65, 0));

  // --- Arbres à cames (admission et échappement, tournent) ---
  const aac = ajouter(piece('aac', 'Arbres à cames ×2', 'distribution', [0, 3.6, 0]));
  [0.48, -0.48].forEach((z) => {
    const came = new THREE.Group();
    const tige = maillage(cylindre(0.1, 6.8), 'acier');
    tige.rotation.z = Math.PI / 2;
    came.add(tige);
    for (let i = 0; i < 12; i++) {
      const lobe = maillage(boite(0.1, 0.32, 0.22, 0.04), 'acier');
      lobe.position.x = X_CYL[Math.floor(i / 2)] + (i % 2 ? 0.18 : -0.18);
      lobe.geometry.translate(0, 0.08, 0);
      lobe.rotation.x = PHASES[Math.floor(i / 2)] / 2;
      came.add(lobe);
    }
    came.position.set(0, 2.3, z);
    aac.add(came);
  });


  // --- Double VANOS (à l'avant, sur les deux arbres) ---
  const vanos = ajouter(piece('vanos', 'Double VANOS', 'vanos', [-1.2, 3.6, 0]));
  const boitier = maillage(boite(0.5, 0.9, 1.8, 0.12), 'noir');
  boitier.position.set(-3.75, 2.3, 0);
  vanos.add(boitier);
  [0.48, -0.48].forEach((z) => {
    const pignon = maillage(cylindre(0.42, 0.14, 40), 'violet');
    pignon.rotation.z = Math.PI / 2;
    pignon.position.set(-3.45, 2.3, z);
    vanos.add(pignon);
  });

  // --- Cache-culbuteurs ---
  const cache = ajouter(piece('cache', 'Cache-culbuteurs', 'distribution', [0, 4.6, 0]));
  cache.add(place(maillage(boite(6.6, 0.45, 2.0, 0.18), 'noir'), 0, 2.9, 0));

  // --- Bobines crayon ---
  const bobines = ajouter(piece('bobines', 'Bobines ×6', 'allumage', [0, 5.6, 0]));
  X_CYL.forEach((x) => {
    const corps = maillage(cylindre(0.11, 0.55), 'plastique');
    corps.position.set(x, 3.3, 0);
    const tete = maillage(boite(0.32, 0.16, 0.42, 0.04), 'noir');
    tete.position.set(x, 3.6, 0);
    bobines.add(corps, tete);
  });

  // --- Rampe et injecteurs (côté admission) ---
  const rampe = ajouter(piece('rampe', 'Rampe et injecteurs ×6', 'carburant', [0, 2.6, 1.3]));
  const tube = maillage(cylindre(0.09, 6.4), 'acier');
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0, 2.2, 1.45);
  rampe.add(tube);
  X_CYL.forEach((x) => {
    const inj = maillage(cylindre(0.07, 0.42), 'cuivre');
    inj.position.set(x, 1.98, 1.35);
    inj.rotation.x = -0.35;
    rampe.add(inj);
  });

  // --- Collecteur d'admission : 6 pipes courbes + plénum ---
  const collAdm = ajouter(piece('collecteurAdm', "Collecteur d'admission", 'admission', [0, 1.4, 2.3]));
  X_CYL.forEach((x) => {
    const courbe = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 1.6, 1.18),
      new THREE.Vector3(x, 2.15, 1.9),
      new THREE.Vector3(x, 1.7, 2.6),
      new THREE.Vector3(x, 0.9, 2.75)
    ]);
    collAdm.add(maillage(new THREE.TubeGeometry(courbe, 24, 0.2, 14, false), 'plastique'));
  });
  const plenum = maillage(boite(6.4, 0.9, 0.8, 0.25), 'plastique');
  plenum.position.set(0, 0.6, 2.85);
  collAdm.add(plenum);

  // --- Volet DISA (sur le plénum) ---
  const disa = ajouter(piece('disa', 'Volet DISA', 'disa', [0.6, 2.2, 2.9]));
  const corpsDisa = maillage(cylindre(0.2, 0.4), 'violet');
  corpsDisa.rotation.x = Math.PI / 2;
  corpsDisa.position.set(1.6, 0.6, 3.35);
  const capsule = maillage(boite(0.4, 0.4, 0.3, 0.08), 'noir');
  capsule.position.set(1.6, 0.6, 3.68);
  disa.add(corpsDisa, capsule);

  // --- Papillon motorisé (MDK, à l'avant du plénum) ---
  const papillon = ajouter(piece('papillon', 'Papillon motorisé', 'mdk', [-1.4, 1.4, 2.3]));
  const corpsPap = maillage(cylindre(0.36, 0.5), 'alu');
  corpsPap.rotation.z = Math.PI / 2;
  corpsPap.position.set(-3.5, 0.6, 2.85);
  const moteurPap = maillage(boite(0.35, 0.35, 0.5, 0.08), 'noir');
  moteurPap.position.set(-3.5, 1.0, 2.85);
  papillon.add(corpsPap, moteurPap);

  // --- Collecteurs d'échappement (2 × 3 cylindres) ---
  const collEch = ajouter(piece('collecteurEch', "Collecteurs d'échappement", 'echappement', [0, 0.6, -2.3]));
  [[0, 1, 2], [3, 4, 5]].forEach((groupe) => {
    const xFin = (X_CYL[groupe[0]] + X_CYL[groupe[2]]) / 2;
    groupe.forEach((i) => {
      const courbe = new THREE.CatmullRomCurve3([
        new THREE.Vector3(X_CYL[i], 1.55, -1.18),
        new THREE.Vector3(X_CYL[i], 1.2, -1.8),
        new THREE.Vector3((X_CYL[i] + xFin) / 2, 0.5, -2.0),
        new THREE.Vector3(xFin, -0.3, -2.0)
      ]);
      collEch.add(maillage(new THREE.TubeGeometry(courbe, 24, 0.15, 12, false), 'echappement'));
    });
    const descente = maillage(cylindre(0.22, 1.4), 'echappement');
    descente.position.set(xFin, -1.0, -2.0);
    collEch.add(descente);
  });

  // --- Sondes lambda (2 amont, 2 aval) ---
  const sondes = ajouter(piece('sondes', 'Sondes lambda ×4', 'lambda', [0, 0.2, -3.2]));
  [X_CYL[1], X_CYL[4]].forEach((x) => {
    [-0.5, -1.4].forEach((y) => {
      const s = maillage(cylindre(0.07, 0.4), 'cuivre');
      s.rotation.x = Math.PI / 2;
      s.position.set(x + 0.3, y, -2.3);
      sondes.add(s);
    });
  });

  // --- Pompe à eau ---
  const pompeEau = ajouter(piece('pompeEau', 'Pompe à eau', 'refroidissement', [-1.6, 0.6, 0]));
  const corpsPompe = maillage(cylindre(0.38, 0.4), 'alu');
  corpsPompe.rotation.z = Math.PI / 2;
  corpsPompe.position.set(-3.7, 0.5, 0.4);
  pompeEau.add(corpsPompe);

  // --- Poulies et courroie (façade avant) ---
  const poulies = ajouter(piece('poulies', 'Poulies et courroie', 'refroidissement', [-2.4, 0, 0]));
  const positionsPoulies = [[-1.0, 0, 0.62], [0.5, 0.4, 0.42], [0.2, -0.75, 0.3], [-0.2, 1.2, 0.36]];
  positionsPoulies.forEach(([y, z, r]) => {
    const p = maillage(cylindre(r, 0.18, 40), 'acier');
    p.rotation.z = Math.PI / 2;
    p.position.set(-4.0, y, z);
    poulies.add(p);
  });
  const trajet = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.0, -1.62, 0), new THREE.Vector3(-4.0, -1.0, -0.62),
    new THREE.Vector3(-4.0, 0.2, -1.05), new THREE.Vector3(-4.0, 1.4, 0.0),
    new THREE.Vector3(-4.0, 0.9, 0.82), new THREE.Vector3(-4.0, -0.4, 0.62)
  ], true);
  const courroie = maillage(new THREE.TubeGeometry(trajet, 80, 0.05, 8, true), 'caoutchouc');
  poulies.add(courroie);

  // --- Thermostat (boîtier à l'avant de la culasse) ---
  const thermostat = ajouter(piece('thermostat', 'Thermostat piloté', 'thermostat', [-1.2, 1.4, -0.6]));
  const corpsTh = maillage(cylindre(0.24, 0.4), 'violet');
  corpsTh.position.set(-3.6, 1.35, -0.75);
  thermostat.add(corpsTh);

  // --- Reniflard (CCV) ---
  const ccv = ajouter(piece('ccv', 'Reniflard (CCV)', 'ccv', [0.6, -0.8, 1.6]));
  const corpsCcv = maillage(cylindre(0.28, 0.6), 'noir');
  corpsCcv.position.set(2.2, -0.2, 1.4);
  ccv.add(corpsCcv);

  // --- Pompe à air secondaire ---
  const pompeAir = ajouter(piece('pompeAir', 'Pompe à air secondaire', 'airsecondaire', [-1.0, -0.6, -1.4]));
  const corpsAir = maillage(cylindre(0.3, 0.5), 'plastique');
  corpsAir.rotation.x = Math.PI / 2;
  corpsAir.position.set(-3.3, -0.4, -1.9);
  pompeAir.add(corpsAir);

  // --- Calculateur MS43 (DME), représenté à côté du moteur ---
  const dme = ajouter(piece('dme', 'Calculateur MS43', 'gestion', [1.2, 1.4, 1.2]));
  const boitierDme = maillage(boite(1.0, 0.25, 0.75, 0.05), 'alu');
  boitierDme.position.set(4.2, 2.0, 1.8);
  const connecteur = maillage(boite(0.6, 0.16, 0.2, 0.04), 'noir');
  connecteur.position.set(4.2, 2.06, 1.4);
  dme.add(boitierDme, connecteur);

  moteur.position.y = 0.2;
  // Pièces animées (gardées hors de userData, qui est copié lors des clonages)
  const mecanique = { arbre: arbre, cames: aac.children.slice() };
  return { moteur: moteur, pieces: pieces, mecanique: mecanique };
}

// Pièces montrées dans la mini-maquette de chaque fiche
const PIECES_PAR_FICHE = {
  cycle: ['bloc', 'pistons', 'vilebrequin'],
  admission: ['collecteurAdm', 'disa', 'papillon'],
  carburant: ['rampe'],
  allumage: ['bobines'],
  distribution: ['aac', 'vanos'],
  echappement: ['collecteurEch', 'sondes'],
  refroidissement: ['pompeEau', 'poulies', 'thermostat'],
  lubrification: ['carter', 'vilebrequin'],
  ccv: ['ccv', 'cache'],
  gestion: ['dme', 'bobines', 'rampe'],
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
    soleil.shadow.mapSize.set(1024, 1024);
    Object.assign(soleil.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
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
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(-11, 7, 13);

  // Sol qui ne montre que l'ombre
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.14 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -2.6;
  sol.receiveShadow = true;
  scene.add(sol);

  const { moteur, pieces, mecanique } = construireMoteur();
  scene.add(moteur);
  window.MoteurM54 = { pieces: pieces };

  // Contrôles : glisser pour tourner, rotation automatique, pas de zoom (ne gêne pas le scroll)
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = !mouvementReduit;
  controles.enableZoom = false;
  controles.enablePan = false;
  controles.autoRotate = !mouvementReduit;
  controles.autoRotateSpeed = 0.8;
  controles.target.set(0, 0.8, 0);
  controles.minPolarAngle = 0.35;
  controles.maxPolarAngle = 1.75;
  // Sur écran tactile : un doigt fait défiler la page, deux doigts font tourner le moteur
  controles.touches = { ONE: null, TWO: THREE.TOUCH.ROTATE };
  rendu.domElement.style.touchAction = 'pan-y';

  /* ---------- Cadrage : en vue éclatée, la caméra recule et vise plus haut ---------- */
  let zoomBase = 1;
  function cadrer() {
    const t = eclate * eclate * (3 - 2 * eclate);
    camera.zoom = zoomBase * (1 - 0.42 * t);
    controles.target.y = 0.8 + 1.7 * t;
    camera.updateProjectionMatrix();
  }

  /* ---------- Taille ---------- */
  function redimensionner() {
    const l = zoneScene.clientWidth, h = zoneScene.clientHeight;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    // Recul de la caméra pour que le moteur tienne aussi en portrait
    zoomBase = Math.min(1, camera.aspect / 1.2 + 0.2);
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

  function animerMecanique(dt) {
    angle += dt * 2.2;
    mecanique.arbre.rotation.x = angle;
    pieces.pistons.children.forEach((p) => {
      p.position.y = 0.4 + Math.cos(angle + p.userData.phase) * COURSE;
    });
    // Les arbres à cames tournent deux fois moins vite que le vilebrequin
    mecanique.cames.forEach((c) => { c.rotation.x = angle / 2; });
  }

  function image() {
    enCours = false;
    const dt = Math.min(horloge.getDelta(), 0.05);
    if (!mouvementReduit) animerMecanique(dt);
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
if (cadre && webglDisponible()) {
  try {
    const pieces = demarrer();
    brancherMiniMaquette(pieces);
  } catch (e) {
    // Échec (pilote graphique…) : le message de repli reste affiché
    cadre.classList.remove('est-pret');
  }
}
