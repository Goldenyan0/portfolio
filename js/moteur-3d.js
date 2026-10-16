/* ==========================================================================
   moteur-3d.js — ma BMW E39 520i (M54B22) en 3D : moteur, transmission, châssis
   et carrosserie, aux proportions réelles (maquette expérimentale)
   - Échelle : l'entraxe des cylindres du M54 (91 mm) sert de référence ;
     empattement, voies, pneus 225/55 R16 et gabarit de caisse sont ceux d'une E39
   - Moteur : bloc, pistons et bielles, vilebrequin, culasse, 24 soupapes, arbres à
     cames, double VANOS, bougies, bobines, injection, admission, échappement,
     pompe à eau, thermostat, radiateur, courroie, lubrification...
   - Transmission (propulsion) : volant moteur, embrayage, boîte manuelle,
     arbre de transmission, pont arrière, demi-arbres, roues motrices
   - Carburant : réservoir, pompe immergée AEM 340, filtre-régulateur, durites
   - Boutons : vue éclatée (voiture comprise), voiture affichée / masquée,
     mode accélération (pièces animées selon le régime), fluides animés + légende
   - Zoom à la molette (après un clic dans la vue) ou au pincement, boutons + / −
   - Survol : nom de la pièce ; clic : ouverture de la fiche correspondante
   - Mini-maquette 3D dans chaque fiche ouverte (événement "fiche:ouverte")
   Librairie : Three.js (importée via l'importmap de e39.html).
   Mouvement réduit : pas de rotation automatique, pas de mécanique ni de fluides
   animés, mode accélération désactivé, vue éclatée sans transition.
   ========================================================================== */

// Three.js est importé dynamiquement (voir "Démarrage") : si le chargement échoue,
// on peut l'attraper et afficher la vraie cause au lieu d'une page muette.
let THREE, OrbitControls, RoomEnvironment, RoundedBoxGeometry, mergeGeometries;

const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cadre = document.getElementById('moteur3d');
const zoneScene = document.getElementById('moteur-scene');
const zoneEtiquettes = document.getElementById('moteur-etiquettes');
const zoneSurvol = document.getElementById('moteur-survol');
const boutonEclate = document.getElementById('bouton-eclate');
const boutonVoiture = document.getElementById('bouton-voiture');
const boutonAcceleration = document.getElementById('bouton-acceleration');
const boutonFluides = document.getElementById('bouton-fluides');
const panneauSimulation = document.getElementById('moteur-simulation');
const legendeFluides = document.getElementById('moteur-fluides');

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
// sert aux pièces ouvertes ou transparentes, dont on voit aussi l'intérieur.
const MATERIAUX = {
  fonte: { color: 0x9aa0aa, metalness: 0.55, roughness: 0.45, transparent: true, opacity: 0.42, depthWrite: false },
  alu: { color: 0xcfd3da, metalness: 0.8, roughness: 0.3 },
  aluOuvert: { color: 0xcfd3da, metalness: 0.8, roughness: 0.3, side: 2 },
  aluVitre: { color: 0xc4c9d1, metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.5, depthWrite: false },
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
  radiateur: { color: 0x9aa1ab, metalness: 0.7, roughness: 0.45 },
  reservoir: { color: 0x3a3a44, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.4, depthWrite: false, side: 2 },
  vase: { color: 0xf1f1ee, metalness: 0, roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false },
  liquide: { color: 0x0891b2, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.8 },
  violet: { color: 0x7c3aed, metalness: 0.3, roughness: 0.35 },
  cuivre: { color: 0xc07a45, metalness: 0.9, roughness: 0.3 },
  // Carrosserie : bleu topaze métallisé, en transparence pour voir la mécanique
  peinture: { color: 0x1f3d86, metalness: 0.55, roughness: 0.28, transparent: true, opacity: 0.5, depthWrite: false, side: 2 },
  vitre: { color: 0x9db3c9, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false, side: 2 },
  optique: { color: 0xe8eef5, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false },
  feuRouge: { color: 0xc81e1e, metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.85 },
  feuBlanc: { color: 0xf3f4f6, metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.85 },
  angelEyes: { color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: 0.9, metalness: 0, roughness: 0.4 },
  garniture: { color: 0x1c1c22, metalness: 0.1, roughness: 0.6 }
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
  m.userData.mat = nomMateriau;
  if (MATERIAUX[nomMateriau].emissive) {
    m.userData.emissif = MATERIAUX[nomMateriau].emissive;
    m.userData.intensite = MATERIAUX[nomMateriau].emissiveIntensity;
  }
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
const tubeOuvert = (r, h, seg) => new THREE.CylinderGeometry(r, r, h, seg || 40, 1, true);
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
const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);

// Tuyau courbe passant par une liste de points [x, y, z]
function tuyau(points, r, nomMateriau, options) {
  const o = options || {};
  const courbe = new THREE.CatmullRomCurve3(points.map(v3), !!o.ferme, 'centripetal');
  const geo = new THREE.TubeGeometry(courbe, o.segments || Math.max(24, Math.round(courbe.getLength() * 4)), r, o.cotes || 12, !!o.ferme);
  return maillage(geo, nomMateriau);
}

// Cylindre droit entre deux points (barre, bras de suspension...)
function barre(a, b, r, nomMateriau) {
  const debut = v3(a), dir = v3(b).sub(debut);
  const m = maillage(cylindre(r, dir.length(), 16), nomMateriau);
  m.position.copy(debut).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
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

// Trajet d'une courroie (plan YZ) : brins tangents aux poulies + arcs d'enroulement.
// poulies : [{ z, y, r, dos }] dans l'ordre de parcours (sens trigonométrique dans le
// repère (z, y)) ; dos = galet qui appuie sur le dos de la courroie (hors de la boucle).
function trajetCourroie(poulies, pas) {
  const n = poulies.length;
  const rho = poulies.map((p) => (p.dos ? -p.r : p.r));
  const brins = [];
  for (let i = 0; i < n; i++) {
    const a = poulies[i], b = poulies[(i + 1) % n], j = (i + 1) % n;
    const L = Math.hypot(b.z - a.z, b.y - a.y);
    const phi = Math.atan2(b.y - a.y, b.z - a.z) - Math.asin((rho[j] - rho[i]) / L);
    const nz = -Math.sin(phi), ny = Math.cos(phi);       // normale à gauche du brin
    brins.push([[a.z - rho[i] * nz, a.y - rho[i] * ny], [b.z - rho[j] * nz, b.y - rho[j] * ny]]);
  }
  const points = [];
  for (let i = 0; i < n; i++) {
    const p = poulies[i];
    const entree = brins[(i - 1 + n) % n][1], sortie = brins[i][0];
    const a0 = Math.atan2(entree[1] - p.y, entree[0] - p.z);
    let d = Math.atan2(sortie[1] - p.y, sortie[0] - p.z) - a0;
    // Poulie enroulée : on tourne dans le sens trigonométrique ; galet de dos : sens inverse
    if (rho[i] > 0) { while (d < 0) d += Math.PI * 2; } else { while (d > 0) d -= Math.PI * 2; }
    const k = Math.max(2, Math.ceil(Math.abs(d) * p.r / pas));
    for (let s = 0; s <= k; s++) {
      const a = a0 + d * s / k;
      points.push([p.z + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r]);
    }
    const [t1, t2] = brins[i];
    const kb = Math.max(1, Math.ceil(Math.hypot(t2[0] - t1[0], t2[1] - t1[1]) / pas));
    for (let s = 1; s < kb; s++) points.push([t1[0] + (t2[0] - t1[0]) * s / kb, t1[1] + (t2[1] - t1[1]) * s / kb]);
  }
  return points;
}

// Ruban plat fermé (courroie) qui suit des points [z, y] dans le plan x
function ruban(points, x, largeur, epaisseur, nomMateriau) {
  const n = points.length, pos = [], idx = [];
  points.forEach((p, i) => {
    const a = points[(i - 1 + n) % n], b = points[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tz = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    const nz = ty, ny = -tz;                             // normale extérieure de la boucle
    [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sn]) => {
      pos.push(x + sx * largeur / 2, p[1] + ny * sn * epaisseur / 2, p[0] + nz * sn * epaisseur / 2);
    });
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(i * 4 + k, i * 4 + k2, j * 4 + k2, i * 4 + k, j * 4 + k2, j * 4 + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return maillage(g, nomMateriau);
}


/* ==========================================================================
   2. Échelle et implantation (cotes réelles d'une E39 berline)
   Repère : X le long de la voiture (avant vers -X), Y vers le haut,
   Z vers la gauche de la voiture (admission à gauche, échappement à droite).
   1 unité = 1,05 / 91 mm⁻¹ : l'entraxe des cylindres du M54 (91 mm) vaut 1,05.
   ========================================================================== */
const U = 1.05 / 91;                      // unités par millimètre
const mm = (v) => v * U;
const ENTRAXE = 1.05;                                            // distance entre deux cylindres
const X_CYL = [0, 1, 2, 3, 4, 5].map(i => (i - 2.5) * ENTRAXE);  // position X des 6 cylindres
// Déphasage de chaque maneton : ordre d'allumage 1-5-3-6-2-4 (combustion tous les 120°)
const PHASES = [0, 240, 120, 120, 240, 0].map(d => d * Math.PI / 180);
// Angle vilebrequin (sur 720°) de la combustion de chaque cylindre, dans l'ordre 1-5-3-6-2-4
const COMBUSTION = [0, 480, 240, 600, 120, 360].map(d => d * Math.PI / 180);
const R_MANIV = 0.42;     // rayon de manivelle : course 72 mm
const L_BIELLE = 1.55;    // entraxe de bielle : 135 mm
const R_PISTON = 0.45;    // alésage 80 mm
const Y_VILO = -1.0;      // hauteur de l'axe du vilebrequin
const LEVEE = 0.09;       // levée maxi des soupapes (= bossage des cames)
const Y_SOL = Y_VILO - mm(390);           // axe du vilebrequin à environ 39 cm du sol
const R_PNEU = mm(327);                   // 225/55 R16 : diamètre 654 mm
const L_PNEU = mm(225);
const R_JANTE = mm(203);                  // jante 16 pouces
const Y_ROUE = Y_SOL + R_PNEU;            // axe des roues
const X_AV = -2.0;                        // essieu avant, entre les cylindres 1 et 2
const X_AR = X_AV + mm(2830);             // empattement 2 830 mm
const Z_AV = mm(1512 / 2);                // demi-voie avant
const Z_AR = mm(1526 / 2);                // demi-voie arrière
const X_CAISSE = X_AV - mm(860);          // pare-chocs avant (porte-à-faux avant 860 mm)
// Conversion des cotes de carrosserie (mm depuis l'avant et depuis le sol)
const caisseX = (v) => X_CAISSE + mm(v);
const caisseY = (v) => Y_SOL + mm(v);
// Ligne d'arbre : sortie de boîte → palier central → pignon d'attaque du pont
const P_BOITE = [10.95, Y_VILO, 0];
const P_PALIER = [19.3, -1.38, 0];
const P_PONT = [X_AR - 2.6, -1.66, 0];

// Calage des cames : la soupape d'admission est grande ouverte 90° après le PMH
// de fin d'échappement, celle d'échappement 90° avant (en angle vilebrequin).
const calageAdmission = (i) => Math.PI - (COMBUSTION[i] + Math.PI * 2.5) / 2;
const calageEchappement = (i) => Math.PI - (COMBUSTION[i] + Math.PI * 1.5) / 2;

// Groupes animés : on ne les fusionne pas avec le reste de leur pièce (voir fusionner)
const ANIMES = new Set();
const anime = (g) => { ANIMES.add(g); return g; };

function piece(id, nom, fiche, eclate, carrosserie) {
  const g = new THREE.Group();
  g.name = id;
  g.userData = { piece: true, id: id, nom: nom, fiche: fiche || null, eclate: new THREE.Vector3(...eclate), carrosserie: !!carrosserie };
  return g;
}


/* ==========================================================================
   3. Construction de la maquette
   Chaque pièce est un THREE.Group avec :
   - userData.nom : libellé français
   - userData.fiche : fiche ouverte au clic (null si aucune fiche)
   - userData.eclate : déplacement en vue éclatée
   ========================================================================== */
function construireMaquette() {
  ANIMES.clear();
  const racine = new THREE.Group();
  const pieces = {};
  const ajouter = (g) => { pieces[g.name] = g; racine.add(g); return g; };
  // Références des pièces animées (gardées hors de userData, qui est copié lors des clonages)
  const meca = { equipages: [], cames: [], soupapes: [], tournants: [] };
  const tourne = (objet, vitesse, rapport, axe) => {
    anime(objet);
    meca.tournants.push({ objet: objet, vitesse: vitesse, rapport: rapport, axe: axe || 'x' });
    return objet;
  };


  /* ---------------- Bas moteur ---------------- */

  // --- Bloc moteur (semi-transparent : on voit les pistons travailler) ---
  const bloc = ajouter(piece('bloc', 'Bloc moteur', 'cycle', [0, 0, 0]));
  bloc.add(place(maillage(boite(6.9, 2.8, 2.3, 0.15), 'fonte'), 0, -0.2, 0));
  X_CYL.forEach((x) => bloc.add(place(maillage(tubeOuvert(R_PISTON + 0.02, 2.2, 32), 'fonte'), x, 0.1, 0)));
  for (let k = 0; k < 7; k++) {
    [-1.17, 1.17].forEach((z) => bloc.add(place(maillage(boite(0.14, 2.5, 0.1, 0.03), 'fonte'), (k - 3) * ENTRAXE, -0.3, z)));
  }
  // Carter de distribution (façade) et pattes de support moteur
  bloc.add(place(maillage(boite(0.1, 2.9, 2.2, 0.06), 'alu'), -3.5, -0.3, 0));
  [-1, 1].forEach((s) => bloc.add(place(maillage(boite(0.6, 0.75, 0.3, 0.06), 'alu'), -1.8, -1.25, s * 1.35)));

  // --- Pistons et bielles (posés à chaque image selon l'angle du vilebrequin) ---
  const pistons = ajouter(piece('pistons', 'Pistons et bielles ×6', 'cycle', [0, 1.9, 0]));
  X_CYL.forEach((x, i) => {
    const ensemble = new THREE.Group();
    ensemble.position.x = x;
    const piston = anime(new THREE.Group());
    piston.add(maillage(cylindre(R_PISTON, 0.4, 40), 'alu'));
    piston.add(place(maillage(cone(R_PISTON - 0.02, R_PISTON, 0.05, 40), 'alu'), 0, 0.225, 0));
    [0.17, 0.12, 0.07].forEach((y) => piston.add(place(maillage(toreY(R_PISTON + 0.002, 0.013), 'noir'), 0, y, 0)));
    piston.add(maillage(axeX(cylindre(0.08, 0.8, 16)), 'acier'));
    const bielle = anime(new THREE.Group());
    bielle.add(maillage(axeX(cylindre(0.11, 0.16, 20)), 'acier'));
    bielle.add(place(maillage(boite(0.06, L_BIELLE - 0.3, 0.17, 0.02), 'acier'), 0, -L_BIELLE / 2, 0));
    [-0.085, 0.085].forEach((z) => bielle.add(place(maillage(boite(0.14, L_BIELLE - 0.3, 0.035, 0.012), 'acier'), 0, -L_BIELLE / 2, z)));
    bielle.add(place(maillage(axeX(cylindre(0.22, 0.16, 28)), 'acier'), 0, -L_BIELLE, 0));
    [-0.18, 0.18].forEach((z) => bielle.add(place(maillage(cylindre(0.035, 0.24, 10), 'acier'), 0, -L_BIELLE - 0.06, z)));
    ensemble.add(piston, bielle);
    pistons.add(ensemble);
    meca.equipages.push({ piston: piston, bielle: bielle, phase: PHASES[i] });
  });

  // --- Vilebrequin : tourillons, manetons, bras et masses d'équilibrage (tourne) ---
  const vilebrequin = ajouter(piece('vilebrequin', 'Vilebrequin', 'cycle', [0, -1.0, 0]));
  const arbre = tourne(new THREE.Group(), 'moteur', 1);
  arbre.position.y = Y_VILO;
  arbre.add(maillage(axeX(cylindre(0.12, 7.4, 20)), 'acier'));
  arbre.add(place(maillage(axeX(cylindre(0.1, 0.4, 16)), 'acier'), -3.85, 0, 0));
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

  // --- Carter d'huile (translucide) : bride, cuvette, puisard arrière, ailettes, vidange ---
  const carter = ajouter(piece('carter', "Carter d'huile", 'lubrification', [0, -1.8, 0]));
  carter.add(place(maillage(boite(6.8, 0.07, 2.25, 0.03), 'alu'), 0, -1.64, 0));
  carter.add(place(maillage(boite(6.6, 0.86, 2.0, 0.12), 'aluVitre'), 0, -2.07, 0));
  carter.add(place(maillage(boite(3.1, 0.92, 1.8, 0.14), 'aluVitre'), 1.75, -2.95, 0));
  for (let k = 0; k < 5; k++) carter.add(place(maillage(boite(2.9, 0.08, 0.05, 0.02), 'alu'), 1.75, -3.43, -0.6 + k * 0.3));
  carter.add(place(maillage(axeZ(cylindre(0.08, 0.08, 6)), 'acier'), 2.8, -3.1, -0.92));

  // --- Pompe à huile (dans le carter) : corps, crépine et tube d'aspiration ---
  const pompeHuile = ajouter(piece('pompeHuile', 'Pompe à huile', 'lubrification', [-0.6, -3.6, 0]));
  pompeHuile.add(place(maillage(boite(0.6, 0.5, 0.9, 0.06), 'alu'), -2.9, -1.95, 0));
  pompeHuile.add(place(maillage(denture(0.32, 18, 0.04, 0.08), 'acier'), -3.25, -1.95, 0));
  pompeHuile.add(tuyau([[-2.9, -2.2, 0], [-2.2, -2.55, 0], [0.4, -3.0, 0], [1.4, -3.15, 0]], 0.09, 'acier'));
  pompeHuile.add(place(maillage(cylindre(0.35, 0.06, 28), 'acier'), 1.6, -3.25, 0));

  // --- Filtre à huile (cartouche verticale côté admission) ---
  const filtreHuile = ajouter(piece('filtreHuile', 'Filtre à huile', 'lubrification', [-0.4, 1.6, 2.4]));
  filtreHuile.add(place(maillage(cylindre(0.36, 1.2, 32), 'alu'), -2.45, 0.4, 1.55));
  filtreHuile.add(place(maillage(cylindre(0.3, 0.12, 6), 'noir'), -2.45, 1.06, 1.55));
  filtreHuile.add(place(maillage(boite(0.5, 0.8, 0.3, 0.04), 'alu'), -2.45, 0.2, 1.24));


  /* ---------------- Haut moteur ---------------- */

  // --- Culasse : joint, paliers d'arbres à cames, puits de bougies, bossages, sortie d'eau ---
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
  culasse.add(place(maillage(axeX(cylindre(0.19, 0.22, 24)), 'alu'), -3.55, 1.85, -0.75));

  // --- Soupapes ×24 : tête, tige, ressort, coupelle et poussoir (s'ouvrent au passage des cames) ---
  const soupapes = ajouter(piece('soupapes', 'Soupapes ×24', 'distribution', [0, 3.5, 0]));
  X_CYL.forEach((x, i) => {
    [-0.18, 0.18].forEach((dx) => {
      [1, -1].forEach((cote) => {                 // 1 = admission (+Z), -1 = échappement
        const support = new THREE.Group();        // incliné vers son arbre à cames
        support.position.set(x + dx, 1.27, cote * 0.2);
        support.rotation.x = cote * 0.3;
        const mobile = anime(new THREE.Group());  // partie qui coulisse le long de l'axe
        mobile.add(maillage(cone(0.035, 0.14, 0.07, 24), 'acier'));
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
    const came = anime(new THREE.Group());
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
    came.add(place(maillage(axeX(cylindre(0.12, 0.12, 6)), 'acier'), -3.2, 0, 0));
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

  // --- Cache-culbuteurs : nervures, bouchon de remplissage d'huile (avant gauche), vis ---
  const cache = ajouter(piece('cache', 'Cache-culbuteurs', 'distribution', [0, 4.3, 0]));
  cache.add(place(maillage(boite(6.6, 0.45, 2.0, 0.18), 'noir'), 0, 2.9, 0));
  [-0.62, 0.62].forEach((z) => cache.add(place(maillage(boite(5.6, 0.08, 0.1, 0.03), 'noir'), 0.3, 3.15, z)));
  cache.add(place(maillage(cylindre(0.2, 0.12, 24), 'plastique'), -2.95, 3.18, 0.55));
  cache.add(place(maillage(boite(0.36, 0.08, 0.08, 0.03), 'plastique'), -2.95, 3.27, 0.55));
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
    bobines.add(place(maillage(cylindre(0.07, 0.56, 16), 'caoutchouc'), x, 2.38, 0));
    bobines.add(place(maillage(cylindre(0.11, 0.5, 24), 'plastique'), x, 2.9, 0));
    [2.75, 2.9, 3.05].forEach((y) => bobines.add(place(maillage(toreY(0.112, 0.012), 'noir'), x, y, 0)));
    bobines.add(place(maillage(boite(0.32, 0.18, 0.46, 0.05), 'noir'), x, 3.25, 0));
    bobines.add(place(maillage(boite(0.18, 0.14, 0.14, 0.03), 'plastique'), x, 3.27, 0.28));
  });
  bobines.add(place(maillage(axeX(cylindre(0.05, 5.8, 12)), 'plastique'), 0, 3.3, 0.42));

  // --- Cache-bobines nervuré (le capot plastique noir qui coiffe les bobines du M54) ---
  const cacheBobines = ajouter(piece('cacheBobines', 'Cache-bobines', 'allumage', [0, 8.0, 0]));
  cacheBobines.add(place(maillage(boite(5.9, 0.1, 0.95, 0.04), 'plastique'), 0.15, 3.45, 0));
  for (let k = 0; k < 9; k++) {
    const nervure = place(maillage(boite(0.06, 0.06, 0.8, 0.02), 'noir'), -2.6 + k * 0.62, 3.52, 0);
    nervure.rotation.y = 0.35;
    cacheBobines.add(nervure);
  }
  [-2.65, 2.95].forEach((x) => cacheBobines.add(place(maillage(cylindre(0.07, 0.05, 12), 'acier'), x, 3.52, 0)));


  /* ---------------- Admission d'air et carburant moteur ---------------- */

  // --- Boîte à air (avant gauche), débitmètre (MAF) et manchon vers le papillon ---
  const boiteAir = ajouter(piece('boiteAir', 'Boîte à air, débitmètre et manchon', 'admission', [-3.2, 1.0, 3.2]));
  boiteAir.add(place(maillage(boite(1.6, 1.5, 2.0, 0.18), 'plastique'), -5.4, 1.0, 4.7));
  boiteAir.add(place(maillage(boite(1.66, 0.08, 2.06, 0.03), 'noir'), -5.4, 1.4, 4.7));
  boiteAir.add(tuyau([[-6.0, 1.5, 5.2], [-6.9, 1.9, 5.3], [-7.6, 2.2, 5.4]], 0.34, 'plastique'));
  boiteAir.add(place(maillage(axeZ(cylindre(0.38, 0.8, 32)), 'noir'), -4.75, 0.8, 3.35));
  boiteAir.add(place(maillage(boite(0.22, 0.16, 0.22, 0.03), 'plastique'), -4.75, 1.22, 3.35));
  boiteAir.add(tuyau([[-4.75, 0.8, 2.95], [-4.45, 0.68, 2.86], [-3.92, 0.6, 2.85]], 0.38, 'caoutchouc', { cotes: 20 }));
  [2.98, 2.92].forEach((z, k) => boiteAir.add(place(maillage(toreZ(0.4, 0.03), 'acier'), -4.75, 0.8, z - k * 0.0)));

  // --- Rampe d'injection : tube, pattes, coupelles, valve de test ---
  const rampe = ajouter(piece('rampe', "Rampe d'injection", 'carburant', [0, 2.6, 1.6]));
  rampe.add(place(maillage(axeX(cylindre(0.09, 6.4, 20)), 'acier'), 0, 2.42, 1.06));
  [-2.1, 0, 2.1].forEach((x) => rampe.add(place(maillage(boite(0.14, 0.25, 0.08, 0.03), 'acier'), x + 0.52, 2.3, 0.98)));
  X_CYL.forEach((x) => rampe.add(place(maillage(cylindre(0.08, 0.1, 16), 'acier'), x, 2.33, 1.08)));
  rampe.add(place(maillage(cylindre(0.04, 0.14, 10), 'cuivre'), 2.9, 2.55, 1.06));

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
  for (let k = 0; k < 6; k++) {
    if (k === 2) continue;                       // place laissée libre au centre pour la DISA
    collAdm.add(place(maillage(boite(0.06, 0.95, 0.84, 0.02), 'plastique'), X_CYL[k] + 0.52, 0.6, 2.85));
  }

  // --- Volet DISA, au centre du plénum : bride, joint, corps, capsule, connecteur ---
  const disa = ajouter(piece('disa', 'Volet DISA', 'disa', [0, 2.2, 2.9]));
  disa.add(place(maillage(axeZ(cylindre(0.26, 0.06, 28)), 'alu'), 0, 0.6, 3.27));
  disa.add(place(maillage(toreZ(0.21, 0.025), 'caoutchouc'), 0, 0.6, 3.3));
  disa.add(place(maillage(axeZ(cylindre(0.19, 0.3, 28)), 'violet'), 0, 0.6, 3.45));
  disa.add(place(maillage(boite(0.44, 0.44, 0.28, 0.08), 'noir'), 0, 0.6, 3.74));
  disa.add(place(maillage(boite(0.16, 0.12, 0.12, 0.03), 'plastique'), 0, 0.87, 3.74));

  // --- Papillon motorisé (MDK, à l'avant du plénum) : corps ouvert, volet, moteur ---
  const papillon = ajouter(piece('papillon', 'Papillon motorisé', 'mdk', [-1.4, 1.4, 2.3]));
  papillon.add(place(maillage(axeX(tubeOuvert(0.36, 0.5)), 'aluOuvert'), -3.5, 0.6, 2.85));
  [-3.73, -3.27].forEach((x) => papillon.add(place(maillage(toreX(0.37, 0.035), 'alu'), x, 0.6, 2.85)));
  const volet = place(maillage(axeX(cylindre(0.33, 0.02, 40)), 'acier'), -3.5, 0.6, 2.85);
  volet.rotation.y = 0.6;                                                         // volet entrouvert
  papillon.add(volet);
  papillon.add(place(maillage(cylindre(0.025, 0.76, 10), 'acier'), -3.5, 0.6, 2.85));
  papillon.add(place(maillage(boite(0.38, 0.36, 0.55, 0.08), 'noir'), -3.5, 1.04, 2.85));
  papillon.add(place(maillage(boite(0.16, 0.14, 0.16, 0.03), 'plastique'), -3.5, 1.04, 3.2));


  /* ---------------- Échappement (proportions réelles : tubes de 47 mm) ---------------- */

  // --- Collecteurs d'échappement 3 en 1 (cylindres 1-3 et 4-6) : brides, tubes, descentes ---
  const collEch = ajouter(piece('collecteurEch', "Collecteurs d'échappement", 'echappement', [0, 0.6, -2.4]));
  [[0, 1, 2], [3, 4, 5]].forEach((groupe) => {
    const xFin = (X_CYL[groupe[0]] + X_CYL[groupe[2]]) / 2;
    groupe.forEach((i) => {
      collEch.add(place(maillage(boite(0.55, 0.42, 0.07, 0.03), 'echappement'), X_CYL[i], 1.55, -1.24));
      collEch.add(tuyau([
        [X_CYL[i], 1.55, -1.2], [X_CYL[i], 1.15, -1.85],
        [(X_CYL[i] + xFin) / 2, 0.35, -2.3], [xFin, -0.35, -2.35]
      ], 0.2, 'echappement'));
    });
    collEch.add(place(maillage(cone(0.36, 0.3, 0.35, 24), 'echappement'), xFin, -0.45, -2.35));
    collEch.add(place(maillage(cylindre(0.3, 1.8, 24), 'echappement'), xFin, -1.5, -2.35));
    collEch.add(place(maillage(cylindre(0.42, 0.07, 24), 'echappement'), xFin, -2.38, -2.35));
  });

  // --- Ligne d'échappement : 2 catalyseurs, silencieux central, silencieux arrière, sortie gauche ---
  const ligne = ajouter(piece('ligneEch', "Ligne d'échappement", 'echappement', [1.0, 0, -7.0]));
  const R_TUBE = 0.27;
  function catalyseur(x0, x1, y, z) {
    const milieu = (x0 + x1) / 2;
    ligne.add(place(maillage(axeX(cylindre(0.62, x1 - x0 - 0.5, 40)), 'echappement'), milieu, y, z));
    ligne.add(place(maillage(axeX(cone(R_TUBE, 0.62, 0.25, 40)), 'echappement'), x0 + 0.125, y, z));
    ligne.add(place(maillage(axeX(cone(0.62, R_TUBE, 0.25, 40)), 'echappement'), x1 - 0.125, y, z));
    [-0.7, 0, 0.7].forEach((d) => ligne.add(place(maillage(toreX(0.625, 0.025), 'acier'), milieu + d, y, z)));
  }
  [X_CYL[1], X_CYL[4]].forEach((x) => ligne.add(place(maillage(cylindre(0.42, 0.07, 24), 'echappement'), x, -2.46, -2.35)));
  // Banc 1 (cylindres 1-3) : descente, catalyseur, puis tube vers le silencieux central
  ligne.add(tuyau([[X_CYL[1], -2.45, -2.35], [-1.45, -2.85, -2.2], [-1.0, -3.0, -1.85], [-0.55, -3.0, -1.75]], R_TUBE, 'echappement'));
  catalyseur(-0.55, 2.45, -3.0, -1.75);
  ligne.add(tuyau([[2.45, -3.0, -1.75], [3.1, -3.02, -1.35], [6.5, -3.1, -1.3], [10.5, -3.3, -1.45], [12.6, -3.38, -1.7]], R_TUBE, 'echappement'));
  // Banc 2 (cylindres 4-6)
  ligne.add(tuyau([[X_CYL[4], -2.45, -2.35], [1.9, -2.62, -2.4], [2.6, -2.95, -2.4], [3.1, -3.0, -2.4]], R_TUBE, 'echappement'));
  catalyseur(3.1, 6.1, -3.0, -2.4);
  ligne.add(tuyau([[6.1, -3.0, -2.4], [9.0, -3.2, -2.45], [12.6, -3.38, -2.3]], R_TUBE, 'echappement'));
  // Silencieux central ovale (les deux lignes s'y rejoignent)
  const central = place(maillage(axeX(cylindre(0.6, 6.0, 40)), 'echappement'), 15.5, -3.4, -2.0);
  central.scale.set(1, 0.9, 1.6);
  ligne.add(central);
  [12.5, 18.5].forEach((x) => {
    const cerclage = place(maillage(toreX(0.6, 0.04), 'acier'), x, -3.4, -2.0);
    cerclage.scale.set(1, 0.9, 1.6);
    ligne.add(cerclage);
  });
  // Tube unique jusqu'au silencieux arrière, sous le réservoir et à côté du pont
  ligne.add(tuyau([[18.5, -3.4, -2.0], [22.0, -3.5, -2.2], [27.0, -3.55, -2.35], [31.0, -3.55, -2.4], [34.2, -3.35, -2.6], [35.0, -3.15, -2.75]], R_TUBE, 'echappement'));
  // Silencieux arrière transversal, sortie unique à gauche, coudée vers le sol (cachée sous le pare-chocs)
  const arriere = place(maillage(axeZ(cylindre(0.6, 8.6, 40)), 'echappement'), 36.0, -3.0, 0.7);
  arriere.scale.set(1.9, 1.05, 1);
  ligne.add(arriere);
  ligne.add(tuyau([[37.0, -3.1, 4.4], [40.0, -3.25, 4.6], [41.6, -3.45, 4.6], [42.3, -3.8, 4.6]], R_TUBE, 'echappement'));
  const embout = place(maillage(tubeOuvert(0.34, 0.6, 32), 'aluOuvert'), 42.45, -3.95, 4.6);
  embout.rotation.z = 0.5;
  ligne.add(embout);
  // Silentblocs de suspension de ligne
  [[13.0, -2.0], [18.0, -2.0], [35.5, -3.2], [36.5, 4.6]].forEach(([x, z]) => {
    ligne.add(place(maillage(cylindre(0.12, 0.5, 12), 'caoutchouc'), x, -2.5, z));
  });

  // --- Sondes lambda (2 amont sur les descentes, 2 aval après les catalyseurs) ---
  const sondes = ajouter(piece('sondes', 'Sondes lambda ×4', 'lambda', [0, 0.4, -4.0]));
  function sonde() {
    const s = new THREE.Group();
    s.add(maillage(cylindre(0.06, 0.18, 12), 'cuivre'));
    s.add(place(maillage(cylindre(0.11, 0.1, 6), 'acier'), 0, 0.13, 0));
    s.add(place(maillage(cylindre(0.07, 0.27, 12), 'acier'), 0, 0.31, 0));
    s.add(tuyau([[0, 0.45, 0], [0, 0.75, 0], [0.22, 0.93, 0.07], [0.6, 0.99, 0.15]], 0.03, 'caoutchouc'));
    return s;
  }
  [X_CYL[1], X_CYL[4]].forEach((x) => {
    const amont = place(sonde(), x + 0.05, -1.3, -2.62);
    amont.rotation.x = -Math.PI / 2;                                              // couchée, vers l'extérieur
    sondes.add(amont);
  });
  sondes.add(place(sonde(), 3.6, -2.75, -1.32));
  sondes.add(place(sonde(), 6.6, -2.75, -2.43));


  /* ---------------- Façade : courroie, pompe à eau, thermostat, ventilateur ---------------- */

  // Poulies de la courroie d'accessoires (vues de face, plan YZ) dans l'ordre de parcours
  const X_COURROIE = -4.05;
  const POULIES = [
    { id: 'vilebrequin', z: 0, y: -1.0, r: 0.95 },
    { id: 'tendeur', z: 1.45, y: -1.2, r: 0.4, dos: true },
    { id: 'alternateur', z: 1.9, y: 0.0, r: 0.36 },
    { id: 'pompe', z: 0, y: 0.8, r: 0.65 },
    { id: 'direction', z: -2.0, y: -0.4, r: 0.7 }
  ];

  // --- Pompe à eau : bride, volute ouverte, turbine à aubes (tourne), arbre ---
  const pompeEau = ajouter(piece('pompeEau', 'Pompe à eau', 'refroidissement', [-1.8, 0.6, 0.4]));
  const pe = new THREE.Group();
  pe.position.set(-3.7, 0.8, 0);
  pompeEau.add(pe);
  pe.add(place(maillage(boite(0.08, 0.95, 1.0, 0.06), 'alu'), 0.16, 0, 0));
  [[0.38, 0.4], [0.38, -0.4], [-0.38, 0.4], [-0.38, -0.4]].forEach(([y, z]) => {
    pe.add(place(maillage(axeX(cylindre(0.06, 0.12, 12)), 'alu'), 0.1, y, z));
  });
  // Corps ouvert côté visible pour montrer la turbine
  pe.add(place(maillage(axeX(coque(0.4, 0.4, 0.3, 1.8)), 'aluOuvert'), -0.03, 0, 0));
  const volute = place(maillage(toreX(0.43, 0.08, Math.PI * 2 - 1.8), 'alu'), -0.03, 0, 0);
  volute.rotation.x = Math.PI + 0.9;                                              // spirale ouverte du même côté
  pe.add(volute);
  pe.add(place(maillage(axeX(cylindre(0.4, 0.03, 40)), 'alu'), 0.11, 0, 0));
  pe.add(place(maillage(axeX(cone(0.12, 0.18, 0.12, 24)), 'alu'), -0.22, 0, 0));
  pe.add(place(maillage(axeX(cylindre(0.045, 0.3, 12)), 'acier'), -0.32, 0, 0));
  const turbine = tourne(new THREE.Group(), 'moteur', 0.95 / 0.65);
  turbine.position.x = -0.03;
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

  // --- Thermostat piloté : boîtier vissé sur la façade du bloc, contre la pompe à eau ---
  const thermostat = ajouter(piece('thermostat', 'Thermostat piloté', 'thermostat', [-1.6, -0.6, -1.4]));
  const th = new THREE.Group();
  th.position.set(-3.6, 0.25, -0.75);
  thermostat.add(th);
  th.add(place(maillage(boite(0.08, 0.7, 0.7, 0.04), 'alu'), -0.02, 0, 0));        // bride vissée sur le bloc
  autour(3, (a) => th.add(place(maillage(axeX(cylindre(0.04, 0.06, 6)), 'acier'), -0.08, Math.sin(a) * 0.27, Math.cos(a) * 0.27)));
  th.add(place(maillage(axeX(cylindre(0.26, 0.28, 32)), 'violet'), -0.2, 0, 0));
  th.add(place(maillage(axeX(cylindre(0.29, 0.04, 32)), 'alu'), -0.34, 0, 0));
  th.add(tuyau([[-0.2, -0.2, -0.05], [-0.18, -0.32, -0.1], [-0.18, -0.36, -0.12]], 0.13, 'alu'));   // entrée (retour radiateur)
  th.add(tuyau([[-0.12, 0.1, 0.2], [-0.1, 0.3, 0.45], [-0.08, 0.5, 0.62]], 0.1, 'alu'));             // vers la pompe à eau
  th.add(place(maillage(boite(0.14, 0.12, 0.16, 0.03), 'noir'), -0.22, 0.3, -0.08));                 // connecteur de la résistance

  // --- Poulies (multi-gorges, galet tendeur) et courroie enroulée sur chacune ---
  const poulies = ajouter(piece('poulies', 'Poulies et courroie', 'refroidissement', [-2.4, 0, 0]));
  POULIES.forEach((p) => {
    const g = tourne(new THREE.Group(), 'moteur', 0.95 / p.r * (p.dos ? -1 : 1));
    g.position.set(X_COURROIE, p.y, p.z);
    if (p.dos) {
      // Galet tendeur lisse, sur son bras articulé
      g.add(maillage(axeX(cylindre(p.r, 0.26, 40)), 'acier'));
      g.add(place(maillage(axeX(cylindre(p.r * 0.4, 0.3, 20)), 'alu'), 0, 0, 0));
      poulies.add(place(maillage(boite(0.14, 0.2, 1.0, 0.04), 'alu'), X_COURROIE + 0.2, p.y + 0.15, p.z - 0.35));
    } else {
      g.add(maillage(axeX(cylindre(p.r, 0.26, 48)), 'acier'));
      [-0.07, 0, 0.07].forEach((dx) => g.add(place(maillage(toreX(p.r + 0.006, 0.016), 'acier'), dx, 0, 0)));
      g.add(place(maillage(axeX(cylindre(p.r * 0.35, 0.32, 24)), 'alu'), -0.02, 0, 0));
      autour(4, (a) => g.add(place(maillage(axeX(cylindre(0.035, 0.05, 6)), 'acier'), -0.17, Math.sin(a) * p.r * 0.22, Math.cos(a) * p.r * 0.22)));
    }
    if (p.id === 'vilebrequin') {
      // Amortisseur de vibrations : bague caoutchouc entre deux flasques
      g.add(place(maillage(axeX(cylindre(p.r * 0.8, 0.06, 48)), 'caoutchouc'), 0.17, 0, 0));
      g.add(place(maillage(axeX(cylindre(p.r * 0.96, 0.08, 48)), 'acier'), 0.24, 0, 0));
    }
    poulies.add(g);
  });
  poulies.add(ruban(trajetCourroie(POULIES, 0.06), X_COURROIE, 0.24, 0.06, 'caoutchouc'));

  // --- Ventilateur et visco-coupleur, montés sur la poulie de pompe à eau (tourne) ---
  const ventilateur = ajouter(piece('ventilateur', 'Ventilateur et visco-coupleur', 'refroidissement', [-3.4, 0, 0]));
  const vent = tourne(new THREE.Group(), 'moteur', 0.95 / 0.65 * 0.85);
  vent.position.set(-4.5, 0.8, 0);
  ventilateur.add(vent);
  vent.add(maillage(axeX(cylindre(0.5, 0.36, 32)), 'alu'));
  [-0.1, 0, 0.1].forEach((dx) => vent.add(place(maillage(toreX(0.5, 0.025), 'alu'), dx, 0, 0)));
  vent.add(place(maillage(axeX(cylindre(0.62, 0.08, 40)), 'plastique'), -0.24, 0, 0));
  autour(9, (a) => {
    const bras = new THREE.Group();
    bras.rotation.x = a;
    const pale = place(maillage(boite(0.06, 1.35, 0.5, 0.03), 'plastique'), -0.26, 1.25, 0);
    pale.rotation.y = 0.45;
    bras.add(pale);
    vent.add(bras);
  });

  // --- Alternateur (entraîné par la courroie) ---
  const alternateur = ajouter(piece('alternateur', 'Alternateur', null, [-1.6, 0, 2.4]));
  alternateur.add(place(maillage(axeX(cylindre(0.5, 1.0, 32)), 'alu'), -3.4, 0, 1.9));
  [-3.7, -3.5, -3.3, -3.1].forEach((x) => alternateur.add(place(maillage(toreX(0.5, 0.025), 'alu'), x, 0, 1.9)));
  alternateur.add(place(maillage(axeX(cylindre(0.38, 0.12, 24)), 'noir'), -2.86, 0, 1.9));
  alternateur.add(place(maillage(boite(0.5, 0.2, 0.4, 0.04), 'alu'), -3.3, -0.5, 1.45));

  // --- Pompe de direction assistée (entraînée par la courroie) ---
  const pompeDA = ajouter(piece('pompeDA', 'Pompe de direction assistée', null, [-1.6, -0.4, -2.4]));
  pompeDA.add(place(maillage(axeX(cylindre(0.5, 0.9, 32)), 'alu'), -3.45, -0.4, -2.0));
  pompeDA.add(place(maillage(cylindre(0.3, 0.55, 24), 'noir'), -3.4, 0.35, -2.0));
  pompeDA.add(tuyau([[-3.2, -0.8, -2.0], [-3.2, -1.6, -2.3], [-3.3, -1.95, -2.6]], 0.07, 'caoutchouc'));

  // --- Pompe à air secondaire (à l'avant droit, durite vers la culasse) ---
  const pompeAir = ajouter(piece('pompeAir', 'Pompe à air secondaire', 'airsecondaire', [-2.4, -0.4, -2.6]));
  const pa = new THREE.Group();
  pa.position.set(-5.6, -1.4, -4.8);
  pompeAir.add(pa);
  pa.add(maillage(axeZ(cylindre(0.26, 0.45, 32)), 'noir'));
  [-0.12, 0, 0.12].forEach((z) => pa.add(place(maillage(toreZ(0.27, 0.015), 'noir'), 0, 0, z)));
  pa.add(place(maillage(axeZ(cylindre(0.3, 0.16, 32)), 'plastique'), 0, 0, 0.3));
  pa.add(place(maillage(axeZ(cylindre(0.13, 0.2, 20)), 'plastique'), 0, 0, -0.32));
  pompeAir.add(tuyau([[-5.6, -1.1, -4.5], [-4.8, 0.4, -3.6], [-3.6, 1.2, -2.6], [-3.2, 1.45, -1.5]], 0.08, 'caoutchouc'));
  pompeAir.add(place(maillage(boite(0.3, 0.3, 0.3, 0.05), 'noir'), -3.2, 1.45, -1.4));

  // --- Démarreur (côté admission, engrène sur la couronne du volant moteur) ---
  const demarreur = ajouter(piece('demarreur', 'Démarreur', null, [-0.8, -1.4, 2.2]));
  demarreur.add(place(maillage(axeX(cylindre(0.42, 1.4, 32)), 'noir'), 2.75, -1.65, 1.65));
  demarreur.add(place(maillage(axeX(cylindre(0.2, 0.8, 20)), 'acier'), 2.65, -1.12, 1.65));
  demarreur.add(place(maillage(denture(0.14, 10, 0.04, 0.12), 'acier'), 3.55, -1.65, 1.65));

  // --- Calculateur MS43 (DME), dans son boîtier à l'arrière droit du compartiment ---
  const dme = ajouter(piece('dme', 'Calculateur MS43', 'gestion', [1.0, 2.0, -1.6]));
  const d = new THREE.Group();
  d.position.set(5.8, 2.4, -5.0);
  dme.add(d);
  d.add(maillage(boite(1.0, 0.22, 0.75, 0.04), 'alu'));
  for (let k = 0; k < 7; k++) d.add(place(maillage(boite(0.9, 0.05, 0.03, 0.01), 'alu'), 0, 0.13, -0.3 + k * 0.1));
  [-0.3, 0, 0.3].forEach((x) => d.add(place(maillage(boite(0.26, 0.16, 0.18, 0.03), 'noir'), x, 0.04, 0.44)));
  dme.add(tuyau([[5.8, 2.45, -4.55], [4.6, 2.6, -3.0], [3.5, 2.5, -1.2], [2.6, 3.3, 0.42]], 0.07, 'plastique'));

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


  /* ---------------- Refroidissement ---------------- */

  // --- Radiateur : faisceau, boîtes à eau latérales, buse du ventilateur ---
  const radiateur = ajouter(piece('radiateur', 'Radiateur', 'refroidissement', [-5.2, 0, 0]));
  radiateur.add(place(maillage(boite(0.3, 5.0, 6.6, 0.04), 'radiateur'), -6.8, 0.15, 0));
  for (let k = 0; k < 14; k++) radiateur.add(place(maillage(boite(0.04, 0.05, 6.5, 0.01), 'alu'), -6.97, -2.15 + k * 0.33, 0));
  [-1, 1].forEach((s) => radiateur.add(place(maillage(boite(0.45, 5.2, 0.45, 0.1), 'plastique'), -6.8, 0.15, s * 3.52)));
  radiateur.add(place(maillage(axeX(cylindre(0.17, 0.35, 20)), 'plastique'), -6.45, 2.5, -3.3));
  radiateur.add(place(maillage(axeX(cylindre(0.17, 0.35, 20)), 'plastique'), -6.45, -2.2, 3.3));
  // Buse : plaque percée et virole autour des pales
  const plaque = new THREE.Shape();
  plaque.moveTo(-3.2, -2.3); plaque.lineTo(3.2, -2.3); plaque.lineTo(3.2, 2.6); plaque.lineTo(-3.2, 2.6); plaque.closePath();
  const trou = new THREE.Path();
  trou.absarc(0, 0.8, 2.0, 0, Math.PI * 2, true);
  plaque.holes.push(trou);
  radiateur.add(place(maillage(new THREE.ShapeGeometry(plaque, 24).rotateY(-Math.PI / 2), 'plastique'), -6.55, 0, 0));
  radiateur.add(place(maillage(axeX(tubeOuvert(2.05, 1.6, 48)), 'aluOuvert'), -5.75, 0.8, 0));

  // --- Vase d'expansion (côté droit du radiateur), avec son niveau de liquide ---
  const vase = ajouter(piece('vase', "Vase d'expansion", 'refroidissement', [-5.2, 0.8, -2.8]));
  vase.add(place(maillage(boite(0.9, 1.7, 0.8, 0.12), 'vase'), -6.6, 1.2, -4.3));
  vase.add(place(maillage(boite(0.8, 0.9, 0.7, 0.08), 'liquide'), -6.6, 0.8, -4.3));
  vase.add(place(maillage(cylindre(0.2, 0.18, 20), 'noir'), -6.6, 2.12, -4.3));

  // --- Durites de refroidissement : supérieure (culasse → radiateur), inférieure (radiateur → thermostat) ---
  const DURITE_HAUTE = [[-3.67, 1.85, -0.75], [-4.3, 2.2, -1.4], [-5.2, 2.6, -2.6], [-6.27, 2.5, -3.3]];
  const DURITE_BASSE = [[-6.27, -2.2, 3.3], [-5.5, -2.45, 1.4], [-4.4, -2.15, -1.15], [-4.3, -0.9, -1.15], [-4.0, -0.25, -1.0], [-3.78, -0.11, -0.87]];
  const durites = ajouter(piece('durites', 'Durites de refroidissement', 'refroidissement', [-3.0, 0.5, -1.0]));
  durites.add(tuyau(DURITE_HAUTE, 0.17, 'caoutchouc', { cotes: 16 }));
  durites.add(tuyau(DURITE_BASSE, 0.17, 'caoutchouc', { cotes: 16 }));
  [DURITE_HAUTE[0], DURITE_HAUTE[3], DURITE_BASSE[0]].forEach((p) => durites.add(place(maillage(toreX(0.18, 0.03), 'acier'), p[0] - 0.05, p[1], p[2])));
  durites.add(tuyau([[-6.6, 2.55, -3.6], [-6.6, 2.4, -3.95], [-6.6, 2.1, -4.0]], 0.06, 'caoutchouc'));


  /* ---------------- Transmission (propulsion, boîte manuelle) ---------------- */

  // --- Volant moteur : disque, couronne de démarreur, face d'appui, vis (tourne) ---
  const volant = ajouter(piece('volant', 'Volant moteur', 'transmission', [0.9, 0, 0]));
  const vm = tourne(new THREE.Group(), 'moteur', 1);
  vm.position.set(3.85, Y_VILO, 0);
  volant.add(vm);
  vm.add(maillage(axeX(cylindre(1.6, 0.16, 72)), 'acier'));
  vm.add(place(maillage(denture(1.62, 110, 0.07, 0.12), 'acier'), -0.02, 0, 0));
  vm.add(place(maillage(axeX(cylindre(1.4, 0.08, 64)), 'alu'), 0.11, 0, 0));
  vm.add(place(maillage(axeX(cylindre(0.45, 0.08, 32)), 'acier'), -0.11, 0, 0));
  autour(8, (a) => vm.add(place(maillage(axeX(cylindre(0.05, 0.06, 6)), 'acier'), -0.17, Math.sin(a) * 0.32, Math.cos(a) * 0.32)));
  autour(6, (a) => vm.add(place(maillage(axeX(cylindre(0.12, 0.165, 16)), 'noir'), 0, Math.sin(a) * 1.0, Math.cos(a) * 1.0)));

  // --- Embrayage : disque à garnitures et ressorts, mécanisme à diaphragme, butée ---
  const embrayage = ajouter(piece('embrayage', 'Embrayage', 'transmission', [2.0, 0, 0]));
  const disque = tourne(new THREE.Group(), 'disque', 1);
  disque.position.set(4.15, Y_VILO, 0);
  embrayage.add(disque);
  disque.add(maillage(axeX(cylindre(1.3, 0.07, 64)), 'friction'));
  disque.add(place(maillage(axeX(cylindre(0.65, 0.04, 40)), 'acier'), 0.04, 0, 0));
  autour(6, (a) => {
    const r = place(maillage(cylindre(0.06, 0.26, 10), 'violet'), 0.05, Math.cos(a) * 0.42, Math.sin(a) * 0.42);
    r.rotation.x = a + Math.PI / 2;                                               // ressorts tangents au cercle
    disque.add(r);
  });
  disque.add(place(maillage(axeX(cylindre(0.18, 0.26, 16)), 'acier'), 0.04, 0, 0));
  const mecanisme = tourne(new THREE.Group(), 'moteur', 1);
  mecanisme.position.set(4.15, Y_VILO, 0);
  embrayage.add(mecanisme);
  mecanisme.add(place(maillage(axeX(cone(1.48, 1.35, 0.26, 56)), 'acier'), 0.2, 0, 0));
  autour(18, (a) => {
    const bras = new THREE.Group();
    bras.rotation.x = a;
    bras.add(place(maillage(boite(0.03, 0.7, 0.12, 0.01), 'acier'), 0.36, 0.6, 0));
    mecanisme.add(bras);
  });
  mecanisme.add(place(maillage(axeX(cylindre(0.26, 0.18, 24)), 'alu'), 0.52, 0, 0));

  // --- Boîte de vitesses manuelle 5 rapports : cloche ouverte, carter nervuré, sortie,
  //     levier (bouge à chaque passage de rapport), traverse et récepteur d'embrayage ---
  const bv = ajouter(piece('boite', 'Boîte de vitesses manuelle', 'transmission', [3.6, 0, 0]));
  const g = new THREE.Group();
  g.position.y = Y_VILO;
  bv.add(g);
  g.add(place(maillage(axeX(coque(2.05, 1.35, 1.8, 1.8)), 'carterVitre'), 4.4, 0, 0));
  const brideCloche = place(maillage(toreX(2.05, 0.06, Math.PI * 2 - 1.8), 'alu'), 3.52, 0, 0);
  brideCloche.rotation.x = Math.PI + 0.9;
  g.add(brideCloche);
  g.add(place(maillage(axeX(cone(1.3, 1.0, 4.1, 48)), 'alu'), 7.35, 0, 0));
  for (let k = 0; k < 6; k++) g.add(place(maillage(toreX(1.29 - k * 0.058, 0.04), 'alu'), 5.6 + k * 0.7, 0, 0));
  [-1, 1].forEach((s) => g.add(place(maillage(boite(3.6, 0.12, 0.12, 0.03), 'alu'), 7.3, 0, s * 1.12)));
  g.add(place(maillage(axeX(cone(0.62, 0.45, 1.35, 32)), 'alu'), 10.08, 0, 0));
  g.add(place(maillage(axeX(cylindre(0.55, 0.1, 32)), 'acier'), 10.85, 0, 0));
  g.add(place(maillage(axeZ(cylindre(0.1, 0.1, 6)), 'acier'), 7.0, -0.7, -1.0));
  // Récepteur d'embrayage (hydraulique) et sa conduite vers le tablier
  g.add(place(maillage(axeX(cylindre(0.18, 0.6, 16)), 'alu'), 4.8, -0.3, 1.75));
  bv.add(tuyau([[5.1, -1.3, 1.75], [5.6, 0.2, 2.2], [6.6, 2.0, 2.4]], 0.04, 'acier'));
  // Traverse et support de boîte sous le carter arrière
  bv.add(place(maillage(boite(0.45, 0.22, 4.4, 0.05), 'acier'), 9.9, -2.32, 0));
  bv.add(place(maillage(cylindre(0.22, 0.6, 16), 'caoutchouc'), 9.9, -1.95, 0));
  // Commande : support, tringle de sélection et levier
  bv.add(barre([9.4, -0.5, 0], [11.6, -0.05, 0], 0.07, 'acier'));
  bv.add(barre([11.6, -0.4, 0], [9.9, -0.6, 0], 0.05, 'acier'));
  const levier = anime(new THREE.Group());
  levier.position.set(11.6, 0, 0);
  levier.add(place(maillage(cylindre(0.07, 3.4, 12), 'acier'), 0, 1.7, 0));
  levier.add(place(maillage(new THREE.SphereGeometry(0.34, 24, 16), 'noir'), 0, 3.5, 0));
  bv.add(levier);
  bv.add(place(maillage(cone(0.25, 0.6, 0.7, 24), 'caoutchouc'), 11.6, 0.9, 0));
  meca.levier = levier;

  // --- Arbre de transmission en deux tronçons : flector, palier central, cardan, brides (tourne) ---
  const arbreT = ajouter(piece('arbre', 'Arbre de transmission', 'transmission', [5.5, 0, 0]));
  function troncon(a, b) {
    const dir = v3(b).sub(v3(a));
    const pivot = new THREE.Group();
    pivot.position.copy(v3(a));
    pivot.rotation.z = Math.atan2(dir.y, dir.x);
    const rotor = tourne(new THREE.Group(), 'arbre', 1);
    pivot.add(rotor);
    arbreT.add(pivot);
    return { rotor: rotor, longueur: dir.length() };
  }
  const t1 = troncon(P_BOITE, P_PALIER);
  t1.rotor.add(place(maillage(axeX(cylindre(0.75, 0.22, 40)), 'caoutchouc'), 0.12, 0, 0));
  autour(6, (a) => t1.rotor.add(place(maillage(axeX(cylindre(0.07, 0.34, 6)), 'acier'), 0.12, Math.sin(a) * 0.55, Math.cos(a) * 0.55)));
  t1.rotor.add(place(maillage(axeX(cylindre(0.42, t1.longueur - 0.6, 32)), 'acier'), t1.longueur / 2, 0, 0));
  t1.rotor.add(place(maillage(axeX(cylindre(0.48, 0.7, 32)), 'acier'), t1.longueur - 0.45, 0, 0));
  const t2 = troncon(P_PALIER, P_PONT);
  t2.rotor.add(maillage(axeZ(cylindre(0.08, 0.6, 10)), 'acier'));                 // croisillon du cardan
  t2.rotor.add(maillage(cylindre(0.08, 0.6, 10), 'acier'));
  t2.rotor.add(place(maillage(axeX(cylindre(0.38, t2.longueur - 0.5, 32)), 'acier'), t2.longueur / 2, 0, 0));
  t2.rotor.add(place(maillage(axeX(cylindre(0.55, 0.12, 32)), 'acier'), t2.longueur - 0.06, 0, 0));
  // Palier central (fixe) : roulement en caoutchouc et sa traverse vissée sous le plancher
  arbreT.add(place(maillage(axeX(cylindre(0.62, 0.4, 32)), 'caoutchouc'), P_PALIER[0] - 0.3, P_PALIER[1], 0));
  arbreT.add(place(maillage(boite(0.3, 0.2, 2.6, 0.04), 'acier'), P_PALIER[0] - 0.3, P_PALIER[1] + 0.72, 0));

  // --- Pont arrière (différentiel) : carter, nez du pignon d'attaque, couvercle nervuré, sorties ---
  const pont = ajouter(piece('pont', 'Pont arrière (différentiel)', 'transmission', [7.5, 1.5, 0]));
  const pg = new THREE.Group();
  pg.position.set(X_AR, Y_ROUE, 0);
  pont.add(pg);
  pg.add(maillage(new THREE.SphereGeometry(1.45, 40, 28), 'alu'));
  pg.add(place(maillage(axeX(cone(0.55, 1.0, 1.4, 32)), 'alu'), -1.75, 0.07, 0));
  pg.add(place(maillage(axeX(cylindre(0.55, 0.12, 32)), 'acier'), -2.53, 0.07, 0));
  pg.add(place(maillage(axeX(cylindre(1.35, 0.25, 48)), 'alu'), 1.25, 0, 0));
  for (let k = 0; k < 5; k++) pg.add(place(maillage(boite(0.1, 1.9, 0.08, 0.02), 'alu'), 1.42, 0, -0.6 + k * 0.3));
  [-1, 1].forEach((s) => {
    pg.add(place(maillage(axeZ(cylindre(0.5, 0.6, 32)), 'alu'), 0, 0, s * 1.5));
    pg.add(place(maillage(boite(0.6, 0.35, 0.5, 0.06), 'alu'), 0.9, 1.1, s * 1.1));
  });

  // --- Demi-arbres et soufflets de cardans (tournent avec les roues) ---
  const demiArbres = ajouter(piece('demiArbres', 'Demi-arbres ×2', 'transmission', [7.5, 0, 0]));
  [-1, 1].forEach((s) => {
    const da = tourne(new THREE.Group(), 'roues', 1, 'z');
    da.position.set(X_AR, Y_ROUE, 0);
    da.add(place(maillage(axeZ(cylindre(0.17, 5.0, 16)), 'acier'), 0, 0, s * 4.5));
    [1.95, Z_AR - 1.6].forEach((z) => {
      da.add(place(maillage(axeZ(cylindre(0.55, 0.45, 32)), 'acier'), 0, 0, s * z));
      da.add(place(maillage(axeZ(cone(0.2, 0.5, 0.55, 24)), 'caoutchouc'), 0, 0, s * (z + (z < 3 ? 0.5 : -0.5))));
    });
    demiArbres.add(da);
  });

  // --- Roues : pneu 225/55 R16, jante argent à 5 doubles branches, disque, étrier ---
  function roue(id, nom, fiche, x, s, eclate) {
    const p = ajouter(piece(id, nom, fiche, eclate));
    const support = new THREE.Group();
    support.position.set(x, Y_ROUE, s * (x < 0 ? Z_AV : Z_AR));
    p.add(support);
    const tournant = tourne(new THREE.Group(), 'roues', 1, 'z');
    support.add(tournant);
    const profil = [[R_JANTE, -1.2], [2.9, -1.3], [3.45, -1.25], [3.7, -1.05], [R_PNEU, -0.8], [R_PNEU, 0.8], [3.7, 1.05], [3.45, 1.25], [2.9, 1.3], [R_JANTE, 1.2]]
      .map(([r, h]) => new THREE.Vector2(r, h));
    tournant.add(maillage(axeZ(new THREE.LatheGeometry(profil, 72)), 'pneu'));
    tournant.add(maillage(axeZ(tubeOuvert(R_JANTE - 0.04, 2.3, 56)), 'aluOuvert'));
    [-1.17, 1.17].forEach((z) => tournant.add(place(maillage(toreZ(R_JANTE, 0.07), 'alu'), 0, 0, z)));
    tournant.add(place(maillage(axeZ(cylindre(0.55, 0.3, 32)), 'alu'), 0, 0, s * 0.75));
    autour(5, (a) => {
      [-0.12, 0.12].forEach((d) => {
        const branche = new THREE.Group();
        branche.rotation.z = a + d;
        branche.add(place(maillage(boite(0.16, 1.75, 0.14, 0.05), 'alu'), 0, 1.3, s * 0.82));
        tournant.add(branche);
      });
      tournant.add(place(maillage(axeZ(cylindre(0.07, 0.12, 6)), 'acier'), Math.sin(a) * 0.38, Math.cos(a) * 0.38, s * 0.92));
    });
    tournant.add(place(maillage(axeZ(cylindre(1.62, 0.25, 56)), 'acier'), 0, 0, -s * 0.25));
    tournant.add(place(maillage(axeZ(cylindre(0.7, 0.4, 32)), 'acier'), 0, 0, -s * 0.05));
    // Étrier (fixe) à l'arrière du disque, et porte-moyeu
    support.add(place(maillage(boite(0.6, 1.1, 0.6, 0.12), 'noir'), x < 0 ? 1.1 : -1.1, 0.6, -s * 0.25));
    support.add(place(maillage(boite(0.6, 1.8, 0.4, 0.06), 'acier'), 0, 0, -s * 0.85));
    return p;
  }
  roue('roueArG', 'Roue arrière gauche (motrice)', 'transmission', X_AR, 1, [7.5, 0, 4]);
  roue('roueArD', 'Roue arrière droite (motrice)', 'transmission', X_AR, -1, [7.5, 0, -4]);
  roue('roueAvG', 'Roue avant gauche', null, X_AV, 1, [0, 0, 5]);
  roue('roueAvD', 'Roue avant droite', null, X_AV, -1, [0, 0, -5]);


  /* ---------------- Châssis ---------------- */

  // --- Train avant : berceau, supports moteur, bras, jambes de force McPherson ---
  const trainAv = ajouter(piece('trainAv', 'Train avant (berceau, jambes de force)', null, [0, -0.2, 0]));
  trainAv.add(place(maillage(boite(0.8, 0.7, 10.8, 0.1), 'acier'), -2.3, -3.0, 0));
  [-1, 1].forEach((s) => {
    trainAv.add(place(maillage(cylindre(0.3, 0.75, 20), 'caoutchouc'), -1.8, -2.27, s * 1.6));
    trainAv.add(barre([-2.3, -2.95, s * 5.3], [X_AV, -2.7, s * (Z_AV - 1.1)], 0.18, 'acier'));
    trainAv.add(barre([-0.6, -2.95, s * 4.6], [X_AV + 0.1, -2.75, s * (Z_AV - 1.15)], 0.15, 'acier'));
    // Jambe de force : amortisseur, tige, ressort et coupelle supérieure
    const bas = [X_AV + 0.15, -1.2, s * (Z_AV - 1.25)], haut = [X_AV + 0.6, 4.4, s * (Z_AV - 2.3)];
    trainAv.add(barre(bas, [X_AV + 0.5, 2.6, s * (Z_AV - 2.05)], 0.3, 'acier'));
    trainAv.add(barre([X_AV + 0.5, 2.6, s * (Z_AV - 2.05)], haut, 0.1, 'acier'));
    const ress = ressort(0.62, 2.6, 6, 0.08, 'noir');
    const axe = v3(haut).sub(v3(bas)).normalize();
    ress.position.copy(v3(bas)).addScaledVector(axe, 2.4);
    ress.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axe);
    trainAv.add(ress);
    trainAv.add(place(maillage(cylindre(0.7, 0.12, 32), 'acier'), haut[0], haut[1], haut[2]));
  });

  // --- Direction : boîtier, barre et biellettes, colonne et volant (conduite à gauche) ---
  const direction = ajouter(piece('direction', 'Direction (boîtier, colonne, volant)', null, [0, 2.5, 4.5]));
  direction.add(place(maillage(boite(0.7, 0.8, 0.7, 0.1), 'noir'), -3.3, -1.9, 2.6));
  direction.add(barre([-3.6, -2.4, -5.0], [-3.6, -2.4, 5.0], 0.12, 'acier'));
  [-1, 1].forEach((s) => direction.add(barre([-3.6, -2.4, s * 5.0], [X_AV - 0.9, -2.3, s * (Z_AV - 1.3)], 0.09, 'acier')));
  direction.add(tuyau([[-3.3, -1.5, 2.6], [-1.5, -0.9, 2.75], [4.0, 1.4, 3.2], [8.0, 3.0, 3.8], [14.2, 4.6, 4.25]], 0.14, 'acier'));
  const volantDirection = new THREE.Group();
  volantDirection.position.set(14.6, 4.75, 4.27);
  volantDirection.rotation.z = 1.15;                                              // incliné vers le conducteur
  volantDirection.add(maillage(toreY(2.0, 0.17), 'garniture'));
  [0, 2.1, 4.2].forEach((a) => {
    const bras = new THREE.Group();
    bras.rotation.y = a;
    bras.add(place(maillage(boite(1.7, 0.08, 0.3, 0.03), 'garniture'), 0.95, 0, 0));
    volantDirection.add(bras);
  });
  volantDirection.add(maillage(cylindre(0.55, 0.3, 24), 'garniture'));
  direction.add(volantDirection);

  // --- Train arrière : berceau, bras, ressorts et amortisseurs ---
  const trainAr = ajouter(piece('trainAr', 'Train arrière (berceau, ressorts, amortisseurs)', null, [7.5, 3.0, 0]));
  [X_AR - 2.2, X_AR + 2.0].forEach((x) => trainAr.add(barre([x, -0.6, -5.2], [x, -0.6, 5.2], 0.3, 'acier')));
  [-1, 1].forEach((s) => {
    trainAr.add(barre([X_AR - 2.2, -0.6, s * 4.6], [X_AR + 2.0, -0.6, s * 4.6], 0.26, 'acier'));
    trainAr.add(barre([X_AR - 1.6, -0.9, s * 4.6], [X_AR - 0.2, -2.2, s * (Z_AR - 1.2)], 0.16, 'acier'));
    trainAr.add(barre([X_AR + 1.6, -0.9, s * 4.6], [X_AR + 0.3, -2.3, s * (Z_AR - 1.2)], 0.16, 'acier'));
    trainAr.add(barre([X_AR + 0.2, -0.4, s * 4.8], [X_AR + 0.2, -0.5, s * (Z_AR - 1.2)], 0.14, 'acier'));
    trainAr.add(place(ressort(0.55, 3.0, 6, 0.08, 'noir'), X_AR + 0.9, -1.5, s * 6.3));
    trainAr.add(barre([X_AR - 1.0, -1.8, s * 6.7], [X_AR - 1.0, 1.0, s * 6.6], 0.22, 'acier'));
    trainAr.add(barre([X_AR - 1.0, 1.0, s * 6.6], [X_AR - 1.0, 2.6, s * 6.55], 0.08, 'acier'));
  });


  /* ---------------- Circuit carburant ---------------- */

  // Tracés des conduites (réutilisés pour les fluides animés)
  const X_POMPE = 25.5, Z_POMPE = -3.8;
  const LIGNE_POMPE_FILTRE = [[X_POMPE, 0.5, Z_POMPE], [X_POMPE - 0.4, 0.75, Z_POMPE + 0.4], [23.0, 0.75, -1.5], [21.6, 0.6, 1.5], [21.0, -1.0, 3.2], [20.0, -2.6, 3.4], [18.6, -2.75, 3.4]];
  const LIGNE_FILTRE_RAMPE = [[16.4, -2.75, 3.4], [12.0, -2.85, 3.2], [5.0, -2.9, 3.0], [4.3, -2.2, 2.6], [4.0, 0.3, 2.1], [3.75, 1.7, 1.15], [3.25, 2.42, 1.06]];
  const LIGNE_RETOUR = [[18.75, -2.6, 3.7], [20.2, -2.45, 3.75], [21.3, -0.9, 3.5], [22.0, 0.65, 1.7], [23.3, 0.85, -1.2], [X_POMPE + 0.4, 0.55, Z_POMPE + 0.35]];

  // --- Réservoir en selle (sous la banquette arrière), enjambant l'arbre de transmission ---
  const reservoir = ajouter(piece('reservoir', 'Réservoir de carburant', 'carburant', [0, 4.5, 0]));
  const selle = new THREE.Shape();
  [[-6.0, -2.2], [-5.7, -2.5], [-1.8, -2.5], [-1.4, -2.1], [-1.4, -0.95], [1.4, -0.95], [1.4, -2.1], [1.8, -2.5],
    [5.7, -2.5], [6.0, -2.2], [6.0, 0.0], [5.7, 0.3], [-5.7, 0.3], [-6.0, 0.0]].forEach(([z, y], i) => (i ? selle.lineTo(z, y) : selle.moveTo(z, y)));
  selle.closePath();
  const geoSelle = new THREE.ExtrudeGeometry(selle, { depth: 6.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2 });
  geoSelle.rotateY(-Math.PI / 2);
  reservoir.add(place(maillage(geoSelle, 'reservoir'), 28.0, 0, 0));
  [23.0, 26.5].forEach((x) => reservoir.add(place(maillage(boite(0.25, 0.05, 12.4, 0.02), 'acier'), x, -2.68, 0)));
  reservoir.add(tuyau([[27.5, 0.3, -5.5], [30.5, 1.6, -7.5], [33.5, 3.0, -9.3], [35.2, 3.9, -9.9]], 0.3, 'plastique'));
  reservoir.add(place(maillage(axeZ(cylindre(0.42, 0.2, 24)), 'noir'), 35.3, 4.0, -10.0));

  // --- Pompe à essence immergée AEM 340 L/h, suspendue sous sa platine ---
  const pompeEssence = ajouter(piece('pompeEssence', 'Pompe à essence AEM 340 L/h', 'carburant', [0, 8.0, -1.5]));
  pompeEssence.add(place(maillage(cylindre(0.85, 0.12, 40), 'noir'), X_POMPE, 0.42, Z_POMPE));
  [[0.3, 0.25], [-0.3, 0.25]].forEach(([dz, dy]) => pompeEssence.add(place(maillage(cylindre(0.08, dy, 12), 'acier'), X_POMPE, 0.55, Z_POMPE + dz)));
  pompeEssence.add(place(maillage(boite(0.3, 0.2, 0.25, 0.04), 'plastique'), X_POMPE + 0.45, 0.58, Z_POMPE));
  [0.35, -0.35].forEach((dx) => pompeEssence.add(place(maillage(cylindre(0.04, 2.4, 8), 'acier'), X_POMPE + dx, -0.8, Z_POMPE)));
  pompeEssence.add(place(maillage(cylindre(0.33, 1.5, 32), 'acier'), X_POMPE, -1.15, Z_POMPE));
  pompeEssence.add(place(maillage(cylindre(0.335, 0.5, 32), 'noir'), X_POMPE, -0.95, Z_POMPE));
  pompeEssence.add(place(maillage(boite(1.0, 0.12, 0.7, 0.05), 'ceramique'), X_POMPE, -2.33, Z_POMPE));
  pompeEssence.add(tuyau([[X_POMPE, -0.4, Z_POMPE], [X_POMPE + 0.1, 0.0, Z_POMPE + 0.25], [X_POMPE, 0.36, Z_POMPE + 0.3]], 0.06, 'caoutchouc'));

  // --- Filtre à essence avec régulateur de pression intégré (sous le plancher, à gauche) ---
  const filtreEssence = ajouter(piece('filtreEssence', 'Filtre à essence et régulateur', 'carburant', [0, -0.3, 4.0]));
  filtreEssence.add(place(maillage(axeX(cylindre(0.42, 2.0, 32)), 'acier'), 17.5, -2.75, 3.4));
  filtreEssence.add(place(maillage(axeX(cylindre(0.3, 0.3, 24)), 'alu'), 18.65, -2.6, 3.55));
  [16.8, 18.2].forEach((x) => filtreEssence.add(place(maillage(toreX(0.44, 0.04), 'noir'), x, -2.75, 3.4)));

  // --- Durites de carburant : départ pompe → filtre → rampe, retour du régulateur au réservoir ---
  const duriteEssence = ajouter(piece('duriteEssence', 'Durites de carburant', 'carburant', [0, 0, 2.5]));
  [LIGNE_POMPE_FILTRE, LIGNE_FILTRE_RAMPE, LIGNE_RETOUR].forEach((l) => duriteEssence.add(tuyau(l, 0.055, 'acier')));


  /* ---------------- Carrosserie (E39 berline, bleu topaze) ---------------- */
  construireCarrosserie(ajouter);


  // Pose de la mécanique selon les angles (moteur, disque d'embrayage, arbre, roues)
  meca.poser = function (etat) {
    const angle = etat.moteur;
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
    meca.tournants.forEach((t) => {
      if (t.vitesse === 'moteur' && t.objet === meca.arbre) return;
      const a = etat[t.vitesse] * t.rapport;
      if (t.axe === 'z') t.objet.rotation.z = a; else t.objet.rotation.x = a;
    });
    // Levier de vitesses : position de la grille en H
    meca.levier.rotation.z += (etat.levier[0] - meca.levier.rotation.z) * 0.25;
    meca.levier.rotation.x += (etat.levier[1] - meca.levier.rotation.x) * 0.25;
  };
  meca.poser({ moteur: 0, disque: 0, arbre: 0, roues: 0, levier: [0, 0] });

  // Fluides : tracés animés (refroidissement, carburant, huile), hors des pièces cliquables
  const fluides = construireFluides({ DURITE_HAUTE, DURITE_BASSE, LIGNE_POMPE_FILTRE, LIGNE_FILTRE_RAMPE, LIGNE_RETOUR, X_POMPE, Z_POMPE });

  // Fusion des maillages fixes de chaque pièce (beaucoup moins d'appels de dessin)
  racine.updateMatrixWorld(true);
  Object.values(pieces).forEach(fusionner);

  return { racine: racine, pieces: pieces, meca: meca, fluides: fluides };
}


/* ==========================================================================
   4. Carrosserie : coque « loftée » à partir de sections transversales relevées
   sur le gabarit d'une E39 (longueur 4 775 mm, largeur 1 800 mm, hauteur 1 435 mm),
   découpée en panneaux pour la vue éclatée
   ========================================================================== */
// Sections (mm) : position depuis l'avant, bas de caisse, ligne d'épaule,
// haut (capot / toit / coffre), demi-largeur de caisse, demi-largeur du haut
const GABARIT = {
  x:  [0, 40, 120, 300, 600, 860, 1300, 1650, 1950, 2250, 2500, 3200, 3450, 3700, 3900, 4200, 4500, 4650, 4740, 4775],
  b:  [300, 220, 200, 195, 190, 185, 180, 180, 180, 180, 180, 180, 180, 185, 190, 200, 230, 260, 320, 400],
  hb: [640, 690, 720, 748, 768, 785, 815, 860, 895, 915, 925, 935, 945, 955, 965, 975, 975, 960, 930, 880],
  ht: [700, 728, 748, 772, 792, 815, 850, 900, 1150, 1390, 1430, 1425, 1390, 1250, 1035, 1025, 1015, 1000, 970, 920],
  wb: [700, 780, 830, 875, 895, 900, 900, 900, 900, 900, 900, 900, 900, 900, 895, 890, 870, 840, 800, 740],
  wt: [560, 620, 670, 715, 735, 740, 740, 700, 665, 630, 620, 620, 620, 640, 700, 730, 720, 700, 660, 600]
};
const PASSAGES_ROUE = [860, 3690];                // axes avant et arrière (mm depuis l'avant)

function gabarit(cle, x) {
  const xs = GABARIT.x, t = GABARIT[cle];
  if (x <= xs[0]) return t[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) return t[i - 1] + (t[i] - t[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  }
  return t[t.length - 1];
}

// Points de la demi-section droite (mm) : 0 bas centre → 1-4 flanc → 5 épaule → 6-8 haut du flanc → 10 sommet
function section(x) {
  let b = gabarit('b', x);
  PASSAGES_ROUE.forEach((xr) => {
    const dx = Math.abs(x - xr);
    if (dx < 400) b = Math.max(b, 327 + Math.sqrt(400 * 400 - dx * dx));      // passage de roue
  });
  const hb = gabarit('hb', x), ht = gabarit('ht', x), wb = gabarit('wb', x), wt = gabarit('wt', x);
  const flanc = (f) => b + (hb - 20 - b) * f;
  const p6 = [wb - 70, hb + 10];
  const p7 = [Math.min(wt + 40, p6[0] - 20), Math.max(hb + 15, ht - 60)];
  const p8 = [Math.min(wt - 40, p7[0] - 20), Math.max(hb + 20, ht - 10)];
  return [[0, b], [wb - 120, b], [wb - 25, flanc(0.15)], [wb, flanc(0.45)], [wb, flanc(0.8)], [wb - 20, hb - 20],
    p6, p7, p8, [p8[0] * 0.5, ht], [0, ht + 5]];
}

function courbeSection(x) {
  return new THREE.CatmullRomCurve3(section(x).map(([z, y]) => new THREE.Vector3(z, y, 0)), false, 'centripetal');
}

// Panneau de carrosserie entre les abscisses x0 et x1 (mm), sur la portion [i0, i1] de la section.
// cote : 1 = gauche, -1 = droite, 0 = panneau symétrique qui passe par le sommet (i1 = 10)
function panneau(x0, x1, i0, i1, cote, nomMateriau) {
  const nx = Math.max(2, Math.ceil((x1 - x0) / 60) + 1);
  const nt = Math.max(2, Math.ceil((i1 - i0) * 3) + 1);
  const ts = [];
  for (let k = 0; k < nt; k++) ts.push((i0 + (i1 - i0) * k / (nt - 1)) / 10);
  const colonnes = cote === 0
    ? ts.map((t) => [t, -1]).concat(ts.slice(0, -1).reverse().map((t) => [t, 1]))
    : ts.map((t) => [t, cote]);
  const pos = [], idx = [], nc = colonnes.length;
  for (let i = 0; i < nx; i++) {
    const x = x0 + (x1 - x0) * i / (nx - 1);
    const courbe = courbeSection(x);
    colonnes.forEach(([t, s]) => {
      const p = courbe.getPoint(t);
      pos.push(caisseX(x), caisseY(p.y), s * mm(p.x));
    });
  }
  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return maillage(g, nomMateriau);
}

// Face pleine (avant ou arrière) à l'abscisse x
function face(x, nomMateriau) {
  const demi = section(x).slice(1);
  const contour = demi.concat(demi.slice(0, -1).reverse().map(([z, y]) => [-z, y]));
  const forme = new THREE.Shape(contour.map(([z, y]) => new THREE.Vector2(mm(z), caisseY(y))));
  const g = new THREE.ShapeGeometry(forme, 12).rotateY(-Math.PI / 2);
  return place(maillage(g, nomMateriau), caisseX(x), 0, 0);
}

function construireCarrosserie(ajouter) {
  const panneauDe = (id, nom, eclate) => ajouter(piece(id, nom, null, eclate, true));
  const posCaisse = (x, y, z) => [caisseX(x), caisseY(y), mm(z)];

  // Face avant : bouclier, calandre à double haricot chromé, projecteurs à anneaux (angel eyes), antibrouillards
  const faceAv = panneauDe('faceAvant', 'Face avant (pare-chocs, calandre, phares)', [-12, 0, 0]);
  faceAv.add(panneau(0, 230, 1, 10, 0, 'peinture'));
  faceAv.add(face(0, 'peinture'));
  [-1, 1].forEach((s) => {
    const [x, y, z] = posCaisse(-4, 650, s * 105);
    faceAv.add(place(maillage(boite(0.2, 1.3, 1.55, 0.3), 'acier'), x, y, z));
    faceAv.add(place(maillage(boite(0.22, 1.1, 1.35, 0.25), 'garniture'), x + 0.03, y, z));
    for (let k = -3; k <= 3; k++) faceAv.add(place(maillage(boite(0.06, 1.0, 0.05, 0.02), 'acier'), x - 0.09, y, z + k * 0.17));
    // Bloc optique : deux anneaux lumineux (angel eyes) et leurs projecteurs, clignotant blanc à l'extérieur
    const [xo, yo, zo] = posCaisse(-2, 640, s * 455);
    faceAv.add(place(maillage(boite(0.25, 1.35, 4.6, 0.25), 'optique'), xo, yo, zo));
    [s * 350, s * 545].forEach((zp) => {
      const [, , zz] = posCaisse(0, 0, zp);
      faceAv.add(place(maillage(toreX(0.6, 0.06), 'angelEyes'), xo - 0.14, yo, zz));
      faceAv.add(place(maillage(axeX(cylindre(0.36, 0.2, 24)), 'chrome'), xo - 0.02, yo, zz));
    });
    const [, , zc] = posCaisse(0, 0, s * 655);
    faceAv.add(place(maillage(boite(0.27, 0.9, 0.75, 0.15), 'feuBlanc'), xo + 0.02, yo, zc));
    const [xf, yf, zf] = posCaisse(-2, 330, s * 640);
    faceAv.add(place(maillage(axeX(cylindre(0.5, 0.2, 24)), 'optique'), xf, yf, zf));
  });
  const [xg, yg] = posCaisse(-3, 330, 0);
  faceAv.add(place(maillage(boite(0.25, 1.4, 6.5, 0.2), 'garniture'), xg, yg, 0));

  const capot = panneauDe('capot', 'Capot', [-3, 12, 0]);
  capot.add(panneau(230, 1650, 5, 10, 0, 'peinture'));

  [[1, 'G', 'gauche'], [-1, 'D', 'droite']].forEach(([s, l, nom]) => {
    const aile = panneauDe('aileAv' + l, 'Aile avant ' + nom, [-2, 1, s * 11]);
    aile.add(panneau(230, 1720, 1, 5, s, 'peinture'));

    const porteAv = panneauDe('porteAv' + l, 'Porte avant ' + nom, [0, 0.5, s * 14]);
    porteAv.add(panneau(1720, 2780, 1, 5, s, 'peinture'));
    porteAv.add(panneau(1720, 2250, 5, 6.2, s, 'vitre'));
    porteAv.add(panneau(2250, 2780, 5, 8, s, 'vitre'));
    const [xr, yr, zr] = posCaisse(1790, 975, s * 960);
    porteAv.add(place(maillage(boite(0.9, 1.0, 1.5, 0.3), 'peinture'), xr, yr, zr));
    porteAv.add(place(maillage(boite(0.1, 0.8, 1.2, 0.2), 'vitre'), xr + 0.45, yr, zr));
    const [xp, yp, zp] = posCaisse(2420, 860, s * 905);
    porteAv.add(place(maillage(boite(1.2, 0.18, 0.12, 0.05), 'chrome'), xp, yp, zp));

    const porteAr = panneauDe('porteAr' + l, 'Porte arrière ' + nom, [2, 0.5, s * 14]);
    porteAr.add(panneau(2780, 3600, 1, 5, s, 'peinture'));
    porteAr.add(panneau(2780, 3500, 5, 8, s, 'vitre'));
    const [xq, yq, zq] = posCaisse(3330, 870, s * 905);
    porteAr.add(place(maillage(boite(1.2, 0.18, 0.12, 0.05), 'chrome'), xq, yq, zq));

    const custode = panneauDe('custode' + l, 'Aile arrière ' + nom, [3, 1, s * 11]);
    custode.add(panneau(3600, 4540, 1, 5, s, 'peinture'));
    custode.add(panneau(3500, 3900, 5, 8, s, 'peinture'));
  });

  const pareBrise = panneauDe('pareBrise', 'Pare-brise', [-2, 9, 0]);
  pareBrise.add(panneau(1650, 2250, 7.6, 10, 0, 'vitre'));

  const toit = panneauDe('toit', 'Pavillon et montants', [0, 15, 0]);
  toit.add(panneau(2250, 3300, 8, 10, 0, 'peinture'));
  [1, -1].forEach((s) => {
    toit.add(panneau(1650, 2250, 6.2, 7.6, s, 'peinture'));
    toit.add(panneau(2760, 2800, 5, 8, s, 'garniture'));
  });

  const lunette = panneauDe('lunette', 'Lunette arrière', [3, 10, 0]);
  lunette.add(panneau(3300, 3900, 7.8, 10, 0, 'vitre'));

  const coffre = panneauDe('coffre', 'Coffre', [6, 12, 0]);
  coffre.add(panneau(3900, 4540, 5, 10, 0, 'peinture'));

  // Feux arrière (phase 2) : partie rouge et partie blanche, sur l'aile et sur le coffre
  const feux = panneauDe('feuxAr', 'Feux arrière', [11, 3, 0]);
  [-1, 1].forEach((s) => {
    const [x, y, z] = posCaisse(4705, 900, s * 700);
    feux.add(place(maillage(boite(0.5, 1.3, 2.6, 0.2), 'feuRouge'), x, y, z));
    feux.add(place(maillage(boite(0.52, 0.55, 1.0, 0.12), 'feuBlanc'), x, y - 0.1, z - s * 0.4));
    const [x2, y2, z2] = posCaisse(4650, 950, s * 520);
    feux.add(place(maillage(boite(0.5, 0.9, 1.6, 0.18), 'feuRouge'), x2, y2, z2));
  });

  // Face arrière : bouclier, attelage
  const faceAr = panneauDe('faceArriere', 'Face arrière (pare-chocs, attelage)', [13, 0, 0]);
  faceAr.add(panneau(4540, 4775, 1, 10, 0, 'peinture'));
  faceAr.add(face(4775, 'peinture'));
  const [xa, ya] = posCaisse(4830, 380, 0);
  faceAr.add(place(maillage(boite(1.4, 0.3, 0.4, 0.08), 'garniture'), xa - 0.5, ya - 0.2, 0));
  faceAr.add(barre([xa - 0.2, ya - 0.2, 0], [xa + 0.4, ya + 0.5, 0], 0.15, 'garniture'));
  faceAr.add(place(maillage(new THREE.SphereGeometry(0.28, 20, 14), 'chrome'), xa + 0.45, ya + 0.7, 0));
}


/* ==========================================================================
   5. Fluides : tubes colorés dont la texture défile dans le sens de circulation
   ========================================================================== */
const FLUIDES = {
  refroidissement: { couleur: 0x0891b2, vitesse: 'moteur' },
  carburant: { couleur: 0xea580c, vitesse: 'carburant' },
  huile: { couleur: 0x713f12, vitesse: 'moteur' }
};

function textureFlux() {
  const toile = document.createElement('canvas');
  toile.width = 64; toile.height = 4;
  const ctx = toile.getContext('2d');
  const degrade = ctx.createLinearGradient(0, 0, 64, 0);
  degrade.addColorStop(0, '#7a7a7a');
  degrade.addColorStop(0.55, '#ffffff');
  degrade.addColorStop(0.75, '#ffffff');
  degrade.addColorStop(1, '#7a7a7a');
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 64, 4);
  const tex = new THREE.CanvasTexture(toile);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function construireFluides(t) {
  const groupe = new THREE.Group();
  groupe.visible = false;
  const base = textureFlux();
  const textures = { refroidissement: [], carburant: [], huile: [] };

  // droit = true : tracé en lignes brisées (galeries internes), sinon courbe douce (durites)
  function flux(type, points, r, options) {
    const o = options || {};
    let courbe;
    if (o.droit) {
      courbe = new THREE.CurvePath();
      for (let i = 0; i < points.length - 1; i++) courbe.add(new THREE.LineCurve3(v3(points[i]), v3(points[i + 1])));
    } else {
      courbe = new THREE.CatmullRomCurve3(points.map(v3), false, 'centripetal');
    }
    const longueur = courbe.getLength();
    const geo = new THREE.TubeGeometry(courbe, Math.max(8, Math.round(longueur * (o.droit ? 3 : 5))), r, 8, false);
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, longueur / 0.9), 1);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: FLUIDES[type].couleur, map: tex, transparent: true, opacity: 0.92, depthWrite: false }));
    m.renderOrder = 2;
    textures[type].push({ tex: tex, facteur: o.lent ? 0.5 : 1 });
    groupe.add(m);
  }

  // Liquide de refroidissement : pompe → chemises du bloc → culasse → durite haute → radiateur
  // (passes du faisceau) → durite basse → thermostat → pompe
  [0.95, -0.95].forEach((z) => flux('refroidissement', [[-3.7, 0.8, 0], [-3.4, 0.55, z], [3.2, 0.55, z], [3.25, 1.55, z * 0.65], [-3.3, 1.65, z * 0.65], [-3.55, 1.85, -0.75]], 0.07, { droit: true }));
  flux('refroidissement', t.DURITE_HAUTE, 0.21);
  const passes = [];
  [2.4, 1.2, 0, -1.2, -2.2].forEach((y, i) => {
    const sens = i % 2 ? [3.2, -3.2] : [-3.2, 3.2];
    passes.push([-6.62, y, sens[0]], [-6.62, y, sens[1]]);
  });
  flux('refroidissement', [[-6.4, 2.5, -3.3]].concat(passes).concat([[-6.4, -2.2, 3.3]]), 0.09, { droit: true });
  flux('refroidissement', t.DURITE_BASSE, 0.21);
  flux('refroidissement', [[-3.78, -0.11, -0.87], [-3.8, 0.25, -0.75], [-3.72, 0.75, -0.13], [-3.7, 0.8, 0]], 0.1, { droit: true });

  // Carburant : crépine → pompe → platine → durite → filtre-régulateur → rampe → injecteurs ; retour au réservoir
  flux('carburant', [[t.X_POMPE, -2.3, t.Z_POMPE], [t.X_POMPE, 0.42, t.Z_POMPE], t.LIGNE_POMPE_FILTRE[0]], 0.1, { droit: true });
  flux('carburant', t.LIGNE_POMPE_FILTRE, 0.09);
  flux('carburant', [[18.6, -2.75, 3.4], [16.4, -2.75, 3.4]], 0.12, { droit: true });
  flux('carburant', t.LIGNE_FILTRE_RAMPE, 0.09);
  flux('carburant', [[3.25, 2.42, 1.06], [-3.2, 2.42, 1.06]], 0.11, { droit: true });
  X_CYL.forEach((x) => flux('carburant', [[x, 2.33, 1.08], [x, 1.82, 1.22]], 0.05, { droit: true }));
  flux('carburant', t.LIGNE_RETOUR, 0.08, { lent: true });

  // Huile : puisard → crépine → pompe → filtre → galerie principale → paliers et gicleurs ;
  // montée vers la culasse (arbres à cames, VANOS) puis retour au carter
  flux('huile', [[1.6, -3.2, 0], [1.4, -3.15, 0], [0.4, -3.0, 0], [-2.2, -2.55, 0], [-2.9, -2.0, 0]], 0.08, { droit: true });
  flux('huile', [[-2.9, -2.0, 0], [-2.9, -1.3, 0.8], [-2.45, -0.3, 1.55], [-2.45, 0.9, 1.55], [-2.1, 0.3, 1.0], [-2.0, -0.45, 0.9]], 0.08, { droit: true });
  flux('huile', [[-3.2, -0.45, 0.9], [3.2, -0.45, 0.9]], 0.08, { droit: true });
  for (let k = 0; k < 7; k++) flux('huile', [[(k - 3) * ENTRAXE, -0.45, 0.9], [(k - 3) * ENTRAXE, -1.0, 0.18]], 0.04, { droit: true });
  X_CYL.forEach((x) => flux('huile', [[x + 0.2, -0.45, 0.9], [x + 0.1, -0.15, 0.3]], 0.03, { droit: true }));
  flux('huile', [[-3.2, -0.45, 0.9], [-3.25, 1.9, 0.75], [-3.2, 2.05, 0], [3.2, 2.05, 0]], 0.06, { droit: true });
  flux('huile', [[-3.2, 2.05, 0], [-3.75, 2.3, 0]], 0.05, { droit: true });
  flux('huile', [[3.25, 2.0, -0.8], [3.25, -1.0, -1.0], [3.0, -2.8, -0.6], [2.0, -3.15, -0.2]], 0.06, { droit: true });

  return { groupe: groupe, textures: textures };
}


/* ==========================================================================
   6. Fusion : dans chaque pièce, les maillages fixes de même matériau sont
   regroupés en un seul (les groupes animés gardent leurs propres maillages)
   ========================================================================== */
function fusionner(racine) {
  const lots = {};
  const inverse = racine.matrixWorld.clone().invert();
  (function parcourir(objet) {
    objet.children.slice().forEach((enfant) => {
      if (ANIMES.has(enfant)) { fusionner(enfant); return; }
      if (enfant.isMesh) (lots[enfant.userData.mat] = lots[enfant.userData.mat] || []).push(enfant);
      else parcourir(enfant);
    });
  })(racine);
  Object.keys(lots).forEach((nom) => {
    const liste = lots[nom];
    if (liste.length < 2) return;
    const geos = liste.map((m) => {
      let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      Object.keys(geo.attributes).forEach((a) => { if (a !== 'position' && a !== 'normal') geo.deleteAttribute(a); });
      return geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    });
    const fusion = mergeGeometries(geos, false);
    if (!fusion) return;
    racine.add(maillage(fusion, nom));
    liste.forEach((m) => { m.parent.remove(m); m.geometry.dispose(); });
    geos.forEach((geo) => geo.dispose());
  });
}

// Pièces montrées dans la mini-maquette de chaque fiche
const PIECES_PAR_FICHE = {
  cycle: ['bloc', 'pistons', 'vilebrequin'],
  admission: ['boiteAir', 'papillon', 'collecteurAdm', 'disa'],
  carburant: ['reservoir', 'pompeEssence', 'filtreEssence', 'duriteEssence', 'rampe', 'injecteurs'],
  allumage: ['bobines', 'bougies', 'cacheBobines'],
  distribution: ['aac', 'soupapes', 'vanos'],
  echappement: ['collecteurEch', 'ligneEch', 'sondes'],
  refroidissement: ['radiateur', 'vase', 'durites', 'ventilateur', 'pompeEau', 'thermostat'],
  lubrification: ['carter', 'pompeHuile', 'filtreHuile', 'vilebrequin'],
  ccv: ['ccv', 'cache'],
  gestion: ['dme', 'bobines', 'injecteurs'],
  transmission: ['volant', 'embrayage', 'boite', 'arbre', 'pont', 'demiArbres', 'roueArG', 'roueArD'],
  vanos: ['vanos', 'aac'],
  disa: ['disa', 'collecteurAdm'],
  thermostat: ['thermostat', 'pompeEau'],
  airsecondaire: ['pompeAir', 'collecteurEch'],
  lambda: ['sondes', 'collecteurEch'],
  mdk: ['papillon'],
  gicleurs: ['pistons', 'vilebrequin', 'pompeHuile']
};


/* ==========================================================================
   7. Simulation d'accélération (boîte manuelle 5 rapports)
   Les rapports et la démultiplication du pont sont illustratifs : ils servent à
   faire tourner chaque organe à une vitesse cohérente avec les autres.
   ========================================================================== */
const RAPPORTS = [3.72, 2.02, 1.32, 1.0, 0.81];
const PONT = 3.38;
const RALENTI = 800, REGIME_MAX = 6200, REGIME_PASSAGE = 5600;
const VITESSE_RALENTI = 2.2;                       // rad/s affichés au ralenti
const omega = (regime) => VITESSE_RALENTI * regime / RALENTI;
const regimeDe = (w) => w * RALENTI / VITESSE_RALENTI;
const MONTEE = [3000, 2100, 1500, 1100, 800];      // montée en régime (tr/min par seconde) selon le rapport
// Position du levier dans la grille en H : [avant/arrière, gauche/droite]
const GRILLE = [[0, 0], [0.22, 0.2], [-0.22, 0.2], [0.22, 0], [-0.22, 0], [0.22, -0.2]];

function creerSimulation() {
  const s = { actif: false, phase: 'ralenti', t: 0, regime: RALENTI, rapport: 0, embraye: true, roues: 0, charge: 0 };
  const angles = { moteur: 0, disque: 0, arbre: 0, roues: 0, levier: [0, 0] };

  function etape(dt) {
    s.t += dt;
    const rapportTotal = s.rapport ? RAPPORTS[s.rapport - 1] * PONT : 0;
    if (!s.actif) {
      // Ralenti au point mort, voiture arrêtée (les roues finissent de s'arrêter)
      s.regime += (RALENTI - s.regime) * Math.min(1, dt * 2);
      s.roues = Math.max(0, s.roues - dt * 3);
      s.rapport = 0; s.embraye = true; s.charge = 0;
    } else if (s.phase === 'ralenti') {
      s.regime += (RALENTI - s.regime) * Math.min(1, dt * 3);
      s.roues = Math.max(0, s.roues - dt * 3);
      if (s.t > 1.2 && s.roues === 0) { s.phase = 'demarrage'; s.rapport = 1; s.t = 0; }
    } else if (s.phase === 'demarrage') {
      // L'embrayage patine : le régime monte pendant que la voiture se met en mouvement
      s.embraye = false; s.charge = 0.6;
      const f = Math.min(1, s.t / 0.9);
      s.regime = RALENTI + (1600 - RALENTI) * f;
      s.roues = omega(s.regime) / (RAPPORTS[0] * PONT) * f;
      if (f >= 1) { s.phase = 'acceleration'; s.t = 0; }
    } else if (s.phase === 'acceleration') {
      s.embraye = true; s.charge = 1;
      s.regime = Math.min(REGIME_MAX, s.regime + MONTEE[s.rapport - 1] * dt);
      s.roues = omega(s.regime) / rapportTotal;
      const fin = s.rapport === 5 ? 4500 : REGIME_PASSAGE;
      if (s.regime >= fin) { s.phase = s.rapport === 5 ? 'deceleration' : 'passage'; s.t = 0; }
    } else if (s.phase === 'passage') {
      // Débrayé : le moteur redescend vers le régime du rapport suivant
      s.embraye = false; s.charge = 0;
      const cible = regimeDe(s.roues * RAPPORTS[s.rapport] * PONT);
      s.regime += (cible - s.regime) * Math.min(1, dt * 7);
      if (s.t > 0.5) { s.rapport += 1; s.regime = cible; s.phase = 'acceleration'; s.t = 0; }
    } else if (s.phase === 'deceleration') {
      // Pied levé : frein moteur, la voiture ralentit en 5e
      s.embraye = true; s.charge = 0;
      s.regime -= 900 * dt;
      s.roues = omega(s.regime) / rapportTotal;
      if (s.regime < 1400) { s.phase = 'arret'; s.t = 0; s.rapport = 0; }
    } else if (s.phase === 'arret') {
      // Point mort, freinage jusqu'à l'arrêt, puis on recommence
      s.embraye = true; s.charge = 0;
      s.regime += (RALENTI - s.regime) * Math.min(1, dt * 2);
      s.roues = Math.max(0, s.roues - dt * 2.2);
      if (s.roues === 0 && s.t > 1) { s.phase = 'ralenti'; s.t = 0; }
    }

    const wMoteur = omega(s.regime);
    const wArbre = s.roues * PONT;
    angles.moteur += wMoteur * dt;
    // Disque d'embrayage : avec le moteur s'il est embrayé, sinon avec l'arbre primaire de la boîte
    angles.disque += (s.embraye || !s.rapport ? wMoteur : wArbre * RAPPORTS[s.rapport - 1]) * dt;
    angles.arbre += wArbre * dt;
    angles.roues += s.roues * dt;
    // Levier : il passe par le point mort au début de chaque changement de rapport
    if (s.phase === 'passage') angles.levier = s.t < 0.25 ? GRILLE[0] : GRILLE[s.rapport + 1];
    else angles.levier = GRILLE[s.rapport];
    return angles;
  }

  return { etat: s, etape: etape, angles: angles };
}


/* ==========================================================================
   8. Scène commune (lumières, environnement)
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
  soleil.position.set(-20, 40, 26);
  if (ombres) {
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    Object.assign(soleil.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 140 });
    soleil.shadow.camera.updateProjectionMatrix();
    soleil.shadow.bias = -0.0008;
  }
  scene.add(soleil);
  const contre = new THREE.DirectionalLight(0xc4b5fd, 0.8);  // contre-jour violet discret
  contre.position.set(26, 12, -30);
  scene.add(contre);

  return { rendu: rendu, scene: scene };
}


/* ==========================================================================
   9. Vue principale
   ========================================================================== */
function demarrer() {
  const { rendu, scene } = preparerRendu(zoneScene, true);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.3, 800);

  const { racine, pieces, meca, fluides } = construireMaquette();
  const monde = new THREE.Group();
  monde.add(racine, fluides.groupe);
  scene.add(monde);
  const listePieces = Object.values(pieces);
  const carrosserie = listePieces.filter((p) => p.userData.carrosserie);

  // Toute la voiture est centrée sur l'origine ; le sol (qui ne montre que l'ombre) passe sous les pneus
  const centreBrut = new THREE.Box3().setFromObject(racine).getCenter(new THREE.Vector3());
  monde.position.set(-centreBrut.x, -centreBrut.y, -centreBrut.z);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: 0.14 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = Y_SOL - centreBrut.y;
  sol.receiveShadow = true;
  scene.add(sol);
  monde.updateMatrixWorld(true);

  // Matériaux d'origine de chaque maillage (pour la vue « fantôme » des fluides et le fondu de la caisse)
  racine.traverse((o) => {
    if (o.isMesh) o.userData.base = { opacite: o.material.opacity, transparent: o.material.transparent, depthWrite: o.material.depthWrite };
  });

  // Sphères englobantes : assemblé / éclaté, avec ou sans carrosserie (servent au cadrage)
  function mesurer(t, avecCaisse) {
    const boite = new THREE.Box3();
    listePieces.forEach((p) => {
      if (p.userData.carrosserie && !avecCaisse) return;
      p.position.copy(p.userData.eclate).multiplyScalar(t);
      p.updateMatrixWorld(true);
      boite.union(new THREE.Box3().setFromObject(p));
    });
    return boite.getBoundingSphere(new THREE.Sphere());
  }
  const vues = { a0: mesurer(0, false), a1: mesurer(0, true), e0: mesurer(1, false), e1: mesurer(1, true) };
  listePieces.forEach((p) => p.position.set(0, 0, 0));

  // Caméra placée devant, à gauche et au-dessus, à une distance qui fait tenir toute la voiture
  const DIRECTION = new THREE.Vector3(-11, 6.2, 13).normalize();
  const distanceBase = vues.a1.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8;
  camera.position.copy(vues.a1.center).addScaledVector(DIRECTION, distanceBase);

  // Contrôles : glisser pour tourner, rotation automatique ; zoom (molette après un clic, ou pincement)
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = !mouvementReduit;
  controles.enableZoom = false;
  controles.zoomToCursor = true;
  controles.enablePan = false;
  controles.autoRotate = !mouvementReduit;
  controles.autoRotateSpeed = 0.6;
  controles.target.copy(vues.a1.center);
  controles.minPolarAngle = 0.25;
  controles.maxPolarAngle = 1.62;
  controles.minDistance = vues.a0.radius * 0.12;
  controles.maxDistance = distanceBase * 1.6;
  // Sur écran tactile : un doigt fait défiler la page, deux doigts font tourner et zoomer
  controles.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  rendu.domElement.style.touchAction = 'pan-y';

  // La molette ne zoome qu'après un clic dans la vue : sinon elle fait défiler la page
  function activerZoom(actif) {
    controles.enableZoom = actif;
    zoneScene.toggleAttribute('data-lenis-prevent', actif);
  }
  rendu.domElement.addEventListener('pointerdown', () => activerZoom(true));
  rendu.domElement.addEventListener('pointerleave', () => activerZoom(false));

  /* ---------- État de la vue ---------- */
  let eclate = 0, cibleEclate = 0;            // 0 = assemblé, 1 = éclaté (valeurs animées)
  let caisse = 1, cibleCaisse = 1;            // 1 = voiture affichée
  let fluidesActifs = false;
  const sim = creerSimulation();
  const douce = (t) => t * t * (3 - 2 * t);

  /* ---------- Cadrage : la caméra suit le centre de la scène et recule en vue éclatée ---------- */
  let zoomBase = 1;
  const centreVise = new THREE.Vector3(), tmp = new THREE.Vector3();
  function vueCourante() {
    const t = douce(eclate), c = douce(caisse);
    const centre = tmp.copy(vues.a0.center).lerp(vues.a1.center, c);
    const centreE = new THREE.Vector3().copy(vues.e0.center).lerp(vues.e1.center, c);
    centre.lerp(centreE, t);
    const rayonA = THREE.MathUtils.lerp(vues.a0.radius, vues.a1.radius, c);
    const rayonE = THREE.MathUtils.lerp(vues.e0.radius, vues.e1.radius, c);
    return { centre: centre, rayon: THREE.MathUtils.lerp(rayonA, rayonE, t) };
  }
  function cadrer() {
    const v = vueCourante();
    centreVise.copy(v.centre);
    camera.position.add(centreVise).sub(controles.target);                        // la caméra suit sa cible
    controles.target.copy(centreVise);
    camera.zoom = zoomBase * vues.a1.radius / v.rayon;
    camera.updateProjectionMatrix();
  }
  function recentrer() {
    const v = vueCourante();
    controles.target.copy(v.centre);
    camera.position.copy(v.centre).addScaledVector(DIRECTION, distanceBase);
    cadrer();
    demanderRendu();
  }

  /* ---------- Taille ---------- */
  function redimensionner() {
    const l = zoneScene.clientWidth, h = zoneScene.clientHeight;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    // Recul de la caméra pour que toute la voiture tienne aussi en portrait (mobile)
    zoomBase = Math.min(1, camera.aspect);
    cadrer();
    demanderRendu();
  }
  new ResizeObserver(redimensionner).observe(zoneScene);

  /* ---------- Étiquettes françaises (vue éclatée) ---------- */
  const etiquettes = listePieces.map((p) => {
    const el = document.createElement('span');
    el.className = 'etiquette-piece';
    el.textContent = p.userData.nom;
    zoneEtiquettes.appendChild(el);
    return { piece: p, el: el, boite: new THREE.Box3(), point: new THREE.Vector3(), coin: new THREE.Vector3() };
  });

  // Seules les pièces assez grandes à l'écran ont leur étiquette (zoomer en fait apparaître d'autres) ;
  // une étiquette qui en chevaucherait une autre est masquée plutôt qu'empilée
  function placerEtiquettes() {
    const l = zoneScene.clientWidth, h = zoneScene.clientHeight;
    const placees = [];
    etiquettes.forEach((e) => {
      e.visible = false;
      if (!e.piece.visible) return;
      e.boite.setFromObject(e.piece);
      e.boite.getCenter(e.point);
      const taille = e.boite.getSize(e.coin).length();
      e.point.y = e.boite.max.y;
      e.coin.copy(e.point).addScaledVector(camera.up, taille * 0.5);
      e.point.project(camera);
      e.coin.project(camera);
      e.x = (e.point.x + 1) / 2 * l;
      e.y = (1 - e.point.y) / 2 * h;
      e.ecran = Math.abs(e.coin.y - e.point.y) * h;
      e.largeur = e.el.offsetWidth || 120;
      e.visible = e.point.z < 1 && e.ecran > 26 && e.x > 0 && e.x < l && e.y > 24 && e.y < h;
    });
    etiquettes.filter((e) => e.visible).sort((a, b) => b.ecran - a.ecran).forEach((e) => {
      const gene = placees.some((o) => Math.abs(o.x - e.x) < (o.largeur + e.largeur) / 2 + 6 && Math.abs(o.y - e.y) < 28);
      if (gene) e.visible = false; else placees.push(e);
    });
    etiquettes.forEach((e) => {
      e.el.style.visibility = e.visible || e.piece === survolee ? 'visible' : 'hidden';
      if (e.visible || e.piece === survolee) {
        e.el.style.transform = 'translate(-50%, -120%) translate(' + e.x.toFixed(1) + 'px,' + e.y.toFixed(1) + 'px)';
      }
    });
  }

  /* ---------- Vue éclatée, carrosserie, fluides ---------- */
  function appliquerEclate() {
    const t = douce(eclate);
    listePieces.forEach((p) => p.position.copy(p.userData.eclate).multiplyScalar(t));
    // Les fluides suivent les pièces assemblées : on les masque dès que la maquette s'ouvre
    fluides.groupe.visible = fluidesActifs && eclate < 0.02;
    cadrer();
  }

  // Opacité de chaque maillage selon la carrosserie (fondu) et la vue « fantôme » des fluides
  function appliquerMateriaux() {
    racine.traverse((o) => {
      if (!o.isMesh) return;
      const b = o.userData.base, enCaisse = pieceDe(o).userData.carrosserie;
      let opacite = b.opacite, transparent = b.transparent;
      if (fluidesActifs) { opacite = Math.min(opacite, enCaisse ? 0.08 : 0.22); transparent = true; }
      if (enCaisse) { opacite *= douce(caisse); transparent = true; }
      o.material.opacity = opacite;
      o.material.transparent = transparent;
      o.material.depthWrite = transparent ? false : b.depthWrite;
      o.material.needsUpdate = true;
    });
    carrosserie.forEach((p) => { p.visible = caisse > 0.01; });
  }

  function basculer(bouton, actif, libelleActif, libelleInactif) {
    bouton.setAttribute('aria-pressed', String(actif));
    const libelle = bouton.querySelector('[data-libelle]');
    if (libelle && libelleActif) libelle.textContent = actif ? libelleActif : libelleInactif;
  }

  boutonEclate.addEventListener('click', () => {
    cibleEclate = cibleEclate ? 0 : 1;
    basculer(boutonEclate, !!cibleEclate, 'RÉASSEMBLER', 'VUE ÉCLATÉE');
    cadre.classList.toggle('est-eclate', !!cibleEclate);
    // En vue éclatée, la maquette arrête de tourner toute seule : les pièces restent faciles à viser
    controles.autoRotate = !mouvementReduit && !cibleEclate;
    if (mouvementReduit) { eclate = cibleEclate; appliquerEclate(); }
    demanderRendu();
  });

  if (boutonVoiture) boutonVoiture.addEventListener('click', () => {
    cibleCaisse = cibleCaisse ? 0 : 1;
    basculer(boutonVoiture, !!cibleCaisse, 'MASQUER LA VOITURE', 'AFFICHER LA VOITURE');
    if (mouvementReduit) { caisse = cibleCaisse; appliquerMateriaux(); cadrer(); }
    demanderRendu();
  });

  if (boutonFluides) boutonFluides.addEventListener('click', () => {
    fluidesActifs = !fluidesActifs;
    basculer(boutonFluides, fluidesActifs);
    if (legendeFluides) legendeFluides.hidden = !fluidesActifs;
    fluides.groupe.visible = fluidesActifs && eclate < 0.02;
    appliquerMateriaux();
    demanderRendu();
  });

  if (boutonAcceleration) {
    if (mouvementReduit) {
      boutonAcceleration.disabled = true;
      boutonAcceleration.title = 'Désactivé : votre système demande de réduire les animations';
    }
    boutonAcceleration.addEventListener('click', () => {
      sim.etat.actif = !sim.etat.actif;
      sim.etat.phase = 'ralenti';
      sim.etat.t = 0;
      basculer(boutonAcceleration, sim.etat.actif);
      if (panneauSimulation) panneauSimulation.hidden = !sim.etat.actif;
      demanderRendu();
    });
  }

  // Zoom au clavier ou au doigt : boutons + / − et recentrage
  cadre.querySelectorAll('[data-zoom]').forEach((b) => {
    b.addEventListener('click', () => {
      const sens = Number(b.dataset.zoom);
      if (!sens) { recentrer(); return; }
      const ecart = camera.position.clone().sub(controles.target);
      const longueur = THREE.MathUtils.clamp(ecart.length() * (sens > 0 ? 0.75 : 1.33), controles.minDistance, controles.maxDistance);
      camera.position.copy(controles.target).addScaledVector(ecart.normalize(), longueur);
      demanderRendu();
    });
  });

  /* ---------- Survol et clic sur une pièce ---------- */
  const rayon = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let survolee = null;

  function pieceDe(o) {
    while (o && !(o.userData && o.userData.piece)) o = o.parent;
    return o;
  }

  function pieceSous(e) {
    const zone = rendu.domElement.getBoundingClientRect();
    pointeur.set(((e.clientX - zone.left) / zone.width) * 2 - 1, -((e.clientY - zone.top) / zone.height) * 2 + 1);
    rayon.setFromCamera(pointeur, camera);
    const touches = rayon.intersectObject(racine, true);
    for (const touche of touches) {
      const p = pieceDe(touche.object);
      if (!p || !p.visible) continue;
      // Voiture assemblée : la carrosserie (en transparence) laisse passer le clic vers la mécanique
      if (p.userData.carrosserie && eclate < 0.5) continue;
      return p;
    }
    return null;
  }

  function surligner(p, actif) {
    if (!p) return;
    p.traverse((o) => {
      if (o.isMesh) {
        o.material.emissive.setHex(actif ? 0x7c3aed : (o.userData.emissif || 0));
        o.material.emissiveIntensity = actif ? 0.45 : (o.userData.intensite || 0);
      }
    });
  }

  function changerSurvol(p) {
    if (p === survolee) return;
    surligner(survolee, false);
    survolee = p;
    surligner(survolee, true);
    zoneSurvol.textContent = p ? p.userData.nom + (p.userData.fiche ? ' — cliquer pour la fiche' : '') : '';
    zoneSurvol.classList.toggle('est-visible', !!p);
    rendu.domElement.style.cursor = p && p.userData.fiche ? 'pointer' : '';
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
    if (p.userData.fiche && window.ouvrirFiche) window.ouvrirFiche(p.userData.fiche);
  });

  /* ---------- Panneau de simulation ---------- */
  const texteRapport = panneauSimulation && panneauSimulation.querySelector('[data-rapport]');
  const barreRegime = panneauSimulation && panneauSimulation.querySelector('[data-regime]');
  function afficherSimulation() {
    if (!panneauSimulation || panneauSimulation.hidden) return;
    const s = sim.etat;
    texteRapport.textContent = s.rapport ? 'rapport ' + s.rapport : 'point mort';
    barreRegime.style.transform = 'scaleX(' + ((s.regime - RALENTI) / (REGIME_MAX - RALENTI) * 0.9 + 0.1).toFixed(3) + ')';
  }

  /* ---------- Boucle de rendu ---------- */
  const horloge = new THREE.Clock();
  let visible = true;
  let enCours = false;

  function image() {
    enCours = false;
    const dt = Math.min(horloge.getDelta(), 0.05);
    if (!mouvementReduit) {
      const angles = sim.etape(dt);
      meca.poser(angles);
      // Débit des fluides : pompe à eau et pompe à huile suivent le moteur, la pompe à essence est électrique
      if (fluides.groupe.visible) {
        const vitesses = { moteur: omega(sim.etat.regime) * 0.35, carburant: 0.6 + sim.etat.charge * 0.9 };
        Object.keys(fluides.textures).forEach((type) => {
          const v = vitesses[FLUIDES[type].vitesse];
          fluides.textures[type].forEach((f) => { f.tex.offset.x -= v * f.facteur * dt; });
        });
      }
      afficherSimulation();
    }
    let bouge = false;
    if (Math.abs(cibleEclate - eclate) > 0.001) {
      eclate += (cibleEclate - eclate) * Math.min(1, dt * 3.2);
      if (Math.abs(cibleEclate - eclate) <= 0.001) eclate = cibleEclate;
      appliquerEclate();
      bouge = true;
    }
    if (Math.abs(cibleCaisse - caisse) > 0.001) {
      caisse += (cibleCaisse - caisse) * Math.min(1, dt * 3.5);
      if (Math.abs(cibleCaisse - caisse) <= 0.001) caisse = cibleCaisse;
      appliquerMateriaux();
      cadrer();
      bouge = true;
    }
    controles.update();
    rendu.render(scene, camera);
    if (cibleEclate || eclate > 0.01 || survolee) placerEtiquettes();
    // On continue tant que quelque chose bouge et que la vue est à l'écran
    if (visible && !document.hidden && (!mouvementReduit || bouge)) demanderRendu();
  }

  function demanderRendu() {
    if (!enCours) {
      enCours = true;
      requestAnimationFrame(image);
    }
  }

  controles.addEventListener('change', demanderRendu);
  // Accès pour le débogage depuis la console (pièces, caméra, contrôles)
  window.MoteurM54 = { pieces: pieces, camera: camera, controles: controles, rendre: demanderRendu };
  new IntersectionObserver((entrees) => {
    visible = entrees[0].isIntersecting;
    if (visible) { horloge.getDelta(); demanderRendu(); }
  }).observe(zoneScene);
  document.addEventListener('visibilitychange', demanderRendu);

  appliquerMateriaux();
  redimensionner();
  cadre.classList.add('est-pret');
  return pieces;
}


/* ==========================================================================
   10. Mini-maquette dans la fiche ouverte
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
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
      mini = { rendu: rendu, scene: scene, camera: camera, racine: null };
    }
    conteneur.appendChild(mini.rendu.domElement);

    // Copie des pièces concernées, assemblées et centrées
    if (mini.racine) mini.scene.remove(mini.racine);
    const racine = new THREE.Group();
    liste.forEach((id) => {
      const copie = pieces[id].clone(true);
      copie.position.set(0, 0, 0);
      copie.visible = true;
      copie.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.emissive.setHex(o.userData.emissif || 0);
          o.material.emissiveIntensity = o.userData.intensite || 0;
          if (o.userData.base) {
            o.material.opacity = o.userData.base.opacite;
            o.material.transparent = o.userData.base.transparent;
            o.material.depthWrite = o.userData.base.depthWrite;
          }
        }
      });
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

    mini.camera.position.set(-0.9, 0.55, 1).normalize().multiplyScalar(taille * 1.3);
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

  // 2. Librairie 3D (Three.js et ses modules complémentaires)
  try {
    const modules = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/utils/BufferGeometryUtils.js')
    ]);
    THREE = modules[0];
    OrbitControls = modules[1].OrbitControls;
    RoomEnvironment = modules[2].RoomEnvironment;
    RoundedBoxGeometry = modules[3].RoundedBoxGeometry;
    mergeGeometries = modules[4].mergeGeometries;
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
    console.error(e);
  }
}
lancer();
