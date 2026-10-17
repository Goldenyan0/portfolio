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
   - Visite guidée : pendant les fiches de la documentation, la voiture reste à l'écran
     et la caméra rejoint la pièce de chaque fiche ; la maquette complète vient ensuite.
     Pendant le voyage 3D (espace-3d.js), c'est la carte lue qui choisit la vue
   - Boutons : vue éclatée (voiture comprise ; pièces numérotées, nom au survol du numéro),
     figer / reprendre la rotation, voiture affichée / masquée, mode accélération (moteur à
     l'arrêt au chargement), fluides animés + légende ; panneau « Affichage » pour montrer ou
     masquer chaque groupe d'éléments ; « voir cet angle » : la vue de la photo, rotation figée
   - Tour du propriétaire : points de l'extérieur et de l'intérieur (fiches des pièces),
     retour à la vue de base, ouvrants refermés avant chaque étape
   - Zoom à la molette (après un clic dans la vue) ou au pincement, boutons + / −
   - Survol : nom de la pièce ; clic : ouverture de la fiche correspondante
   - Mini-maquette 3D dans chaque fiche ouverte (événement "fiche:ouverte")
   Librairie : Three.js (importée via l'importmap de e39.html).
   Mouvement réduit : pas de rotation automatique, pas de mécanique ni de fluides
   animés, mode accélération désactivé, vue éclatée sans transition.
   ========================================================================== */

// Carrosserie détaillée : le modèle 3D « BMW E39 Free » (Black Snow, CC BY 4.0), découpé en panneaux
import { chargerCarrosserie } from './carrosserie-e39.js';

// Three.js est importé dynamiquement (voir "Démarrage") : si le chargement échoue,
// on peut l'attraper et afficher la vraie cause au lieu d'une page muette.
let THREE, OrbitControls, RoomEnvironment, RoundedBoxGeometry, mergeGeometries, GLTFLoader, MeshoptDecoder;

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
  // Carrosserie : bleu topaze métallisé sous vernis (opaque ; transparence en option)
  peinture: { color: 0x1a3479, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04, side: 2, physique: true },
  // Baie moteur peinte comme la caisse, sans le vernis brillant de l'extérieur
  peintureBaie: { color: 0x1c3470, metalness: 0.1, roughness: 0.62, side: 2 },
  argent: { color: 0xd9dde3, metalness: 0.85, roughness: 0.28 },
  plastiqueOuvert: { color: 0x2c2c34, metalness: 0.05, roughness: 0.7, side: 2 },
  conduite: { color: 0x7d8189, metalness: 0.6, roughness: 0.45 },
  orange: { color: 0xe8590c, metalness: 0.1, roughness: 0.5 },
  rouge: { color: 0xd61f26, metalness: 0.1, roughness: 0.45 },
  bidon: { color: 0xf3f1ea, metalness: 0, roughness: 0.35, transparent: true, opacity: 0.82 },
  fonteFrein: { color: 0x6f7279, metalness: 0.7, roughness: 0.5 },
  etrier: { color: 0x2e3036, metalness: 0.5, roughness: 0.45 },
  gomme: { color: 0x15151a, metalness: 0, roughness: 0.95 },
  jante: { color: 0xc9ced6, metalness: 0.9, roughness: 0.22 },
  vitre: { color: 0x101820, metalness: 0.3, roughness: 0.04, transparent: true, opacity: 0.55, depthWrite: false, side: 2 },
  plaque: { color: 0xf4f4f2, metalness: 0, roughness: 0.6 },
  cuir: { color: 0x2a2a30, metalness: 0, roughness: 0.75 },
  optique: { color: 0xe8eef5, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false },
  feuRouge: { color: 0xc81e1e, metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.85 },
  feuBlanc: { color: 0xf3f4f6, metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.85 },
  angelEyes: { color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: 0.9, metalness: 0, roughness: 0.4 },
  garniture: { color: 0x1c1c22, metalness: 0.1, roughness: 0.6 }
};

// Chaque maillage reçoit sa propre copie du matériau : on peut ainsi
// en éclairer un seul au survol sans toucher aux autres.
function materiau(nom) {
  const { physique, ...reglages } = MATERIAUX[nom];
  return physique ? new THREE.MeshPhysicalMaterial(reglages) : new THREE.MeshStandardMaterial(reglages);
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
const R_PNEU = mm(321.6);                 // 235/45 R17 (ma voiture) : diamètre 643 mm
const L_PNEU = mm(235);
const R_JANTE = mm(216);                  // jante 17 pouces
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

// Repère du modèle de carrosserie (mètres, avant vers -Z, droite de la voiture vers +X) → maquette :
// mise à l'échelle, quart de tour autour de Y, essieux du modèle calés sur ceux de la maquette
const S_GLB = mm(1000);
const TX_GLB = (X_AV + X_AR) / 2 + 0.1025 * S_GLB;      // milieu des essieux du modèle : z = -0,1025 m
const TY_GLB = Y_ROUE - 0.155 * S_GLB;                  // axe des roues du modèle : y = 0,155 m
const depuisGlb = (x, y, z) => [z * S_GLB + TX_GLB, y * S_GLB + TY_GLB, -x * S_GLB];
// Repères tirés du modèle : moyeu du volant (conduite à gauche) et tablier
const P_VOLANT = depuisGlb(-0.38, 0.72, -0.365);
const X_TABLIER = depuisGlb(0, 0, -0.985)[0];
// Charnières des ouvrants (repère de la maquette) : point de l'axe et axe de rotation
const CHARNIERES = {
  capot: { point: depuisGlb(0, 0.795, -0.935), axe: 'z', angle: -0.95 },
  coffre: { point: depuisGlb(0, 0.885, 1.745), axe: 'z', angle: 1.05 },
  porteAvG: { point: depuisGlb(-0.865, 0.5, -0.915), axe: 'y', angle: -1.1 },
  porteAvD: { point: depuisGlb(0.865, 0.5, -0.915), axe: 'y', angle: 1.1 },
  porteArG: { point: depuisGlb(-0.865, 0.5, 0.185), axe: 'y', angle: -1.05 },
  porteArD: { point: depuisGlb(0.865, 0.5, 0.185), axe: 'y', angle: 1.05 }
};

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

  // --- Boîtier de filtre à huile : bol vertical à l'avant, côté admission, couvercle à six pans
  //     accessible par le dessus (comme sur la photo de la baie) ---
  const filtreHuile = ajouter(piece('filtreHuile', 'Boîtier de filtre à huile', 'lubrification', [-0.4, 1.6, 2.4]));
  filtreHuile.add(place(maillage(boite(0.55, 0.4, 0.5, 0.06), 'alu'), -3.35, 0.95, 1.15));          // embase vissée sur le bloc
  filtreHuile.add(place(maillage(cylindre(0.36, 1.45, 32), 'noir'), -3.35, 1.72, 1.65));            // bol
  [1.2, 1.6, 2.0].forEach((y) => filtreHuile.add(place(maillage(toreY(0.362, 0.015), 'plastique'), -3.35, y, 1.65)));
  filtreHuile.add(place(maillage(cylindre(0.38, 0.12, 32), 'plastique'), -3.35, 2.5, 1.65));        // couvercle
  filtreHuile.add(place(maillage(cylindre(0.17, 0.14, 6), 'plastique'), -3.35, 2.62, 1.65));         // six pans


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
  // Goulotte et bouchon de remplissage d'huile : ils dépassent du cache moteur, côté échappement
  cache.add(place(maillage(cylindre(0.17, 0.92, 24), 'noir'), -1.2, 3.6, -0.72));
  cache.add(place(maillage(cylindre(0.23, 0.14, 24), 'plastique'), -1.2, 4.12, -0.72));
  cache.add(place(maillage(boite(0.4, 0.09, 0.09, 0.03), 'plastique'), -1.2, 4.22, -0.72));
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

  // --- Boîte à air (filtre) : le grand boîtier noir du coin avant gauche, derrière le projecteur,
  //     couvercle à agrafes et prise d'air vers l'avant ---
  const boiteAir = ajouter(piece('boiteAir', 'Boîte à air (filtre à air)', 'admission', [-3.2, 1.0, 4.2]));
  boiteAir.add(place(maillage(boite(3.4, 1.95, 2.7, 0.3), 'plastique'), -5.7, 0.28, 5.65));         // cuve
  boiteAir.add(place(maillage(boite(3.5, 0.95, 2.8, 0.3), 'noir'), -5.7, 1.62, 5.65));             // couvercle
  boiteAir.add(place(maillage(boite(3.56, 0.08, 2.86, 0.03), 'plastique'), -5.7, 1.2, 5.65));      // joint de couvercle
  [-6.8, -5.7, -4.6].forEach((x) => [4.25, 7.05].forEach((z) => boiteAir.add(place(maillage(boite(0.22, 0.42, 0.08, 0.03), 'acier'), x, 1.2, z))));
  for (let k = 0; k < 5; k++) boiteAir.add(place(maillage(boite(2.6, 0.05, 0.08, 0.02), 'plastique'), -5.8, 2.11, 4.75 + k * 0.45));
  boiteAir.add(tuyau([[-7.3, 1.5, 6.2], [-7.9, 1.95, 6.45], [-8.6, 2.55, 6.7]], 0.32, 'plastique'));   // prise d'air
  boiteAir.add(place(maillage(axeZ(cylindre(0.5, 0.18, 32)), 'plastique'), -4.6, 1.2, 4.22));      // bride de sortie

  // --- Débitmètre d'air (MAF), monté sur la sortie de la boîte à air ---
  const debitmetre = ajouter(piece('debitmetre', "Débitmètre d'air (MAF)", 'admission', [-2.6, 2.6, 4.6]));
  debitmetre.add(place(maillage(axeZ(cylindre(0.44, 0.8, 32)), 'noir'), -4.6, 1.2, 3.75));
  [4.12, 3.38].forEach((z) => debitmetre.add(place(maillage(toreZ(0.45, 0.04), 'acier'), -4.6, 1.2, z)));
  debitmetre.add(place(maillage(boite(0.3, 0.26, 0.42, 0.05), 'plastique'), -4.6, 1.72, 3.75));   // boîtier de mesure
  debitmetre.add(place(maillage(boite(0.2, 0.16, 0.16, 0.03), 'noir'), -4.6, 1.78, 4.05));        // connecteur

  // --- Manchon d'admission : le soufflet caoutchouc entre le débitmètre et le papillon
  //     (c'est lui qui fuyait au test fumée du 14/10/2026) ---
  const manchon = ajouter(piece('manchon', "Manchon d'admission", 'admission', [-1.8, 1.6, 3.6]));
  manchon.add(tuyau([[-4.6, 1.2, 3.36], [-4.58, 0.95, 3.02], [-4.32, 0.66, 2.87], [-3.93, 0.6, 2.85]], 0.4, 'caoutchouc', { cotes: 20 }));
  [[-4.6, 1.2, 3.3], [-4.0, 0.6, 2.85]].forEach(([x, y, z], k) => {
    const collier = place(maillage(k ? toreX(0.41, 0.035) : toreZ(0.42, 0.035), 'acier'), x, y, z);
    manchon.add(collier);
  });
  // Plis du soufflet
  [0.3, 0.5, 0.7].forEach((t) => {
    const c = new THREE.CatmullRomCurve3([[-4.6, 1.2, 3.36], [-4.58, 0.95, 3.02], [-4.32, 0.66, 2.87], [-3.93, 0.6, 2.85]].map(v3));
    const p = c.getPoint(t), d = c.getTangent(t);
    const pli = place(maillage(toreZ(0.42, 0.03), 'caoutchouc'), p.x, p.y, p.z);
    pli.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    manchon.add(pli);
  });

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

  // --- Vanne DISA, centrée sur le collecteur (d'après la pièce de référence) : volet enfiché
  //     dans le plénum, bride ronde et joint orange, boîtier d'actionneur rectangulaire,
  //     embout rond, connecteur 2 broches et petite prise de dépression en laiton ---
  const disa = ajouter(piece('disa', 'Vanne DISA', 'disa', [0, 2.2, 3.4]));
  disa.add(place(maillage(axeZ(cylindre(0.29, 0.5, 28)), 'plastique'), 0, 0.6, 3.0));              // corps du volet (dans le plénum)
  disa.add(place(maillage(axeZ(cylindre(0.37, 0.07, 32)), 'noir'), 0, 0.6, 3.3));                  // bride
  disa.add(place(maillage(toreZ(0.31, 0.032), 'orange'), 0, 0.6, 3.255));                           // joint torique orange
  disa.add(place(maillage(boite(0.62, 0.62, 0.32, 0.08), 'noir'), 0, 0.6, 3.48));                   // col
  disa.add(place(maillage(boite(1.75, 0.72, 0.6, 0.1), 'noir'), 0.38, 0.62, 3.9));                  // boîtier d'actionneur
  disa.add(place(maillage(boite(1.79, 0.05, 0.64, 0.02), 'plastique'), 0.38, 0.86, 3.9));           // jonction du couvercle
  disa.add(place(maillage(axeX(cylindre(0.3, 0.3, 28)), 'plastique'), -0.62, 0.6, 3.78));           // embout rond
  disa.add(place(maillage(boite(0.24, 0.22, 0.2, 0.03), 'plastique'), -0.3, 1.08, 3.78));           // connecteur
  [-0.04, 0.04].forEach((dz) => disa.add(place(maillage(cylindre(0.012, 0.12, 6), 'cuivre'), -0.3, 1.16, 3.78 + dz)));
  disa.add(place(maillage(axeZ(cylindre(0.05, 0.16, 12)), 'cuivre'), -0.42, 0.36, 3.66));           // prise de dépression

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
  // Silencieux arrière transversal ; la sortie unique, à gauche, est celle du modèle de carrosserie
  const arriere = place(maillage(axeZ(cylindre(0.6, 8.6, 40)), 'echappement'), 36.0, -3.0, 0.7);
  arriere.scale.set(1.9, 1.05, 1);
  ligne.add(arriere);
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

  // Poulies de la courroie d'accessoires (vues de face, plan YZ) dans l'ordre de parcours :
  // la pompe de direction assistée est à gauche, sous l'alternateur (son bocal est à côté
  // du boîtier de filtre à huile sur la photo de la baie) ; galet tendeur côté droit
  const X_COURROIE = -4.05;
  const POULIES = [
    { id: 'vilebrequin', z: 0, y: -1.0, r: 0.95 },
    { id: 'direction', z: 2.0, y: -1.3, r: 0.6 },
    { id: 'alternateur', z: 1.95, y: 0.3, r: 0.36 },
    { id: 'pompe', z: 0, y: 0.8, r: 0.65 },
    { id: 'tendeur', z: -1.5, y: -0.1, r: 0.42, galet: true }
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
  const poulies = ajouter(piece('poulies', "Courroie et poulies d'accessoires", 'refroidissement', [-2.4, 0, 0]));
  POULIES.forEach((p) => {
    const g = tourne(new THREE.Group(), 'moteur', 0.95 / p.r * (p.dos ? -1 : 1));
    g.position.set(X_COURROIE, p.y, p.z);
    if (p.dos || p.galet) {
      // Galet tendeur lisse, sur son bras articulé (tourné vers le centre du moteur)
      g.add(maillage(axeX(cylindre(p.r, 0.26, 40)), 'acier'));
      g.add(place(maillage(axeX(cylindre(p.r * 0.4, 0.3, 20)), 'alu'), 0, 0, 0));
      poulies.add(place(maillage(boite(0.14, 0.2, 1.0, 0.04), 'alu'), X_COURROIE + 0.2, p.y + 0.15, p.z + (p.z < 0 ? 0.35 : -0.35)));
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
  const alternateur = ajouter(piece('alternateur', 'Alternateur', 'alternateur', [-1.6, 0.6, 2.6]));
  alternateur.add(place(maillage(axeX(cylindre(0.5, 1.0, 32)), 'alu'), -3.4, 0.3, 1.95));
  [-3.7, -3.5, -3.3, -3.1].forEach((x) => alternateur.add(place(maillage(toreX(0.5, 0.025), 'alu'), x, 0.3, 1.95)));
  alternateur.add(place(maillage(axeX(cylindre(0.38, 0.12, 24)), 'noir'), -2.86, 0.3, 1.95));
  alternateur.add(place(maillage(boite(0.5, 0.2, 0.4, 0.04), 'alu'), -3.3, -0.25, 1.55));

  // --- Pompe de direction assistée (à gauche, sous l'alternateur, entraînée par la courroie) ---
  const pompeDA = ajouter(piece('pompeDA', 'Pompe de direction assistée', 'direction', [-1.6, -0.8, 2.6]));
  pompeDA.add(place(maillage(axeX(cylindre(0.5, 0.9, 32)), 'alu'), -3.45, -1.3, 2.0));
  pompeDA.add(place(maillage(axeX(cylindre(0.42, 0.25, 32)), 'alu'), -2.9, -1.3, 2.0));
  pompeDA.add(tuyau([[-3.2, -1.55, 2.3], [-3.25, -1.75, 2.5], [-3.3, -1.9, 2.6]], 0.07, 'caoutchouc'));   // haute pression vers le boîtier

  // --- Bocal de direction assistée : rond, bouchon nervuré, à côté du filtre à huile ---
  const bocalDA = ajouter(piece('bocalDA', 'Bocal de direction assistée', 'direction', [-1.4, 2.8, 2.8]));
  bocalDA.add(place(maillage(cylindre(0.32, 0.8, 32), 'noir'), -3.6, 1.95, 2.75));
  bocalDA.add(place(maillage(cylindre(0.34, 0.12, 12), 'plastique'), -3.6, 2.41, 2.75));
  autour(8, (a) => bocalDA.add(place(maillage(boite(0.05, 0.1, 0.12, 0.01), 'plastique'), -3.6 + Math.sin(a) * 0.3, 2.43, 2.75 + Math.cos(a) * 0.3)));
  bocalDA.add(place(maillage(cylindre(0.08, 0.3, 12), 'noir'), -3.6, 1.45, 2.75));
  bocalDA.add(tuyau([[-3.6, 1.32, 2.75], [-3.0, 0.9, 2.86], [-2.92, -0.3, 2.72], [-3.2, -0.85, 2.3]], 0.07, 'caoutchouc'));

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
  const demarreur = ajouter(piece('demarreur', 'Démarreur', 'demarreur', [-0.8, -1.4, 2.2]));
  demarreur.add(place(maillage(axeX(cylindre(0.42, 1.4, 32)), 'noir'), 2.75, -1.65, 1.65));
  demarreur.add(place(maillage(axeX(cylindre(0.2, 0.8, 20)), 'acier'), 2.65, -1.12, 1.65));
  demarreur.add(place(maillage(denture(0.14, 10, 0.04, 0.12), 'acier'), 3.55, -1.65, 1.65));

  // --- Calculateur MS43 (DME), dans son boîtier à l'arrière droit du compartiment ---
  const dme = ajouter(piece('dme', 'Calculateur MS43', 'gestion', [1.0, 2.0, -1.6]));
  const d = new THREE.Group();
  d.position.set(3.3, 2.4, -5.0);
  dme.add(d);
  d.add(maillage(boite(1.0, 0.22, 0.75, 0.04), 'alu'));
  for (let k = 0; k < 7; k++) d.add(place(maillage(boite(0.9, 0.05, 0.03, 0.01), 'alu'), 0, 0.13, -0.3 + k * 0.1));
  [-0.3, 0, 0.3].forEach((x) => d.add(place(maillage(boite(0.26, 0.16, 0.18, 0.03), 'noir'), x, 0.04, 0.44)));
  dme.add(tuyau([[3.3, 2.45, -4.55], [3.2, 2.6, -3.0], [3.0, 2.5, -1.2], [2.6, 3.3, 0.42]], 0.07, 'plastique'));

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
  radiateur.add(place(maillage(new THREE.ShapeGeometry(plaque, 24).rotateY(-Math.PI / 2), 'plastiqueOuvert'), -6.55, 0, 0));
  radiateur.add(place(maillage(axeX(tubeOuvert(2.05, 1.6, 48)), 'plastiqueOuvert'), -5.75, 0.8, 0));

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

  // --- Roues de ma voiture : pneus 235/45 R17, jantes argent à 5 doubles branches en V ---
  // Pavé entre deux points du plan de la roue (branche de jante)
  function branche(a, b, largeur, epaisseur, z, nomMateriau) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const m = maillage(boite(largeur, Math.hypot(dx, dy), epaisseur, 0.05), nomMateriau);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
    m.rotation.z = Math.atan2(-dx, dy);
    return m;
  }
  function roue(id, nom, fiche, x, s, eclate) {
    const p = ajouter(piece(id, nom, fiche, eclate));
    const support = new THREE.Group();
    support.position.set(x, Y_ROUE, s * (x < 0 ? Z_AV : Z_AR));
    p.add(support);
    const tournant = tourne(new THREE.Group(), 'roues', 1, 'z');
    support.add(tournant);
    // Pneu : flancs bombés de série 45, bande de roulement et rainures
    const profil = [[R_JANTE + 0.02, -1.2], [2.75, -1.33], [3.25, -1.36], [3.55, -1.28], [3.68, -1.1], [R_PNEU, -0.85],
      [R_PNEU, 0.85], [3.68, 1.1], [3.55, 1.28], [3.25, 1.36], [2.75, 1.33], [R_JANTE + 0.02, 1.2]]
      .map(([r, h]) => new THREE.Vector2(r, h));
    tournant.add(maillage(axeZ(new THREE.LatheGeometry(profil, 72)), 'pneu'));
    [-0.45, 0, 0.45].forEach((z) => tournant.add(place(maillage(toreZ(R_PNEU - 0.01, 0.035), 'gomme'), 0, 0, z)));
    // Jante 17 pouces : fût, rebords, voile à 5 doubles branches en V, écrous, cache-moyeu
    tournant.add(maillage(axeZ(tubeOuvert(R_JANTE - 0.04, 2.3, 56)), 'aluOuvert'));
    [-1.17, 1.17].forEach((z) => tournant.add(place(maillage(toreZ(R_JANTE + 0.02, 0.08), 'jante'), 0, 0, z)));
    tournant.add(place(maillage(axeZ(tubeOuvert(R_JANTE - 0.1, 0.25, 56)), 'jante'), 0, 0, s * 0.98));
    tournant.add(place(maillage(axeZ(cylindre(0.62, 0.3, 32)), 'jante'), 0, 0, s * 0.82));
    autour(5, (a) => {
      [-1, 1].forEach((d) => {
        const ai = a + d * 0.07, ae = a + d * 0.2;
        tournant.add(branche([Math.sin(ai) * 0.55, Math.cos(ai) * 0.55], [Math.sin(ae) * 2.42, Math.cos(ae) * 2.42], 0.22, 0.16, s * 0.9, 'jante'));
      });
      tournant.add(place(maillage(axeZ(cylindre(0.075, 0.14, 6)), 'acier'), Math.sin(a + 0.63) * 0.42, Math.cos(a + 0.63) * 0.42, s * 1.0));
    });
    tournant.add(place(maillage(axeZ(cylindre(0.26, 0.08, 32)), 'garniture'), 0, 0, s * 1.0));
    tournant.add(place(maillage(axeZ(cylindre(0.2, 0.09, 32)), 'argent'), 0, 0, s * 1.02));
    return p;
  }
  roue('roueArG', 'Roue arrière gauche (motrice)', 'transmission', X_AR, 1, [7.5, 0, 4]);
  roue('roueArD', 'Roue arrière droite (motrice)', 'transmission', X_AR, -1, [7.5, 0, -4]);
  roue('roueAvG', 'Roue avant gauche', 'freinage', X_AV, 1, [0, 0, 5]);
  roue('roueAvD', 'Roue avant droite', 'freinage', X_AV, -1, [0, 0, -5]);


  /* ---------------- Freinage : 4 disques (ventilés à l'avant), étriers, ABS ---------------- */

  // --- Disques : ventilés à l'avant (deux pistes reliées par des ailettes), pleins à l'arrière ;
  //     ils tournent avec la roue ---
  function disqueFrein(id, nom, x, s, ventile) {
    const p = ajouter(piece(id, nom, 'freinage', [x < 0 ? -1.2 : 8.5, 0, s * 2.6]));
    const support = new THREE.Group();
    support.position.set(x, Y_ROUE, s * ((x < 0 ? Z_AV : Z_AR) - 0.3));
    p.add(support);
    const t = tourne(new THREE.Group(), 'roues', 1, 'z');
    support.add(t);
    const R = ventile ? mm(143) : mm(138);
    const piste = (z, e) => {
      const forme = [[0.95, -e / 2], [R, -e / 2], [R, e / 2], [0.95, e / 2]].map(([r, h]) => new THREE.Vector2(r, h));
      forme.push(forme[0].clone());
      return place(maillage(axeZ(new THREE.LatheGeometry(forme, 64)), 'fonteFrein'), 0, 0, z);
    };
    if (ventile) {
      t.add(piste(-0.09, 0.075), piste(0.09, 0.075));
      autour(30, (a) => {
        const ailette = place(maillage(boite(0.05, R - 1.0, 0.11, 0.01), 'fonteFrein'), Math.sin(a) * (R + 0.95) / 2, Math.cos(a) * (R + 0.95) / 2, 0);
        ailette.rotation.z = -a;
        t.add(ailette);
      });
    } else {
      t.add(piste(0, mm(10)));
    }
    // Bol (cloche) et moyeu avec ses 5 goujons
    t.add(place(maillage(axeZ(cylindre(0.98, 0.06, 40)), 'fonteFrein'), 0, 0, s * 0.12));
    t.add(place(maillage(axeZ(tubeOuvert(0.98, 0.45, 40)), 'fonteFrein'), 0, 0, s * 0.33));
    t.add(place(maillage(axeZ(cylindre(0.98, 0.05, 40)), 'fonteFrein'), 0, 0, s * 0.55));
    autour(5, (a) => t.add(place(maillage(axeZ(cylindre(0.05, 0.3, 8)), 'acier'), Math.sin(a + 0.63) * 0.42, Math.cos(a + 0.63) * 0.42, s * 0.62)));
    return p;
  }
  disqueFrein('disqueAvG', 'Disque de frein avant gauche (ventilé)', X_AV, 1, true);
  disqueFrein('disqueAvD', 'Disque de frein avant droit (ventilé)', X_AV, -1, true);
  disqueFrein('disqueArG', 'Disque de frein arrière gauche', X_AR, 1, false);
  disqueFrein('disqueArD', 'Disque de frein arrière droit', X_AR, -1, false);

  // --- Étriers : à piston, ils pincent le disque avec deux plaquettes ;
  //     à l'arrière du disque sur l'essieu avant, à l'avant sur l'essieu arrière ---
  function etrier(id, nom, x, s) {
    const p = ajouter(piece(id, nom, 'freinage', [x < 0 ? -1.2 : 8.5, 1.2, s * 4.2]));
    const g = new THREE.Group();
    const avant = x < 0;
    g.position.set(x, Y_ROUE, s * ((avant ? Z_AV : Z_AR) - 0.3));
    g.rotation.z = avant ? -1.2 : 1.2;                             // position angulaire autour du disque
    p.add(g);
    const R = avant ? mm(143) : mm(138);
    const r = R - 0.28;
    // Corps en arc qui chevauche la piste, côté extérieur et côté intérieur
    [s * 0.3, -s * 0.3].forEach((z) => {
      const arc = place(maillage(new THREE.TorusGeometry(r, 0.24, 10, 16, 1.0), 'etrier'), 0, 0, z);
      arc.rotation.z = -0.5 + Math.PI / 2;
      arc.scale.set(1, 1, 0.9);
      g.add(arc);
    });
    g.add(place(maillage(boite(1.0, 0.3, 0.86, 0.1), 'etrier'), 0, R + 0.12, 0));                    // pont au-dessus de la piste
    g.add(place(maillage(axeZ(cylindre(0.33, 0.35, 28)), 'etrier'), 0, r - 0.05, -s * 0.5));          // piston (côté intérieur)
    [s * 0.16, -s * 0.16].forEach((z) => g.add(place(maillage(boite(0.9, 0.42, 0.06, 0.02), 'friction'), 0, r, z)));   // plaquettes
    g.add(place(maillage(cylindre(0.045, 0.2, 8), 'acier'), 0.3, r + 0.38, -s * 0.4));                  // vis de purge
    [-0.45, 0.45].forEach((dx) => g.add(place(maillage(axeZ(cylindre(0.07, 0.95, 10)), 'acier'), dx, r + 0.1, 0)));   // colonnettes
    return p;
  }
  etrier('etrierAvG', 'Étrier de frein avant gauche', X_AV, 1);
  etrier('etrierAvD', 'Étrier de frein avant droit', X_AV, -1);
  etrier('etrierArG', 'Étrier de frein arrière gauche', X_AR, 1);
  etrier('etrierArD', 'Étrier de frein arrière droit', X_AR, -1);


  /* ---------------- Châssis ---------------- */

  // --- Train avant : berceau (traverse et supports moteur), bras, jambes de force McPherson ---
  const berceauAv = ajouter(piece('berceauAv', 'Berceau avant', 'suspension', [0, -1.6, 0]));
  berceauAv.add(place(maillage(boite(0.8, 0.7, 10.8, 0.1), 'acier'), -2.3, -3.0, 0));
  [-1, 1].forEach((s) => berceauAv.add(place(maillage(cylindre(0.3, 0.75, 20), 'caoutchouc'), -1.8, -2.27, s * 1.6)));
  const brasAv = ajouter(piece('brasAv', 'Bras de suspension avant', 'suspension', [0, -2.2, 0]));
  const jambesAv = ajouter(piece('jambesAv', 'Jambes de force avant', 'suspension', [0, 2.4, 0]));
  [-1, 1].forEach((s) => {
    brasAv.add(barre([-2.3, -2.95, s * 5.3], [X_AV, -2.7, s * (Z_AV - 1.1)], 0.18, 'acier'));
    brasAv.add(barre([-0.6, -2.95, s * 4.6], [X_AV + 0.1, -2.75, s * (Z_AV - 1.15)], 0.15, 'acier'));
    [[-2.3, -2.95, s * 5.3], [-0.6, -2.95, s * 4.6]].forEach((pt) => brasAv.add(place(maillage(axeX(cylindre(0.2, 0.35, 16)), 'caoutchouc'), pt[0], pt[1], pt[2])));
    // Jambe de force : pivot porte-moyeu, amortisseur, tige, ressort et coupelle supérieure
    const bas = [X_AV + 0.15, -1.2, s * (Z_AV - 1.25)], haut = [X_AV + 0.55, 3.45, s * (Z_AV - 2.2)];
    jambesAv.add(place(maillage(boite(0.6, 1.8, 0.4, 0.06), 'acier'), X_AV, Y_ROUE + 0.2, s * (Z_AV - 0.95)));
    jambesAv.add(barre(bas, [X_AV + 0.45, 2.0, s * (Z_AV - 1.95)], 0.3, 'acier'));
    jambesAv.add(barre([X_AV + 0.45, 2.0, s * (Z_AV - 1.95)], haut, 0.1, 'acier'));
    const ress = ressort(0.62, 2.2, 6, 0.08, 'noir');
    const axe = v3(haut).sub(v3(bas)).normalize();
    ress.position.copy(v3(bas)).addScaledVector(axe, 2.1);
    ress.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axe);
    jambesAv.add(ress);
    jambesAv.add(place(maillage(cylindre(0.7, 0.12, 32), 'acier'), haut[0], haut[1], haut[2]));
  });

  // --- Direction : boîtier et biellettes (crémaillère), colonne jusqu'au volant (conduite à gauche) ---
  const boitierDirection = ajouter(piece('boitierDirection', 'Boîtier de direction et biellettes', 'direction', [0, -1.4, 0]));
  boitierDirection.add(place(maillage(boite(0.7, 0.8, 0.7, 0.1), 'noir'), -3.3, -1.9, 2.6));
  boitierDirection.add(barre([-3.6, -2.4, -5.0], [-3.6, -2.4, 5.0], 0.12, 'acier'));
  [-1, 1].forEach((s) => boitierDirection.add(barre([-3.6, -2.4, s * 5.0], [X_AV - 0.9, -2.3, s * (Z_AV - 1.3)], 0.09, 'acier')));
  [-1, 1].forEach((s) => boitierDirection.add(place(maillage(axeZ(cone(0.1, 0.22, 0.7, 16)), 'caoutchouc'), -3.6, -2.4, s * 4.4)));
  const colonne = ajouter(piece('colonneDirection', 'Colonne de direction', 'direction', [0, 2.5, 4.5]));
  const [xv, yv, zv] = P_VOLANT;
  colonne.add(tuyau([[-3.3, -1.5, 2.6], [-1.5, -0.9, 2.75], [3.0, 1.0, 3.4], [X_TABLIER + 1.0, 2.6, zv - 0.2], [xv - 0.9, yv - 0.45, zv]], 0.14, 'acier'));
  [[-1.5, -0.9, 2.75], [X_TABLIER + 1.0, 2.6, zv - 0.2]].forEach(([x, y, z]) => colonne.add(place(maillage(new THREE.SphereGeometry(0.2, 14, 10), 'acier'), x, y, z)));   // cardans
  // Volant de secours : il s'efface quand la carrosserie détaillée (avec son propre volant) est chargée
  const volantDirection = anime(new THREE.Group());
  volantDirection.name = 'volantSecours';
  volantDirection.position.set(xv, yv, zv);
  volantDirection.rotation.z = 1.15;                                              // incliné vers le conducteur
  volantDirection.add(maillage(toreY(1.6, 0.15), 'garniture'));
  [0, 2.1, 4.2].forEach((a) => {
    const bras = new THREE.Group();
    bras.rotation.y = a;
    bras.add(place(maillage(boite(1.35, 0.08, 0.3, 0.03), 'garniture'), 0.78, 0, 0));
    volantDirection.add(bras);
  });
  volantDirection.add(maillage(cylindre(0.5, 0.3, 24), 'garniture'));
  colonne.add(volantDirection);

  // --- Train arrière : berceau, bras (et porte-moyeux), ressorts et amortisseurs ---
  const berceauAr = ajouter(piece('berceauAr', 'Berceau arrière', 'suspension', [7.5, 2.2, 0]));
  [X_AR - 2.2, X_AR + 2.0].forEach((x) => berceauAr.add(barre([x, -0.6, -5.2], [x, -0.6, 5.2], 0.3, 'acier')));
  [-1, 1].forEach((s) => berceauAr.add(barre([X_AR - 2.2, -0.6, s * 4.6], [X_AR + 2.0, -0.6, s * 4.6], 0.26, 'acier')));
  const brasAr = ajouter(piece('brasAr', 'Bras de suspension arrière', 'suspension', [7.5, -1.4, 0]));
  const ressortsAr = ajouter(piece('ressortsAr', 'Ressorts arrière', 'suspension', [7.5, 3.6, 0]));
  const amortisseursAr = ajouter(piece('amortisseursAr', 'Amortisseurs arrière', 'suspension', [7.5, 5.0, 0]));
  [-1, 1].forEach((s) => {
    brasAr.add(barre([X_AR - 1.6, -0.9, s * 4.6], [X_AR - 0.2, -2.2, s * (Z_AR - 1.2)], 0.16, 'acier'));
    brasAr.add(barre([X_AR + 1.6, -0.9, s * 4.6], [X_AR + 0.3, -2.3, s * (Z_AR - 1.2)], 0.16, 'acier'));
    brasAr.add(barre([X_AR + 0.2, -0.4, s * 4.8], [X_AR + 0.2, -0.5, s * (Z_AR - 1.2)], 0.14, 'acier'));
    brasAr.add(place(maillage(boite(0.6, 1.8, 0.4, 0.06), 'acier'), X_AR, Y_ROUE + 0.2, s * (Z_AR - 0.95)));
    ressortsAr.add(place(ressort(0.55, 3.0, 6, 0.08, 'noir'), X_AR + 0.9, -1.5, s * 6.3));
    amortisseursAr.add(barre([X_AR - 1.0, -1.8, s * 6.7], [X_AR - 1.0, 1.0, s * 6.6], 0.22, 'acier'));
    amortisseursAr.add(barre([X_AR - 1.0, 1.0, s * 6.6], [X_AR - 1.0, 2.6, s * 6.55], 0.08, 'acier'));
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
  // Goulotte de remplissage : elle s'arrête derrière la trappe, à l'intérieur de l'aile (invisible de dehors)
  reservoir.add(tuyau([[27.5, 0.3, -5.5], [30.5, 1.4, -7.0], [33.5, 2.8, -7.9], [35.0, 3.6, -8.2]], 0.3, 'plastique'));
  reservoir.add(place(maillage(axeZ(cylindre(0.42, 0.2, 24)), 'noir'), 35.1, 3.65, -8.3));

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
  [LIGNE_POMPE_FILTRE, LIGNE_FILTRE_RAMPE].forEach((l) => duriteEssence.add(tuyau(l, 0.055, 'acier')));
  // Retour du régulateur vers le réservoir : conduite distincte (plus épaisse) qui replonge dans la cuve
  duriteEssence.add(tuyau(LIGNE_RETOUR, 0.075, 'cuivre'));
  duriteEssence.add(place(maillage(cylindre(0.075, 1.6, 12), 'cuivre'), X_POMPE + 0.4, -0.3, Z_POMPE + 0.35));


  /* ---------------- Baie moteur (d'après les photos du compartiment) ---------------- */

  // --- Cache moteur BMW (amovible) : capot plastique des bobines avec ses inserts argent nervurés
  //     et le lettrage, prolongé côté admission par le cache du collecteur à alvéoles ---
  const cacheMoteur = ajouter(piece('cacheMoteur', 'Cache moteur BMW', 'allumage', [0, 9.5, 0]));
  cacheMoteur.userData.amovible = true;
  cacheMoteur.add(place(maillage(boite(6.6, 0.42, 2.15, 0.2), 'plastique'), -0.05, 3.78, -0.08));        // coque principale
  cacheMoteur.add(place(maillage(boite(6.4, 1.1, 0.12, 0.05), 'plastique'), -0.05, 3.18, 1.0));         // jupe côté admission
  cacheMoteur.add(place(maillage(boite(6.1, 0.42, 2.25, 0.18), 'plastique'), 0.15, 2.76, 2.1));          // cache du collecteur
  [-2.15, -0.75, 0.65, 2.05].forEach((x) => cacheMoteur.add(place(maillage(boite(1.0, 0.1, 0.95, 0.04), 'noir'), x, 2.94, 2.2)));   // alvéoles
  // Insert nervuré du lettrage (côté échappement, à l'avant) et bande nervurée centrale
  for (let k = 0; k < 6; k++) {
    const z = -1.0 + k * 0.105;
    cacheMoteur.add(place(maillage(boite(0.8, 0.05, 0.05, 0.02), 'argent'), -2.75, 4.02, z));
    cacheMoteur.add(place(maillage(boite(1.15, 0.05, 0.05, 0.02), 'argent'), -0.85, 4.02, z));
  }
  for (let k = 0; k < 5; k++) cacheMoteur.add(place(maillage(boite(5.7, 0.05, 0.05, 0.02), 'argent'), 0.25, 4.02, 0.0 + k * 0.1));
  // Lettrage « BMW » dans l'insert, lisible le long du moteur
  {
    const toile = document.createElement('canvas');
    toile.width = 256; toile.height = 96;
    const ctx = toile.getContext('2d');
    ctx.fillStyle = '#1b1c20';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#d4d8de';
    ctx.font = 'bold 76px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BMW', 128, 52);
    const texture = new THREE.CanvasTexture(toile);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Le texte se lit le long du moteur, le haut des lettres tourné vers la droite de la voiture
    const lettrage = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: texture, metalness: 0.4, roughness: 0.45 }));
    lettrage.position.set(-1.8, 4.005, -0.74);
    lettrage.userData.mat = 'lettrage';
    cacheMoteur.add(lettrage);
  }
  cacheMoteur.add(place(maillage(toreY(0.25, 0.04), 'noir'), -1.2, 4.0, -0.72));                       // passage du bouchon d'huile
  [-3.0, 2.95].forEach((x) => [-0.95, 0.75].forEach((z) => cacheMoteur.add(place(maillage(cylindre(0.08, 0.04, 6), 'acier'), x, 4.0, z))));

  // --- Jauge à huile : tube le long du bloc côté admission, poignée annulaire rouge ---
  const jauge = ajouter(piece('jauge', 'Jauge à huile', 'lubrification', [-1.0, 2.2, 3.0]));
  jauge.add(tuyau([[-2.4, -1.6, 1.4], [-2.5, -1.2, 2.6], [-2.9, 0.0, 3.4], [-2.9, 2.25, 3.5]], 0.06, 'acier'));
  jauge.add(place(maillage(cylindre(0.09, 0.12, 12), 'noir'), -2.9, 2.3, 3.5));
  const anneau = place(maillage(toreX(0.17, 0.045), 'rouge'), -2.9, 2.55, 3.5);
  jauge.add(anneau);

  // --- Caisse côté moteur : tablier, tourelles de suspension, longerons, traverse avant ---
  const baie = ajouter(piece('baieMoteur', 'Baie moteur (tablier, tourelles)', 'carrosserie', [0, -2.2, 0], true));
  {
    // Tablier : pleine hauteur sur les côtés, échancré au centre pour la cloche de boîte
    const forme = new THREE.Shape();
    [[-7.4, -1.6], [-2.4, -1.6], [-2.4, 1.3], [2.4, 1.3], [2.4, -1.6], [7.4, -1.6], [7.4, 5.0], [-7.4, 5.0]]
      .forEach(([z, y], i) => (i ? forme.lineTo(z, y) : forme.moveTo(z, y)));
    forme.closePath();
    baie.add(place(maillage(new THREE.ShapeGeometry(forme).rotateY(-Math.PI / 2), 'peintureBaie'), X_TABLIER, 0, 0));
    baie.add(place(maillage(boite(0.5, 0.4, 14.8, 0.1), 'peintureBaie'), X_TABLIER - 0.2, 5.0, 0));      // auvent
    baie.add(place(maillage(boite(1.4, 0.1, 14.4, 0.04), 'plastique'), X_TABLIER + 0.15, 5.22, 0));        // grille d'auvent
  }
  [-1, 1].forEach((s) => {
    const zt = s * (Z_AV - 2.2), xt = X_AV + 0.55;
    baie.add(place(maillage(tubeOuvert(1.05, 3.1, 40), 'peintureBaie'), xt, 2.05, zt));                // tourelle
    baie.add(place(maillage(cylindre(1.05, 0.08, 40), 'peintureBaie'), xt, 3.62, zt));
    autour(3, (a) => baie.add(place(maillage(cylindre(0.09, 0.14, 6), 'acier'), xt + Math.sin(a) * 0.62, 3.7, zt + Math.cos(a) * 0.62)));
  });
  // Habillage noir au-dessus du radiateur (la grande pièce plastique au premier plan de la photo)
  baie.add(place(maillage(boite(1.0, 0.12, 12.2, 0.05), 'plastique'), -7.3, 2.9, 0));

  // --- Boîtiers de filtre d'habitacle : les deux grands boîtiers noirs devant le pare-brise ---
  const filtresHab = ajouter(piece('filtresHabitacle', "Boîtiers de filtre d'habitacle", 'carrosserie', [2.5, 5.0, 0], true));
  [-1, 1].forEach((s) => {
    filtresHab.add(place(maillage(boite(1.8, 1.0, 3.4, 0.15), 'plastique'), 3.15, 4.0, s * 5.5));
    for (let k = 0; k < 6; k++) filtresHab.add(place(maillage(boite(1.5, 0.04, 0.06, 0.02), 'noir'), 3.15, 4.52, s * (4.2 + k * 0.5)));
    filtresHab.add(place(maillage(boite(0.6, 0.6, 0.6, 0.1), 'plastique'), 2.75, 4.1, s * 3.6));          // conduit d'arrivée d'air
  });

  // --- Réservoir de lave-glace : bidon blanc translucide à l'avant droit, bouchon à pictogramme ---
  const laveGlace = ajouter(piece('laveGlace', 'Réservoir de lave-glace', 'carrosserie', [-3.0, 1.0, -4.0]));
  laveGlace.add(place(maillage(boite(2.8, 3.0, 1.4, 0.35), 'bidon'), -4.8, 0.9, -6.5));
  laveGlace.add(place(maillage(cylindre(0.16, 0.5, 16), 'bidon'), -3.8, 2.6, -6.35));
  laveGlace.add(place(maillage(cylindre(0.3, 0.16, 24), 'noir'), -3.8, 2.9, -6.35));
  laveGlace.add(place(maillage(axeZ(cylindre(0.12, 0.4, 12)), 'noir'), -5.6, -0.4, -5.7));             // pompe

  /* ---------------- Freinage hydraulique et pédalier (conduite à gauche) ---------------- */

  // --- Servofrein à dépression, sur le tablier côté conducteur ---
  const servoFrein = ajouter(piece('servoFrein', 'Servofrein', 'freinage', [-0.6, 2.4, 3.6]));
  servoFrein.add(place(maillage(axeX(cylindre(1.25, 1.2, 48)), 'noir'), 3.45, 2.0, 4.9));
  [2.82, 4.08].forEach((x) => servoFrein.add(place(maillage(axeX(cone(1.0, 1.25, 0.1, 48)), 'noir'), x + (x < 3.4 ? -0.05 : 0.05), 2.0, 4.9)));
  servoFrein.add(place(maillage(toreX(1.25, 0.05), 'acier'), 3.45, 2.0, 4.9));
  servoFrein.add(tuyau([[3.3, 3.2, 4.4], [3.3, 3.35, 3.6], [3.5, 3.0, 2.2]], 0.1, 'caoutchouc'));      // dépression vers l'admission
  servoFrein.add(place(maillage(axeX(cylindre(0.14, 0.3, 12)), 'plastique'), 3.15, 3.1, 4.4));

  // --- Maître-cylindre et son bocal de liquide de frein ---
  const maitreCyl = ajouter(piece('maitreCylindre', 'Maître-cylindre et bocal de liquide de frein', 'freinage', [-2.4, 3.4, 3.6]));
  maitreCyl.add(place(maillage(axeX(cylindre(0.3, 1.4, 24)), 'alu'), 1.85, 2.0, 4.9));
  maitreCyl.add(place(maillage(axeX(cylindre(0.45, 0.12, 24)), 'alu'), 2.58, 2.0, 4.9));                 // bride
  maitreCyl.add(place(maillage(boite(1.0, 0.55, 0.65, 0.12), 'bidon'), 1.8, 2.62, 4.9));               // bocal
  maitreCyl.add(place(maillage(cylindre(0.18, 0.18, 20), 'noir'), 1.65, 3.0, 4.9));
  [1.45, 2.1].forEach((x) => maitreCyl.add(place(maillage(cylindre(0.09, 0.14, 6), 'acier'), x, 2.32, 4.62)));   // sorties

  // --- Bloc ABS : bloc hydraulique en aluminium, moteur de pompe et calculateur ;
  //     à l'avant droit, à côté de la tourelle, comme sur la photo ---
  const blocAbs = ajouter(piece('blocAbs', 'Bloc ABS (hydraulique et calculateur)', 'freinage', [-1.5, 3.6, -3.2]));
  blocAbs.add(place(maillage(boite(1.0, 0.9, 1.1, 0.05), 'alu'), -2.4, 1.8, -4.6));
  blocAbs.add(place(maillage(axeX(cylindre(0.4, 0.65, 28)), 'noir'), -1.6, 1.75, -4.6));                 // moteur de pompe
  blocAbs.add(place(maillage(boite(0.5, 1.1, 1.2, 0.08), 'plastique'), -3.15, 1.8, -4.6));               // calculateur
  blocAbs.add(place(maillage(boite(0.3, 0.45, 0.6, 0.04), 'noir'), -3.55, 1.7, -4.6));                    // connecteur
  [-2.7, -2.4, -2.1].forEach((x) => [-4.85, -4.35].forEach((z) => blocAbs.add(place(maillage(cylindre(0.08, 0.16, 6), 'acier'), x, 2.32, z))));
  blocAbs.add(place(maillage(boite(1.2, 0.12, 1.3, 0.03), 'acier'), -2.4, 1.28, -4.6));                   // support

  // --- Conduites de frein : maître-cylindre → ABS, puis ABS → chaque étrier (rigides,
  //     puis flexibles près des roues) ---
  const conduites = ajouter(piece('conduitesFrein', 'Conduites de frein', 'freinage', [0, 1.4, 0]));
  [0, 0.14].forEach((d) => conduites.add(tuyau([[1.45 + d * 4.6, 2.36, 4.62], [2.3, 2.65, 3.5 - d], [3.7, 2.85 + d, 2.4], [3.75, 2.85 + d, -3.4],
    [2.6, 2.6, -4.3 + d], [-2.1 - d * 2, 2.38, -4.35 - d * 3.5]], 0.028, 'conduite')));
  // Avant gauche : le long du tablier, puis vers le passage de roue
  const P_AVG = [X_AV + 1.6, Y_ROUE + 0.62, Z_AV - 0.82];
  conduites.add(tuyau([[-2.7, 2.38, -4.85], [-1.2, 2.7, -3.9], [3.75, 2.6, -2.4], [3.85, 0.4, 2.6], [3.7, 0.4, 3.4], [2.6, 0.0, 6.5], [1.1, -0.4, 6.9]], 0.028, 'conduite'));
  conduites.add(tuyau([[1.1, -0.4, 6.9], [0.0, -0.9, 7.3], P_AVG], 0.06, 'caoutchouc'));
  // Avant droit : derrière la tourelle
  const P_AVD = [X_AV + 1.6, Y_ROUE + 0.62, -(Z_AV - 0.82)];
  conduites.add(tuyau([[-2.4, 2.38, -4.85], [-0.2, 1.6, -5.2], [1.3, 0.6, -5.6], [1.6, -0.2, -6.6]], 0.028, 'conduite'));
  conduites.add(tuyau([[1.6, -0.2, -6.6], [0.0, -0.9, -7.3], P_AVD], 0.06, 'caoutchouc'));
  // Arrière : le long du tunnel, puis vers chaque roue arrière
  conduites.add(tuyau([[-2.1, 2.38, -4.35], [3.0, 2.2, -3.8], [3.85, 0.4, -3.4], [3.9, -1.8, -3.3], [6.0, -2.75, -3.2], [X_AR - 4.2, -2.8, -3.2], [X_AR - 3.4, -2.7, 0]], 0.028, 'conduite'));
  [-1, 1].forEach((s) => {
    const cible = [X_AR - 1.62, Y_ROUE + 0.62, s * (Z_AR - 0.82)];
    conduites.add(tuyau([[X_AR - 3.4, -2.7, 0], [X_AR - 3.0, -2.5, s * 3.5], [X_AR - 2.6, -1.6, s * 6.4]], 0.028, 'conduite'));
    conduites.add(tuyau([[X_AR - 2.6, -1.6, s * 6.4], [X_AR - 2.1, -1.3, s * 7.1], cible], 0.06, 'caoutchouc'));
  });

  // --- Pédalier : trois pédales suspendues devant le siège conducteur (à gauche) ---
  const pedale = (id, nom, z, largeur, hauteur) => {
    const p = ajouter(piece(id, nom, 'pedales', [7.0, -2.5, z * 0.4]));
    const pivot = [5.85, 2.4], patin = [7.15, -1.0];
    p.add(barre([pivot[0], pivot[1], z], [patin[0] - 0.08, patin[1] + hauteur / 2, z], 0.07, 'acier'));
    p.add(place(maillage(axeZ(cylindre(0.13, 0.36, 12)), 'acier'), pivot[0], pivot[1], z));
    const plaque = place(maillage(boite(0.12, hauteur, largeur, 0.05), 'gomme'), patin[0], patin[1], z);
    plaque.rotation.z = -0.35;
    p.add(plaque);
    for (let k = 0; k < 4; k++) {
      const strie = place(maillage(boite(0.03, 0.05, largeur * 0.85, 0.01), 'caoutchouc'), patin[0] + 0.06, patin[1] - hauteur * 0.32 + k * hauteur * 0.21, z);
      strie.rotation.z = -0.35;
      p.add(strie);
    }
    return p;
  };
  const embrayagePedale = pedale('pedaleEmbrayage', "Pédale d'embrayage", 6.05, 0.62, 0.55);
  const freinPedale = pedale('pedaleFrein', 'Pédale de frein', 4.5, 0.75, 0.6);
  pedale('pedaleAccelerateur', "Pédale d'accélérateur", 2.8, 0.42, 1.0);
  freinPedale.add(barre([5.95, 1.7, 4.5], [4.1, 2.0, 4.9], 0.05, 'acier'));                              // tige de poussée → servofrein
  freinPedale.add(place(maillage(boite(0.8, 0.6, 3.9, 0.08), 'acier'), 5.85, 2.75, 4.4));                 // support du pédalier
  embrayagePedale.add(barre([5.95, 1.8, 6.05], [4.3, 2.1, 6.05], 0.05, 'acier'));
  embrayagePedale.add(place(maillage(axeX(cylindre(0.17, 0.75, 16)), 'alu'), 3.75, 2.1, 6.05));           // émetteur d'embrayage

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
  // Bossage central du capot (les « nervures » qui prolongent la calandre)
  const bossage = x > 230 && x < 1650 ? 14 * Math.sin(Math.PI * (x - 230) / 1420) : 0;
  const flanc = (f) => b + (hb - 20 - b) * f;
  const p6 = [wb - 70, hb + 10];
  const p7 = [Math.min(wt + 40, p6[0] - 20), Math.max(hb + 15, ht - 60)];
  const p8 = [Math.min(wt - 40, p7[0] - 20), Math.max(hb + 20, ht - 10)];
  return [[0, b], [wb - 140, b], [wb - 45, flanc(0.12)], [wb - 6, flanc(0.45)], [wb, flanc(0.8)], [wb - 20, hb - 20],
    p6, p7, p8, [p8[0] * 0.5, ht + bossage * 0.6], [0, ht + 5 + bossage]];
}

// Courbe d'une section (mise en cache : chaque section sert à plusieurs panneaux)
const cacheSections = new Map();
function courbeSection(x) {
  const cle = Math.round(x * 2);
  if (!cacheSections.has(cle)) {
    cacheSections.set(cle, new THREE.CatmullRomCurve3(section(x).map(([z, y]) => new THREE.Vector3(z, y, 0)), false, 'centripetal'));
  }
  return cacheSections.get(cle);
}

// Point de la surface (unités de la maquette) à l'abscisse x (mm), à l'indice i de la section,
// décalé de "decalage" mm vers l'extérieur
function surface(x, i, cote, decalage) {
  const courbe = courbeSection(x);
  const t = Math.min(1, Math.max(0, i / 10));
  const p = courbe.getPoint(t), d = courbe.getTangent(t);
  const nz = d.y, ny = -d.x;                         // normale extérieure de la demi-section
  return new THREE.Vector3(caisseX(x), caisseY(p.y + ny * (decalage || 0)), cote * mm(p.x + nz * (decalage || 0)));
}

// Panneau de carrosserie entre les abscisses x0 et x1 (mm), sur la portion [i0, i1] de la section
// (i0 et i1 peuvent être des fonctions de x : vitres à contour courbe).
// cote : 1 = gauche, -1 = droite, 0 = panneau symétrique qui passe par le sommet (i1 = 10)
function panneau(x0, x1, i0, i1, cote, nomMateriau) {
  const borne = (v, x) => (typeof v === 'function' ? v(x) : v);
  const nx = Math.max(2, Math.ceil((x1 - x0) / 50) + 1);
  const ecart = Math.abs(borne(i1, x0) - borne(i0, x0)) + Math.abs(borne(i1, x1) - borne(i0, x1));
  const nt = Math.max(3, Math.ceil(ecart * 1.6) + 1);
  const pos = [], idx = [];
  let nc = 0;
  for (let i = 0; i < nx; i++) {
    const x = x0 + (x1 - x0) * i / (nx - 1);
    const a = borne(i0, x), b = borne(i1, x);
    const ts = [];
    for (let k = 0; k < nt; k++) ts.push((a + (b - a) * k / (nt - 1)) / 10);
    const colonnes = cote === 0
      ? ts.map((t) => [t, -1]).concat(ts.slice(0, -1).reverse().map((t) => [t, 1]))
      : ts.map((t) => [t, cote]);
    nc = colonnes.length;
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

// Jonc qui suit la carrosserie le long de l'indice i (fonction de x possible), de x0 à x1 (mm)
function jonc(x0, x1, i, cote, r, nomMateriau, decalage) {
  const points = [];
  const n = Math.max(3, Math.ceil((x1 - x0) / 80));
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n;
    points.push(surface(x, typeof i === 'function' ? i(x) : i, cote, decalage === undefined ? 6 : decalage).toArray());
  }
  return tuyau(points, r, nomMateriau, { cotes: 8 });
}

// Face pleine (avant ou arrière) à l'abscisse x
function face(x, nomMateriau) {
  const demi = section(x).slice(1);
  const contour = demi.concat(demi.slice(0, -1).reverse().map(([z, y]) => [-z, y]));
  const forme = new THREE.Shape(contour.map(([z, y]) => new THREE.Vector2(mm(z), caisseY(y))));
  const g = new THREE.ShapeGeometry(forme, 12).rotateY(-Math.PI / 2);
  return place(maillage(g, nomMateriau), caisseX(x), 0, 0);
}

// Bas de la vitre arrière : il remonte vers l'arrière en formant le « coude Hofmeister » des BMW
const COUDE_DEBUT = 3330, COUDE_FIN = 3520;
const basVitreArriere = (x) => (x <= COUDE_DEBUT ? 5 : 5 + 2.7 * Math.pow((x - COUDE_DEBUT) / (COUDE_FIN - COUDE_DEBUT), 1.7));

function construireCarrosserie(ajouter) {
  const panneauDe = (id, nom, eclate) => ajouter(piece(id, nom, 'carrosserie', eclate, true));
  const posCaisse = (x, y, z) => [caisseX(x), caisseY(y), mm(z)];

  // Face avant : bouclier, calandre à double haricot chromé, projecteurs à anneaux (angel eyes),
  // clignotants blancs (phase 2), antibrouillards, prise d'air et plaque
  const faceAv = panneauDe('faceAvant', 'Face avant (pare-chocs, calandre, phares)', [-12, 0, 0]);
  faceAv.add(panneau(0, 230, 1, 10, 0, 'peinture'));
  faceAv.add(face(0, 'peinture'));
  [-1, 1].forEach((s) => {
    const [x, y, z] = posCaisse(-4, 650, s * 105);
    faceAv.add(place(maillage(boite(0.2, 1.3, 1.55, 0.3), 'chrome'), x, y, z));
    faceAv.add(place(maillage(boite(0.22, 1.1, 1.35, 0.25), 'garniture'), x + 0.03, y, z));
    for (let k = -3; k <= 3; k++) faceAv.add(place(maillage(boite(0.06, 1.0, 0.05, 0.02), 'acier'), x - 0.09, y, z + k * 0.17));
    // Bloc optique : glace claire, deux anneaux lumineux et leurs projecteurs, clignotant blanc à l'extérieur
    const [xo, yo, zo] = posCaisse(-2, 640, s * 455);
    faceAv.add(place(maillage(boite(0.3, 1.25, 4.5, 0.25), 'garniture'), xo + 0.1, yo, zo));
    faceAv.add(place(maillage(boite(0.12, 1.35, 4.6, 0.25), 'optique'), xo - 0.18, yo, zo));
    [s * 350, s * 545].forEach((zp) => {
      const [, , zz] = posCaisse(0, 0, zp);
      faceAv.add(place(maillage(toreX(0.6, 0.06), 'angelEyes'), xo - 0.1, yo, zz));
      faceAv.add(place(maillage(axeX(cylindre(0.36, 0.2, 24)), 'chrome'), xo - 0.02, yo, zz));
    });
    const [, , zc] = posCaisse(0, 0, s * 655);
    faceAv.add(place(maillage(boite(0.2, 0.9, 0.75, 0.15), 'feuBlanc'), xo - 0.05, yo, zc));
    const [xf, yf, zf] = posCaisse(-2, 330, s * 640);
    faceAv.add(place(maillage(axeX(cylindre(0.5, 0.2, 24)), 'optique'), xf, yf, zf));
    faceAv.add(place(maillage(axeX(tubeOuvert(0.56, 0.24, 24)), 'garniture'), xf + 0.02, yf, zf));
  });
  const [xg, yg] = posCaisse(-3, 300, 0);
  faceAv.add(place(maillage(boite(0.25, 1.4, 6.5, 0.2), 'garniture'), xg, yg, 0));
  faceAv.add(place(maillage(boite(0.1, 1.27, 6.0, 0.06), 'plaque'), xg - 0.12, yg + 0.75, 0));
  // Baguettes de pare-chocs (couleur carrosserie, filet chromé)
  [1, -1].forEach((s) => faceAv.add(jonc(20, 230, 3.1, s, 0.07, 'peinture', 10)));

  const capot = panneauDe('capot', 'Capot', [-3, 12, 0]);
  capot.add(panneau(230, 1650, 5, 10, 0, 'peinture'));
  // Essuie-glaces au pied du pare-brise
  [-1, 1].forEach((s) => {
    capot.add(barre(surface(1672, s > 0 ? 9.9 : 9.0, s, 14).toArray(), surface(1672, s > 0 ? 7.3 : 6.6, s, 14).toArray(), 0.05, 'garniture'));
  });

  [[1, 'G', 'gauche'], [-1, 'D', 'droite']].forEach(([s, l, nom]) => {
    const aile = panneauDe('aileAv' + l, 'Aile avant ' + nom, [-2, 1, s * 11]);
    aile.add(panneau(230, 1720, 1, 5, s, 'peinture'));
    aile.add(jonc(300, 1720, 4.72, s, 0.035, 'peinture', 4));                      // nervure d'épaule
    aile.add(jonc(1270, 1720, 3.1, s, 0.07, 'peinture', 10));                      // baguette
    const rep = surface(1380, 3.9, s, 8);
    aile.add(place(maillage(boite(0.5, 0.18, 0.08, 0.04), 'feuBlanc'), rep.x, rep.y, rep.z));

    const porteAv = panneauDe('porteAv' + l, 'Porte avant ' + nom, [0, 0.5, s * 14]);
    porteAv.add(panneau(1720, 2780, 1, 5, s, 'peinture'));
    porteAv.add(panneau(1720, 2250, 5, 7.25, s, 'vitre'));
    porteAv.add(panneau(2250, 2780, 5, 8, s, 'vitre'));
    porteAv.add(jonc(1720, 2780, 4.72, s, 0.035, 'peinture', 4));
    porteAv.add(jonc(1720, 2780, 3.1, s, 0.07, 'peinture', 10));
    porteAv.add(jonc(1720, 2780, 3.1, s, 0.018, 'chrome', 16));
    porteAv.add(jonc(1720, 2780, 5, s, 0.05, 'garniture', 3));                       // joint de vitre
    porteAv.add(jonc(2250, 2780, 8, s, 0.05, 'garniture', 3));
    // Rétroviseur (coque couleur carrosserie) et poignée couleur carrosserie (phase 2)
    const [xr, yr, zr] = posCaisse(1800, 975, s * 960);
    porteAv.add(place(maillage(boite(0.9, 1.0, 1.5, 0.3), 'peinture'), xr, yr, zr));
    porteAv.add(place(maillage(boite(0.1, 0.8, 1.2, 0.2), 'vitre'), xr + 0.45, yr, zr));
    const poignee = surface(2420, 4.35, s, 10);
    porteAv.add(place(maillage(boite(1.2, 0.2, 0.14, 0.06), 'peinture'), poignee.x, poignee.y, poignee.z));

    const porteAr = panneauDe('porteAr' + l, 'Porte arrière ' + nom, [2, 0.5, s * 14]);
    porteAr.add(panneau(2780, 3600, 1, 5, s, 'peinture'));
    porteAr.add(panneau(2780, COUDE_FIN, basVitreArriere, 8, s, 'vitre'));
    porteAr.add(jonc(2780, 3600, 4.72, s, 0.035, 'peinture', 4));
    porteAr.add(jonc(2780, 3290, 3.1, s, 0.07, 'peinture', 10));
    porteAr.add(jonc(2780, 3290, 3.1, s, 0.018, 'chrome', 16));
    porteAr.add(jonc(2780, COUDE_FIN, basVitreArriere, s, 0.05, 'garniture', 3));
    porteAr.add(jonc(2780, COUDE_FIN - 30, 8, s, 0.05, 'garniture', 3));
    const poigneeAr = surface(3330, 4.35, s, 10);
    porteAr.add(place(maillage(boite(1.2, 0.2, 0.14, 0.06), 'peinture'), poigneeAr.x, poigneeAr.y, poigneeAr.z));

    const custode = panneauDe('custode' + l, 'Aile arrière ' + nom, [3, 1, s * 11]);
    custode.add(panneau(3600, 4540, 1, 5, s, 'peinture'));
    custode.add(panneau(COUDE_DEBUT, COUDE_FIN, 5, basVitreArriere, s, 'peinture'));    // montant sous le coude
    custode.add(panneau(COUDE_FIN, 3900, 5, 8, s, 'peinture'));
    custode.add(jonc(3600, 4540, 4.72, s, 0.035, 'peinture', 4));
    custode.add(jonc(4090, 4540, 3.1, s, 0.07, 'peinture', 10));
  });

  const pareBrise = panneauDe('pareBrise', 'Pare-brise', [-2, 9, 0]);
  pareBrise.add(panneau(1650, 2250, 7.65, 10, 0, 'vitre'));

  const toit = panneauDe('toit', 'Pavillon et montants', [0, 15, 0]);
  toit.add(panneau(2250, 3300, 8, 10, 0, 'peinture'));
  [1, -1].forEach((s) => {
    toit.add(panneau(1650, 2250, 7.25, 7.65, s, 'peinture'));
    toit.add(panneau(2760, 2800, 5, 8, s, 'garniture'));                          // montant central noir
  });

  const lunette = panneauDe('lunette', 'Lunette arrière', [3, 10, 0]);
  lunette.add(panneau(3300, 3900, 7.8, 10, 0, 'vitre'));
  const [x3, y3] = posCaisse(3860, 1050, 0);
  lunette.add(place(maillage(boite(0.25, 0.14, 2.6, 0.05), 'feuRouge'), x3, y3, 0));   // troisième feu stop

  // Coffre : capot de malle, jonc chromé et plaque entre les feux
  const coffre = panneauDe('coffre', 'Coffre', [6, 12, 0]);
  coffre.add(panneau(3900, 4540, 5, 10, 0, 'peinture'));

  // Feux arrière (phase 2) : partie rouge et partie blanche, sur l'aile et sur le coffre
  const feux = panneauDe('feuxAr', 'Feux arrière', [11, 3, 0]);
  [-1, 1].forEach((s) => {
    const [x, y, z] = posCaisse(4712, 905, s * 705);
    feux.add(place(maillage(boite(0.5, 1.3, 2.6, 0.2), 'feuRouge'), x, y, z));
    feux.add(place(maillage(boite(0.52, 0.5, 1.15, 0.12), 'feuBlanc'), x, y - 0.18, z - s * 0.45));
    const [x2, y2, z2] = posCaisse(4672, 940, s * 515);
    feux.add(place(maillage(boite(0.5, 0.95, 1.7, 0.18), 'feuRouge'), x2, y2, z2));
    feux.add(place(maillage(boite(0.52, 0.32, 1.0, 0.1), 'feuBlanc'), x2, y2 - 0.22, z2 + s * 0.25));
  });

  // Face arrière : bouclier, baguette, plaque, jonc chromé
  const faceAr = panneauDe('faceArriere', 'Face arrière (pare-chocs, plaque)', [13, 0, 0]);
  faceAr.add(panneau(4540, 4775, 1, 10, 0, 'peinture'));
  faceAr.add(face(4775, 'peinture'));
  const [xp, yp] = posCaisse(4782, 845, 0);
  faceAr.add(place(maillage(boite(0.1, 1.27, 6.0, 0.06), 'plaque'), xp, yp, 0));
  faceAr.add(place(maillage(boite(0.08, 0.1, 9.5, 0.04), 'chrome'), xp, yp + 0.9, 0));
  [1, -1].forEach((s) => faceAr.add(jonc(4545, 4770, 3.1, s, 0.07, 'peinture', 10)));

  // Caisse (bas de caisse, montants, plancher) : remplie par la carrosserie détaillée
  panneauDe('caisse', 'Caisse (bas de caisse, montants, plancher)', [0, -2.5, 0]);

  // Habitacle (visible à travers les vitres) : plancher et tunnel, tablier, planche de bord,
  // console, sièges avant et banquette
  const habitacle = panneauDe('habitacle', 'Habitacle', [0, 4, 0]);
  const pc = (x0, x1, y0, y1, z0, z1, mat, r) => {
    const [ax, ay, az] = posCaisse(x0, y0, z0), [bx, by, bz] = posCaisse(x1, y1, z1);
    return place(maillage(boite(bx - ax, by - ay, bz - az, r || 0.05), mat), (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  };
  [1, -1].forEach((s) => habitacle.add(pc(1650, 2900, 245, 275, s * 260, s * 800, 'cuir')));
  habitacle.add(pc(1650, 2900, 540, 570, -260, 260, 'cuir'));                       // dessus du tunnel
  habitacle.add(pc(2900, 3700, 540, 570, -800, 800, 'cuir'));                       // plancher arrière, au-dessus du réservoir
  habitacle.add(pc(1600, 1640, 560, 900, -760, 760, 'cuir'));                       // tablier
  [1, -1].forEach((s) => habitacle.add(pc(1600, 1640, 275, 560, s * 260, s * 760, 'cuir')));
  habitacle.add(pc(1700, 2080, 690, 860, -780, 780, 'cuir', 0.3));                   // planche de bord
  habitacle.add(pc(1950, 2650, 570, 640, -170, 170, 'cuir', 0.15));                  // console
  [1, -1].forEach((s) => {
    habitacle.add(pc(2500, 3000, 300, 470, s * 160, s * 640, 'cuir', 0.3));          // assise
    const dossier = pc(2930, 3030, 470, 1060, s * 170, s * 630, 'cuir', 0.3);
    dossier.rotation.z = -0.22;
    habitacle.add(dossier);
  });
  habitacle.add(pc(3350, 3800, 560, 700, -720, 720, 'cuir', 0.3));                   // banquette
  const dossierAr = pc(3740, 3850, 700, 1120, -720, 720, 'cuir', 0.3);
  dossierAr.rotation.z = -0.3;
  habitacle.add(dossierAr);
}


/* ==========================================================================
   5. Fluides : tubes colorés dont la texture défile dans le sens de circulation
   ========================================================================== */
const FLUIDES = {
  refroidissement: { couleur: 0x0891b2, vitesse: 'moteur' },
  carburant: { couleur: 0xea580c, vitesse: 'carburant' },
  retour: { couleur: 0xfdba74, vitesse: 'carburant' },
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
  const textures = { refroidissement: [], carburant: [], retour: [], huile: [] };
  const parType = {};

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
    textures[type].push({ tex: tex, facteur: o.lent ? 0.6 : 1 });
    if (!parType[type]) { parType[type] = new THREE.Group(); groupe.add(parType[type]); }
    parType[type].add(m);
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
  flux('retour', t.LIGNE_RETOUR, 0.12, { lent: true });
  flux('retour', [t.LIGNE_RETOUR[t.LIGNE_RETOUR.length - 1], [t.X_POMPE + 0.4, -1.1, t.Z_POMPE + 0.35], [t.X_POMPE + 0.4, -2.2, t.Z_POMPE + 0.35]], 0.1, { droit: true, lent: true });

  // Huile : puisard → crépine → pompe → filtre → galerie principale → paliers et gicleurs ;
  // montée vers la culasse (arbres à cames, VANOS) puis retour au carter
  flux('huile', [[1.6, -3.2, 0], [1.4, -3.15, 0], [0.4, -3.0, 0], [-2.2, -2.55, 0], [-2.9, -2.0, 0]], 0.08, { droit: true });
  flux('huile', [[-2.9, -2.0, 0], [-2.9, -1.3, 0.8], [-3.2, 0.95, 1.15], [-3.35, 1.1, 1.65], [-3.35, 2.3, 1.65], [-3.1, 0.95, 1.1], [-2.0, -0.45, 0.9]], 0.08, { droit: true });
  flux('huile', [[-3.2, -0.45, 0.9], [3.2, -0.45, 0.9]], 0.08, { droit: true });
  for (let k = 0; k < 7; k++) flux('huile', [[(k - 3) * ENTRAXE, -0.45, 0.9], [(k - 3) * ENTRAXE, -1.0, 0.18]], 0.04, { droit: true });
  X_CYL.forEach((x) => flux('huile', [[x + 0.2, -0.45, 0.9], [x + 0.1, -0.15, 0.3]], 0.03, { droit: true }));
  flux('huile', [[-3.2, -0.45, 0.9], [-3.25, 1.9, 0.75], [-3.2, 2.05, 0], [3.2, 2.05, 0]], 0.06, { droit: true });
  flux('huile', [[-3.2, 2.05, 0], [-3.75, 2.3, 0]], 0.05, { droit: true });
  flux('huile', [[3.25, 2.0, -0.8], [3.25, -1.0, -1.0], [3.0, -2.8, -0.6], [2.0, -3.15, -0.2]], 0.06, { droit: true });

  return { groupe: groupe, textures: textures, parType: parType };
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
const FREINS = ['disqueAvG', 'disqueAvD', 'disqueArG', 'disqueArD', 'etrierAvG', 'etrierAvD', 'etrierArG', 'etrierArD',
  'blocAbs', 'maitreCylindre', 'servoFrein', 'conduitesFrein'];
const PEDALES = ['pedaleEmbrayage', 'pedaleFrein', 'pedaleAccelerateur'];
const PIECES_PAR_FICHE = {
  cycle: ['bloc', 'pistons', 'vilebrequin'],
  admission: ['boiteAir', 'debitmetre', 'manchon', 'papillon', 'collecteurAdm', 'disa'],
  carburant: ['reservoir', 'pompeEssence', 'filtreEssence', 'duriteEssence', 'rampe', 'injecteurs'],
  allumage: ['bobines', 'bougies', 'cacheBobines'],
  distribution: ['aac', 'soupapes', 'vanos'],
  echappement: ['collecteurEch', 'ligneEch', 'sondes'],
  refroidissement: ['radiateur', 'vase', 'durites', 'ventilateur', 'pompeEau', 'thermostat'],
  lubrification: ['carter', 'pompeHuile', 'filtreHuile', 'jauge', 'vilebrequin'],
  ccv: ['ccv', 'cache'],
  gestion: ['dme', 'bobines', 'injecteurs'],
  transmission: ['volant', 'embrayage', 'boite', 'arbre', 'pont', 'demiArbres', 'roueArG', 'roueArD'],
  vanos: ['vanos', 'aac'],
  disa: ['disa', 'collecteurAdm'],
  thermostat: ['thermostat', 'pompeEau'],
  airsecondaire: ['pompeAir', 'collecteurEch'],
  lambda: ['sondes', 'collecteurEch'],
  mdk: ['papillon'],
  gicleurs: ['pistons', 'vilebrequin', 'pompeHuile'],
  demarreur: ['demarreur', 'volant'],
  alternateur: ['alternateur', 'poulies'],
  direction: ['pompeDA', 'bocalDA', 'boitierDirection', 'colonneDirection'],
  suspension: ['berceauAv', 'brasAv', 'jambesAv', 'berceauAr', 'brasAr', 'ressortsAr', 'amortisseursAr'],
  freinage: ['roueAvG', 'roueAvD', 'roueArG', 'roueArD'].concat(FREINS),
  carrosserie: ['faceAvant', 'capot', 'aileAvG', 'aileAvD', 'porteAvG', 'porteAvD', 'porteArG', 'porteArD',
    'custodeG', 'custodeD', 'pareBrise', 'toit', 'lunette', 'coffre', 'feuxAr', 'faceArriere']
};

// Groupes d'éléments du panneau « Affichage » de la maquette
const GROUPES = {
  carrosserie: PIECES_PAR_FICHE.carrosserie.concat(['habitacle', 'caisse', 'baieMoteur', 'filtresHabitacle']),
  moteur: ['bloc', 'pistons', 'vilebrequin', 'culasse', 'soupapes', 'aac', 'vanos', 'cache', 'bougies', 'bobines',
    'cacheBobines', 'cacheMoteur', 'carter', 'pompeHuile', 'filtreHuile', 'jauge', 'ccv', 'dme'],
  admission: ['boiteAir', 'debitmetre', 'manchon', 'collecteurAdm', 'disa', 'papillon'],
  refroidissement: ['radiateur', 'vase', 'durites', 'pompeEau', 'thermostat', 'ventilateur'],
  echappement: ['collecteurEch', 'ligneEch', 'sondes', 'pompeAir'],
  transmission: ['volant', 'embrayage', 'boite', 'arbre', 'pont', 'demiArbres'],
  carburant: ['reservoir', 'pompeEssence', 'filtreEssence', 'duriteEssence', 'rampe', 'injecteurs'],
  freinage: FREINS.concat(PEDALES),
  chassis: PIECES_PAR_FICHE.suspension.concat(['boitierDirection', 'colonneDirection', 'roueAvG', 'roueAvD', 'roueArG', 'roueArD']),
  accessoires: ['poulies', 'alternateur', 'pompeDA', 'bocalDA', 'demarreur', 'laveGlace']
};

// Visite guidée : fluides montrés et mécanique en mouvement selon la fiche
const FLUIDES_PAR_FICHE = {
  refroidissement: ['refroidissement'], thermostat: ['refroidissement'],
  carburant: ['carburant', 'retour'], gestion: ['carburant'],
  lubrification: ['huile'], gicleurs: ['huile']
};
const FICHES_MOTEUR_TOURNANT = ['cycle', 'distribution', 'vanos', 'allumage', 'lubrification', 'gicleurs',
  'refroidissement', 'thermostat', 'alternateur', 'direction', 'demarreur', 'admission', 'echappement', 'transmission'];


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

// Au chargement, le moteur est à l'arrêt : il ne tourne qu'avec le mode accélération
// (lancement au démarreur, ralenti, accélération rapport par rapport, puis arrêt et nouveau cycle)
function creerSimulation() {
  const s = { actif: false, phase: 'arret-moteur', t: 0, regime: 0, rapport: 0, embraye: true, roues: 0, charge: 0 };
  const angles = { moteur: 0, disque: 0, arbre: 0, roues: 0, levier: [0, 0] };

  function etape(dt) {
    s.t += dt;
    const rapportTotal = s.rapport ? RAPPORTS[s.rapport - 1] * PONT : 0;
    if (!s.actif) {
      // Contact coupé : le moteur s'arrête et la voiture finit de ralentir
      s.regime = Math.max(0, s.regime - Math.max(400, s.regime * 1.5) * dt);
      s.roues = Math.max(0, s.roues - dt * 3);
      s.rapport = 0; s.embraye = true; s.charge = 0; s.phase = 'arret-moteur';
    } else if (s.phase === 'arret-moteur' || s.phase === 'lancement') {
      // Lancement : le démarreur entraîne le moteur (~250 tr/min), puis il démarre et monte au ralenti
      s.phase = 'lancement';
      s.regime = s.t < 0.7 ? Math.min(250, s.regime + 900 * dt) : s.regime + (RALENTI * 1.15 - s.regime) * Math.min(1, dt * 5);
      if (s.t > 1.3) { s.phase = 'ralenti'; s.t = 0; }
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
   Performance : résolution plafonnée (1,5 sur ordinateur, 1,25 sur mobile),
   ombre recalculée seulement quand la scène change (pas à chaque image).
   ========================================================================== */
function preparerRendu(conteneur, ombres) {
  const petit = window.innerWidth < 720;
  const rendu = new THREE.WebGLRenderer({ antialias: !petit, alpha: true, powerPreference: 'high-performance' });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, petit ? 1.25 : 1.5));
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  rendu.shadowMap.enabled = ombres;
  rendu.shadowMap.type = THREE.PCFSoftShadowMap;
  rendu.shadowMap.autoUpdate = false;
  rendu.shadowMap.needsUpdate = true;
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
    soleil.shadow.mapSize.set(1024, 1024);
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

// Contrôles communs : clic gauche = tourner, clic droit = déplacer (pan), molette = zoomer
function reglerControles(controles) {
  controles.enablePan = true;
  controles.screenSpacePanning = true;
  controles.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
}


/* ==========================================================================
   9. Données des vues : encyclopédie (équipements extérieurs) et cadrages
   Les points sont dans le repère de la maquette ; vue = direction de la caméra.
   ========================================================================== */
const POINTS_ENCYCLO = [
  { id: 'projecteurs', nom: 'Projecteurs à anneaux', texte: 'Projecteurs doubles entourés d\'anneaux lumineux (les « angel eyes »), qui servent de feux de position. Sur ma voiture, ils éclairent en jaune la nuit.', ancre: depuisGlb(-0.52, 0.43, -2.2), vue: [-1, 0.3, 0.45], distance: 12 },
  { id: 'calandre', nom: 'Calandre double haricot', texte: 'La signature BMW : deux grilles noires cerclées de chrome. Sur la E39, elle est fixée au capot et se lève avec lui.', ancre: depuisGlb(0, 0.43, -2.29), vue: [-1, 0.35, 0.15], distance: 10 },
  { id: 'antibrouillards', nom: 'Antibrouillards', texte: 'Deux antibrouillards ronds logés dans le bouclier avant, sous les projecteurs.', ancre: depuisGlb(-0.68, 0.15, -2.17), vue: [-1, 0.12, 0.5], distance: 10 },
  { id: 'clignotant', nom: 'Répétiteur de clignotant', texte: 'Le petit clignotant latéral blanc sur l\'aile avant, propre à la phase 2.', ancre: depuisGlb(-0.9, 0.39, -1.04), vue: [-0.3, 0.2, 1], distance: 8 },
  { id: 'retroviseurs', nom: 'Rétroviseurs', texte: 'Rétroviseurs extérieurs à coque couleur carrosserie, fixés sur les portes avant.', ancre: depuisGlb(-0.93, 0.82, -0.62), vue: [-0.8, 0.35, 0.6], distance: 9 },
  { id: 'poignees', nom: 'Poignées de porte', texte: 'Poignées couleur carrosserie ; la serrure à clé est sur la porte du conducteur, à gauche.', ancre: depuisGlb(-0.885, 0.62, 0.08), vue: [0, 0.2, 1], distance: 8 },
  { id: 'jantes', nom: 'Jantes 17 pouces', texte: 'Jantes 17 pouces à branches doubles, pneus 235/45 R17. Derrière les branches : le disque ventilé et son étrier.', ancre: depuisGlb(-0.83, 0.155, -1.52), vue: [-0.4, 0.2, 1], distance: 14 },
  { id: 'essuieglaces', nom: 'Essuie-glaces', texte: 'Deux essuie-glaces au pied du pare-brise, devant la grille d\'auvent.', ancre: depuisGlb(0, 0.8, -1.0), vue: [-1, 0.9, 0.2], distance: 12 },
  { id: 'feux', nom: 'Feux arrière', texte: 'Feux de phase 2, rouge et blanc : la partie extérieure est sur l\'aile, la partie intérieure sur le couvercle de coffre.', ancre: depuisGlb(-0.6, 0.62, 2.22), vue: [1, 0.2, 0.5], distance: 11 },
  { id: 'badge', nom: 'Logo et badge 520i', texte: 'Le logo BMW au centre du coffre et le badge « 520i » à droite, comme sur ma voiture.', ancre: depuisGlb(0.375, 0.705, 2.32), vue: [1, 0.3, -0.25], distance: 8 },
  { id: 'echappement', nom: 'Sortie d\'échappement', texte: 'Une sortie unique, à gauche, discrète sous le bouclier arrière.', ancre: depuisGlb(-0.53, 0.12, 2.3), vue: [1, -0.05, 0.45], distance: 8 }
];
// Habitacle : les points de la vue intérieure reprennent les fiches des pièces (nom et description) ;
// leur repère est un point de la maquette (volant, patins des pédales, levier, planche de bord)
const POINTS_INTERIEUR = [
  { fiche: 'colonneDirection', ancre: P_VOLANT },
  { fiche: 'pedaleEmbrayage', ancre: [7.15, -1.0, 6.05] },          // patins des pédales (voir « Pédalier »)
  { fiche: 'pedaleFrein', ancre: [7.15, -1.0, 4.5] },
  { fiche: 'pedaleAccelerateur', ancre: [7.15, -0.8, 2.8] },
  { fiche: 'boite', ancre: depuisGlb(-0.013, 0.44, -0.34) },
  { fiche: 'habitacle', ancre: depuisGlb(0, 0.8, -0.62) }
];
// Habitacle : position des yeux du conducteur (à gauche) et direction du regard
const OEIL_CONDUCTEUR = depuisGlb(-0.38, 1.03, 0.12);
const REGARD_CONDUCTEUR = depuisGlb(-0.36, 0.93, -0.6);
// Vue de la photo de la baie moteur : au-dessus du bouclier avant, regard vers le tablier
const VUE_PHOTO = { position: depuisGlb(0, 1.68, -3.05), cible: depuisGlb(0, 0.4, -1.42), fov: 46 };


/* ==========================================================================
   10. Vue principale — un seul moteur de rendu, plusieurs usages :
   - « visite » : pendant les fiches de la documentation, la voiture reste à l'écran
     (scène épinglée) et la caméra rejoint la pièce de la fiche au centre de l'écran
   - « maquette » : la maquette interactive complète
   - « encyclo » : le tour des équipements (extérieur, puis habitacle)
   - « fiche » : la pièce d'une fiche mise en évidence dans la voiture complète
   Le canvas passe d'une zone à l'autre selon la section visible (ou la fiche ouverte).
   ========================================================================== */
function demarrer() {
  const { rendu, scene } = preparerRendu(zoneScene, true);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.3, 800);
  const racineHtml = document.documentElement;
  const petitEcran = () => window.innerWidth < 720;

  const { racine, pieces, meca, fluides } = construireMaquette();
  const monde = new THREE.Group();
  monde.add(racine, fluides.groupe);
  scene.add(monde);
  const listePieces = Object.values(pieces);

  // Toute la voiture est centrée sur l'origine ; le sol (qui ne montre que l'ombre) passe sous les pneus
  const centreBrut = new THREE.Box3().setFromObject(racine).getCenter(new THREE.Vector3());
  monde.position.set(-centreBrut.x, -centreBrut.y, -centreBrut.z);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: 0.14 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = Y_SOL - centreBrut.y;
  sol.receiveShadow = true;
  scene.add(sol);
  monde.updateMatrixWorld(true);
  // Point de la maquette → point de la scène
  const versScene = (p) => new THREE.Vector3(p[0], p[1], p[2]).add(monde.position);

  // Éclairage d'appoint pour l'habitacle (allumé seulement dans la vue intérieure)
  const plafonnier = new THREE.PointLight(0xfff4e6, 0, 30, 1.6);
  plafonnier.position.copy(versScene(depuisGlb(0, 1.05, 0.2)));
  scene.add(plafonnier);

  /* ---------- Ouvrants : chaque porte, le capot et le coffre pivotent autour de leur charnière ---------- */
  const douce = (t) => t * t * (3 - 2 * t);
  const ouvrants = {};
  Object.keys(CHARNIERES).forEach((id) => {
    const p = pieces[id];
    if (!p) return;
    const c = CHARNIERES[id];
    const pivot = new THREE.Group();
    pivot.name = 'pivotOuvrant';
    pivot.position.fromArray(c.point);
    const contenu = new THREE.Group();
    contenu.position.set(-c.point[0], -c.point[1], -c.point[2]);
    p.children.slice().forEach((o) => contenu.add(o));
    pivot.add(contenu);
    p.add(pivot);
    ouvrants[id] = { pivot: pivot, contenu: contenu, axe: c.axe, max: c.angle, t: 0, cible: 0 };
  });
  const contenuDe = (p) => (ouvrants[p.name] ? ouvrants[p.name].contenu : p);
  function poserOuvrant(o) {
    const a = douce(o.t) * o.max;
    if (o.axe === 'z') o.pivot.rotation.z = a; else o.pivot.rotation.y = a;
  }

  // Cache moteur amovible : 0 = posé, 1 = retiré (il se soulève et s'efface)
  const cacheMoteur = { t: 0, cible: 0 };

  // Matériaux d'origine de chaque maillage (vues « fantôme », transparence et fondu de la caisse)
  function memoriserMateriaux(objet) {
    objet.traverse((o) => {
      if (o.isMesh && !o.userData.base) o.userData.base = { opacite: o.material.opacity, transparent: o.material.transparent, depthWrite: o.material.depthWrite };
    });
  }
  memoriserMateriaux(racine);

  // Boîtes et sphères mesurées sur la maquette assemblée (ou éclatée)
  function boiteDe(ids, t) {
    const boite = new THREE.Box3();
    const sauve = listePieces.map((p) => p.position.clone());
    listePieces.forEach((p) => { p.position.copy(p.userData.eclate).multiplyScalar(t || 0); });
    monde.updateMatrixWorld(true);
    ids.forEach((p) => { boite.union(new THREE.Box3().setFromObject(p)); });
    listePieces.forEach((p, i) => p.position.copy(sauve[i]));
    monde.updateMatrixWorld(true);
    return boite;
  }
  const sansCaisse = listePieces.filter((p) => !p.userData.carrosserie);
  const vues = {
    a0: boiteDe(sansCaisse, 0).getBoundingSphere(new THREE.Sphere()),
    a1: boiteDe(listePieces, 0).getBoundingSphere(new THREE.Sphere()),
    e0: boiteDe(sansCaisse, 1).getBoundingSphere(new THREE.Sphere()),
    e1: boiteDe(listePieces, 1).getBoundingSphere(new THREE.Sphere())
  };

  // Caméra placée devant, à gauche et au-dessus, à une distance qui fait tenir toute la voiture
  const DIRECTION = new THREE.Vector3(-11, 6.2, 13).normalize();
  const distanceBase = vues.a1.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8;
  camera.position.copy(vues.a1.center).addScaledVector(DIRECTION, distanceBase);

  // Contrôles : clic gauche pour tourner, clic droit pour déplacer, rotation automatique ;
  // zoom à la molette (après un clic dans la vue) ou au pincement
  const controles = new OrbitControls(camera, rendu.domElement);
  reglerControles(controles);
  controles.enableDamping = !mouvementReduit;
  controles.enableZoom = false;
  controles.zoomToCursor = true;
  controles.autoRotate = !mouvementReduit;
  controles.autoRotateSpeed = 0.6;
  controles.target.copy(vues.a1.center);
  // Sur écran tactile : un doigt fait défiler la page, deux doigts font tourner et zoomer
  controles.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  rendu.domElement.style.touchAction = 'pan-y';
  function limitesMaquette() {
    controles.minPolarAngle = 0.25;
    controles.maxPolarAngle = Math.PI - 0.05;                     // on peut passer sous la voiture
    controles.minDistance = vues.a0.radius * 0.12;
    controles.maxDistance = distanceBase * 1.6;
    controles.enablePan = true;
    controles.rotateSpeed = 1;
  }
  limitesMaquette();

  // La molette ne zoome qu'après un clic dans la vue : sinon elle fait défiler la page
  function activerZoom(actif) {
    controles.enableZoom = actif && (mode === 'maquette' || mode === 'encyclo' || mode === 'fiche') && !(mode === 'encyclo' && encyclo.vue === 'interieur');
    rendu.domElement.parentElement && rendu.domElement.parentElement.toggleAttribute('data-lenis-prevent', controles.enableZoom);
  }
  rendu.domElement.addEventListener('pointerdown', () => activerZoom(true));
  rendu.domElement.addEventListener('pointerleave', () => activerZoom(false));
  // Le clic droit sert au déplacement : pas de menu contextuel sur la vue
  rendu.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- État ---------- */
  let mode = 'aucun';                         // 'maquette', 'visite', 'encyclo', 'fiche', 'photo' (instantané) ou 'aucun'
  let eclate = 0, cibleEclate = 0;            // 0 = assemblé, 1 = éclaté (valeurs animées)
  let caisse = 1, cibleCaisse = 1;            // 1 = carrosserie affichée
  let transparence = false;                   // carrosserie en transparence (maquette)
  let fluidesActifs = false;                  // fluides affichés (maquette)
  let carrosserieDetaillee = false;           // modèle GLB chargé
  const masques = new Set();                  // pièces masquées par le panneau « Affichage »
  const sim = creerSimulation();
  const demo = { moteur: 0, disque: 0, arbre: 0, roues: 0, levier: GRILLE[0] };   // mécanique de la visite
  const cibleEclateCourante = () => (mode === 'maquette' ? cibleEclate : 0);
  const cibleCaisseCourante = () => (mode === 'maquette' ? cibleCaisse : 1);
  // Ouverture voulue de chaque ouvrant selon la vue (tout est fermé pendant la visite)
  const cibleOuvrant = (id, o) => (mode === 'visite' ? 0 : o.cible);
  const cibleCache = () => (mode === 'visite' ? 0 : cacheMoteur.cible);

  /* ---------- Cadrage de la maquette : la caméra suit le centre de la scène et recule en vue éclatée ---------- */
  let zoomBase = 1;
  const centreVise = new THREE.Vector3();
  function vueCourante() {
    const t = douce(eclate), c = douce(caisse);
    const centre = new THREE.Vector3().copy(vues.a0.center).lerp(vues.a1.center, c);
    const centreE = new THREE.Vector3().copy(vues.e0.center).lerp(vues.e1.center, c);
    centre.lerp(centreE, t);
    const rayonA = THREE.MathUtils.lerp(vues.a0.radius, vues.a1.radius, c);
    const rayonE = THREE.MathUtils.lerp(vues.e0.radius, vues.e1.radius, c);
    return { centre: centre, rayon: THREE.MathUtils.lerp(rayonA, rayonE, t) };
  }
  let centrePose = false;
  function cadrer() {
    if (mode !== 'maquette') return;
    const v = vueCourante();
    // La caméra et sa cible suivent le déplacement du centre de la scène (vue éclatée, voiture masquée) ;
    // une vue choisie (angle de la photo, déplacement au clic droit) n'est pas recollée au centre
    if (centrePose) {
      const delta = v.centre.clone().sub(centreVise);
      camera.position.add(delta);
      controles.target.add(delta);
    }
    centrePose = true;
    centreVise.copy(v.centre);
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

  /* ---------- Taille (selon le conteneur où se trouve le canvas) ---------- */
  function conteneurActuel() {
    return rendu.domElement.parentElement || zoneScene;
  }
  function redimensionner() {
    const zone = conteneurActuel();
    const l = zone.clientWidth || 1, h = zone.clientHeight || 1;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    if (mode === 'maquette') {
      camera.clearViewOffset();
      // Recul de la caméra pour que toute la voiture tienne aussi en portrait (mobile)
      zoomBase = Math.min(1, camera.aspect);
      cadrer();
    } else {
      camera.zoom = mode === 'encyclo' ? Math.min(1, camera.aspect * 1.1) : 1;
      camera.updateProjectionMatrix();
    }
    demanderRendu();
  }
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(zoneScene);

  /* ---------- Étiquettes françaises (vue éclatée de la maquette) ---------- */
  // Des numéros plutôt que des noms (moins chargé) : le nom s'affiche au survol du numéro, un clic
  // fait comme un clic sur la pièce (fiche, ouvrant, cache moteur)
  const etiquettes = listePieces.map((p, i) => {
    const el = document.createElement('span');
    el.className = 'etiquette-piece';
    el.textContent = String(i + 1);
    el.dataset.nom = p.userData.nom;
    el.addEventListener('pointerenter', () => changerSurvol(p));
    el.addEventListener('pointerleave', () => changerSurvol(null));
    el.addEventListener('click', () => {
      if (mode !== 'maquette') return;
      if (ouvrants[p.name]) basculerOuvrant(p.name);
      else if (p.name === 'cacheMoteur') basculerCache();
      else if (fichePieceDe(p) && window.ouvrirFichePiece) window.ouvrirFichePiece(fichePieceDe(p));
    });
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
      if (e.boite.isEmpty()) return;
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
      const montrer = e.visible || e.piece === survolee;
      e.el.style.visibility = montrer ? 'visible' : 'hidden';
      if (montrer) e.el.style.transform = 'translate(-50%, -120%) translate(' + e.x.toFixed(1) + 'px,' + e.y.toFixed(1) + 'px)';
    });
  }

  /* ---------- Visibilité, matériaux, fluides ---------- */
  function appliquerVisibilite() {
    listePieces.forEach((p) => {
      let v = mode !== 'maquette' || !masques.has(p.name);
      if (p.userData.carrosserie && caisse <= 0.01) v = false;
      if (p.name === 'cacheMoteur' && cacheMoteur.t >= 0.999) v = false;
      p.visible = v;
    });
  }

  // Opacité de chaque maillage selon le mode : visite et fiche (la pièce visée reste pleine, le reste
  // devient fantôme), fluides (vue fantôme), carrosserie transparente, fondu de la caisse et du cache
  function appliquerMateriaux() {
    const focus = mode === 'visite' ? visite.focus : mode === 'fiche' ? fiche.focus : null;
    racine.traverse((o) => {
      if (!o.isMesh || !o.userData.base) return;
      const b = o.userData.base, p = pieceDe(o);
      if (!p) return;
      const enCaisse = p.userData.carrosserie;
      let opacite = b.opacite, transparent = b.transparent;
      if (mode === 'visite' || mode === 'fiche') {
        if (focus && !focus.has(p.name)) { opacite = Math.min(opacite, enCaisse ? 0.05 : 0.15); transparent = true; }
      } else if (mode === 'maquette') {
        if (fluidesActifs) { opacite = Math.min(opacite, enCaisse ? 0.08 : 0.22); transparent = true; }
        if (enCaisse && transparence) { opacite = Math.min(opacite, 0.4); transparent = true; }
      }
      if (enCaisse && caisse < 0.999) { opacite *= douce(caisse); transparent = true; }
      if (p.name === 'cacheMoteur' && cacheMoteur.t > 0.001) { opacite *= 1 - douce(cacheMoteur.t); transparent = true; }
      // Depuis la place du conducteur, on voit à travers les vitres
      const interieur = mode === 'encyclo' && encyclo.vue === 'interieur';
      if (o.userData.vitreNoire) o.visible = !interieur;
      if (interieur && o.userData.vitre) opacite = Math.min(opacite, 0.22);
      o.material.opacity = opacite;
      if (o.material.transparent !== transparent) {
        o.material.transparent = transparent;
        o.material.depthWrite = transparent ? false : b.depthWrite;
        o.material.needsUpdate = true;
      }
    });
  }

  function majFluides() {
    if (mode === 'visite') {
      const types = (visite.fiche && FLUIDES_PAR_FICHE[visite.fiche]) || [];
      fluides.groupe.visible = types.length > 0 && eclate < 0.02;
      Object.keys(fluides.parType).forEach((t) => { fluides.parType[t].visible = types.includes(t); });
    } else {
      fluides.groupe.visible = mode === 'maquette' && fluidesActifs && eclate < 0.02;
      Object.keys(fluides.parType).forEach((t) => { fluides.parType[t].visible = true; });
    }
  }

  // Position de chaque pièce : décalage de la vue éclatée, plus le cache moteur soulevé
  function placerPieces() {
    const t = douce(eclate);
    listePieces.forEach((p) => p.position.copy(p.userData.eclate).multiplyScalar(t));
    if (pieces.cacheMoteur) pieces.cacheMoteur.position.y += douce(cacheMoteur.t) * 3.5;
  }
  function appliquerEclate() {
    placerPieces();
    majFluides();
    cadrer();
  }

  function eclairer(p, intensite) {
    if (!p) return;
    p.traverse((o) => {
      if (o.isMesh && o.material.emissive) {
        o.material.emissive.setHex(intensite > 0 ? 0x7c3aed : (o.userData.emissif || 0));
        o.material.emissiveIntensity = intensite > 0 ? intensite : (o.userData.intensite || 0);
      }
    });
  }

  /* ---------- Commandes de la maquette ---------- */
  // Rotation automatique de la maquette : figée par le bouton, en vue éclatée et sur l'angle de la photo
  let rotationFigee = false;
  const boutonRotation = document.getElementById('bouton-rotation');
  if (boutonRotation && mouvementReduit) boutonRotation.hidden = true;
  function figerRotation(figee) {
    rotationFigee = figee;
    basculer(boutonRotation, figee, 'REPRENDRE LA ROTATION', 'FIGER LA ROTATION');
    if (mode === 'maquette') controles.autoRotate = !mouvementReduit && !figee;
    demanderRendu();
  }
  if (boutonRotation) boutonRotation.addEventListener('click', () => figerRotation(!rotationFigee));

  function basculer(bouton, actif, libelleActif, libelleInactif) {
    if (!bouton) return;
    bouton.setAttribute('aria-pressed', String(actif));
    const libelle = bouton.querySelector('[data-libelle]');
    if (libelle && libelleActif) libelle.textContent = actif ? libelleActif : libelleInactif;
  }
  const caseGroupe = (g) => document.querySelector('#moteur-calques [data-groupe="' + g + '"]');
  const caseOption = (o) => document.querySelector('#moteur-calques [data-option="' + o + '"]');

  function changerCaisse(affichee) {
    cibleCaisse = affichee ? 1 : 0;
    basculer(boutonVoiture, affichee, 'MASQUER LA VOITURE', 'AFFICHER LA VOITURE');
    const c = caseGroupe('carrosserie');
    if (c) c.checked = affichee;
    if (mouvementReduit) { caisse = cibleCaisse; appliquerVisibilite(); appliquerMateriaux(); cadrer(); }
    demanderOmbre();
    demanderRendu();
  }
  function changerFluides(actifs) {
    fluidesActifs = actifs;
    basculer(boutonFluides, actifs);
    const c = caseOption('fluides');
    if (c) c.checked = actifs;
    if (legendeFluides) legendeFluides.hidden = !actifs;
    majFluides();
    appliquerMateriaux();
    demanderRendu();
  }

  // Ouvrants et cache moteur : un clic ouvre / ferme, retire / repose (animation)
  const boutonCache = document.getElementById('bouton-cache');
  function basculerOuvrant(id, ouvert) {
    const o = ouvrants[id];
    if (!o) return;
    o.cible = ouvert === undefined ? (o.cible ? 0 : 1) : (ouvert ? 1 : 0);
    if (mouvementReduit) { o.t = o.cible; poserOuvrant(o); }
    demanderOmbre();
    demanderRendu();
  }
  function basculerCache(retire) {
    cacheMoteur.cible = retire === undefined ? (cacheMoteur.cible ? 0 : 1) : (retire ? 1 : 0);
    basculer(boutonCache, !!cacheMoteur.cible, 'REPOSER LE CACHE', 'RETIRER LE CACHE');
    const c = caseOption('cache');
    if (c) c.checked = !cacheMoteur.cible;
    if (mouvementReduit) { cacheMoteur.t = cacheMoteur.cible; placerPieces(); appliquerVisibilite(); appliquerMateriaux(); }
    demanderOmbre();
    demanderRendu();
  }

  boutonEclate.addEventListener('click', () => {
    cibleEclate = cibleEclate ? 0 : 1;
    basculer(boutonEclate, !!cibleEclate, 'RÉASSEMBLER', 'VUE ÉCLATÉE');
    cadre.classList.toggle('est-eclate', !!cibleEclate);
    // En vue éclatée, la maquette arrête de tourner toute seule : les pièces restent faciles à viser
    figerRotation(!!cibleEclate);
    if (mouvementReduit) { eclate = cibleEclate; appliquerEclate(); }
    demanderOmbre();
    demanderRendu();
  });
  if (boutonVoiture) boutonVoiture.addEventListener('click', () => changerCaisse(!cibleCaisse));
  if (boutonFluides) boutonFluides.addEventListener('click', () => changerFluides(!fluidesActifs));
  if (boutonCache) boutonCache.addEventListener('click', () => basculerCache());
  // Boutons qui ouvrent ou ferment tous les ouvrants d'un coup
  document.querySelectorAll('[data-ouvrants]').forEach((b) => {
    b.addEventListener('click', () => {
      const ouvrir = !Object.values(ouvrants).some((o) => o.cible);
      Object.keys(ouvrants).forEach((id) => basculerOuvrant(id, ouvrir));
      document.querySelectorAll('[data-ouvrants]').forEach((x) => basculer(x, ouvrir, 'TOUT FERMER', 'TOUT OUVRIR'));
    });
  });

  // Panneau « Affichage » : un groupe d'éléments par case, plus les options
  document.querySelectorAll('#moteur-calques [data-groupe]').forEach((c) => {
    c.addEventListener('change', () => {
      const g = c.dataset.groupe;
      if (g === 'carrosserie') { changerCaisse(c.checked); return; }
      (GROUPES[g] || []).forEach((id) => { if (c.checked) masques.delete(id); else masques.add(id); });
      appliquerVisibilite();
      demanderOmbre();
      demanderRendu();
    });
  });
  const optionTransparence = caseOption('transparence');
  if (optionTransparence) optionTransparence.addEventListener('change', () => {
    transparence = optionTransparence.checked;
    appliquerMateriaux();
    demanderRendu();
  });
  const optionFluides = caseOption('fluides');
  if (optionFluides) optionFluides.addEventListener('change', () => changerFluides(optionFluides.checked));
  const optionCache = caseOption('cache');
  if (optionCache) optionCache.addEventListener('change', () => basculerCache(!optionCache.checked));

  if (boutonAcceleration) {
    if (mouvementReduit) {
      boutonAcceleration.disabled = true;
      boutonAcceleration.title = 'Désactivé : votre système demande de réduire les animations';
    }
    boutonAcceleration.addEventListener('click', () => {
      const s = sim.etat;
      s.actif = !s.actif;
      s.phase = s.actif && s.regime > 600 ? 'ralenti' : 'arret-moteur';
      s.t = 0;
      basculer(boutonAcceleration, s.actif);
      if (panneauSimulation) panneauSimulation.hidden = !s.actif;
      demanderRendu();
    });
  }

  // Zoom au clavier ou au doigt : boutons + / − et recentrage
  // Flèches qui font pivoter la vue (un cran par appui) : maquette et tour du propriétaire ;
  // à l'intérieur, c'est le regard qui tourne autour de la place du conducteur
  // Monter / descendre : la caméra et sa cible se déplacent ensemble à la verticale
  document.querySelectorAll('[data-hauteur]').forEach((b) => b.addEventListener('click', () => {
    const interieur = mode === 'encyclo' && encyclo.vue === 'interieur';
    const pas = Number(b.dataset.hauteur) * (interieur ? 0.15 : Math.max(0.6, camera.position.distanceTo(controles.target) * 0.06));
    camera.position.y += pas;
    controles.target.y += pas;
    controles.update();
    demanderRendu();
  }));
  document.querySelectorAll('[data-pivot]').forEach((b) => b.addEventListener('click', () => {
    const [dx, dy] = b.dataset.pivot.split(',').map(Number);
    const interieur = mode === 'encyclo' && encyclo.vue === 'interieur';
    const centre = interieur ? camera.position : controles.target, mobile = interieur ? controles.target : camera.position;
    const ecart = mobile.clone().sub(centre);
    const sph = new THREE.Spherical().setFromVector3(ecart);
    sph.theta -= (interieur ? -dx : dx) * 0.4;
    sph.phi = interieur ? THREE.MathUtils.clamp(sph.phi - dy * 0.25, 0.35, 2.5) : THREE.MathUtils.clamp(sph.phi + dy * 0.25, controles.minPolarAngle, controles.maxPolarAngle);
    mobile.copy(centre).add(ecart.setFromSpherical(sph));
    controles.update();
    demanderRendu();
  }));
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

  /* ---------- Survol et clic sur une pièce (maquette et encyclopédie) ---------- */
  const rayon = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let survolee = null;

  function pieceDe(o) {
    while (o && !(o.userData && o.userData.piece)) o = o.parent;
    return o;
  }
  function estVisible(o) {
    for (; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  function pieceSous(e) {
    const zone = rendu.domElement.getBoundingClientRect();
    pointeur.set(((e.clientX - zone.left) / zone.width) * 2 - 1, -((e.clientY - zone.top) / zone.height) * 2 + 1);
    rayon.setFromCamera(pointeur, camera);
    for (const touche of rayon.intersectObject(racine, true)) {
      if (!estVisible(touche.object)) continue;
      const p = pieceDe(touche.object);
      if (!p) continue;
      // Carrosserie transparente (ou vue des fluides) : le clic la traverse jusqu'à la mécanique
      if (p.userData.carrosserie && mode === 'maquette' && eclate < 0.5 && (transparence || fluidesActifs)) continue;
      // Pièce presque effacée (cache retiré) : on vise ce qu'il y a derrière
      if (p.name === 'cacheMoteur' && cacheMoteur.t > 0.5) continue;
      if (mode === 'encyclo' && !p.userData.carrosserie && !ouvrants[p.name]) return null;
      return p;
    }
    return null;
  }

  // Fiche individuelle de la pièce (null pour les ouvrants : ils s'ouvrent au clic)
  const fichePieceDe = (p) => (ouvrants[p.name] ? null : (window.FICHE_DE_PIECE && window.FICHE_DE_PIECE[p.name]) || null);
  function actionDe(p) {
    if (ouvrants[p.name]) return ouvrants[p.name].cible ? ' — cliquer pour fermer' : ' — cliquer pour ouvrir';
    if (p.name === 'cacheMoteur') return cacheMoteur.cible ? ' — cliquer pour le reposer' : ' — cliquer pour le retirer';
    return mode === 'maquette' && fichePieceDe(p) ? ' — cliquer pour la fiche' : '';
  }

  function changerSurvol(p) {
    if (p === survolee) return;
    eclairer(survolee, 0);
    survolee = p;
    eclairer(survolee, 0.45);
    zoneSurvolCourante().textContent = p ? p.userData.nom + actionDe(p) : '';
    zoneSurvolCourante().classList.toggle('est-visible', !!p);
    rendu.domElement.style.cursor = p && actionDe(p) ? 'pointer' : '';
    etiquettes.forEach((e) => e.el.classList.toggle('est-active', e.piece === p));
    demanderRendu();
  }
  const survolEncyclo = document.getElementById('encyclo-survol');
  const zoneSurvolCourante = () => (mode === 'encyclo' && survolEncyclo ? survolEncyclo : zoneSurvol);

  rendu.domElement.addEventListener('pointermove', (e) => {
    if ((mode === 'maquette' || (mode === 'encyclo' && encyclo.vue === 'exterieur')) && e.pointerType === 'mouse') changerSurvol(pieceSous(e));
  });
  rendu.domElement.addEventListener('pointerleave', () => changerSurvol(null));

  // Un clic (et pas un glisser) : ouvrant → ouvre / ferme ; cache moteur → retire / repose ;
  // autre pièce → sa fiche individuelle
  let depart = null;
  rendu.domElement.addEventListener('pointerdown', (e) => { depart = { x: e.clientX, y: e.clientY, bouton: e.button }; });
  rendu.domElement.addEventListener('pointerup', (e) => {
    if (!depart || depart.bouton !== 0 || Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 6) return;
    if (mode !== 'maquette' && !(mode === 'encyclo' && encyclo.vue === 'exterieur')) return;
    const p = pieceSous(e);
    if (!p) return;
    if (e.pointerType !== 'mouse') changerSurvol(p);
    if (ouvrants[p.name]) { basculerOuvrant(p.name); changerSurvol(null); return; }
    if (p.name === 'cacheMoteur') { basculerCache(); changerSurvol(null); return; }
    const id = fichePieceDe(p);
    if (mode === 'maquette' && id && window.ouvrirFichePiece) window.ouvrirFichePiece(id);
  });

  /* ---------- Visite guidée des fiches ---------- */
  const sectionMaquette = document.getElementById('moteur');
  const sectionVisite = document.getElementById('documentation');
  const zoneVisite = document.getElementById('visite-scene');
  const textePiece = document.getElementById('visite-piece');
  const texteCompteur = document.getElementById('visite-compteur');
  const avecVisite = !!(sectionVisite && zoneVisite);
  const fichesVisite = avecVisite ? Array.from(sectionVisite.querySelectorAll('.fiche')) : [];
  const visite = {
    index: -2, fiche: null, focus: null, eclairees: [],
    position: new THREE.Vector3(), cible: new THREE.Vector3(), regard: new THREE.Vector3(),
    decalage: { x: 0, y: 0, cx: 0, cy: 0 }, derive: 0, aSauter: true
  };
  if (avecVisite) {
    racineHtml.classList.add('visite-3d');
    observateur.observe(zoneVisite);
    // La page s'allonge : le défilement fluide doit recalculer sa longueur
    requestAnimationFrame(() => { if (window.Site && window.Site.lenis) window.Site.lenis.resize(); });
  }

  // Voyage 3D (espace-3d.js) : les sections sont des cartes ; la carte lue décide de la vue
  const voyage = Object.assign({ carte: null, etape: null, cote: 0 }, window.Site && window.Site.carteVoyage);
  const enVoyage = () => racineHtml.classList.contains('voyage-pret');
  document.addEventListener('voyage:carte', (e) => {
    Object.assign(voyage, e.detail);
    suivreDefilement();
  });

  // Fiche active : celle dont le centre est le plus proche de la ligne de lecture
  // (pendant le voyage : la carte lue, si c'est une fiche)
  function ficheActive() {
    if (enVoyage()) return fichesVisite.indexOf(voyage.carte);
    const h = window.innerHeight, ligne = h * (petitEcran() ? 0.66 : 0.5);
    let meilleure = -1, ecart = Infinity;
    fichesVisite.forEach((f, i) => {
      const z = f.getBoundingClientRect();
      if (z.bottom < 0 || z.top > h) return;
      const d = Math.abs((z.top + z.bottom) / 2 - ligne);
      if (d < ecart) { ecart = d; meilleure = i; }
    });
    if (meilleure === 0 && fichesVisite[0].getBoundingClientRect().top > ligne) meilleure = -1;
    return meilleure;
  }

  // Cadrage d'une ou plusieurs pièces : vue de trois-quarts avant, tournée vers leur côté
  function cadragePieces(ids, sortie, recul, minimum) {
    const centre = vues.a1.center;
    const sphere = boiteDe(ids.map((id) => pieces[id]).filter(Boolean), 0).getBoundingSphere(new THREE.Sphere());
    const radial = sphere.center.clone().sub(centre);
    radial.y = 0;
    const dir = DIRECTION.clone().multiplyScalar(0.8);
    if (radial.length() > 2) dir.addScaledVector(radial.normalize(), 0.9);
    dir.y += 0.35;
    dir.normalize();
    const distance = THREE.MathUtils.clamp(sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (recul || 1.25), minimum || 7, distanceBase);
    sortie.cible.copy(sphere.center);
    sortie.position.copy(sphere.center).addScaledVector(dir, distance);
    return sphere;
  }

  function cadrageVisite() {
    if (!visite.focus) {
      visite.cible.copy(vues.a1.center);
      visite.position.copy(vues.a1.center).addScaledVector(DIRECTION, distanceBase * 0.9);
      return;
    }
    cadragePieces(Array.from(visite.focus), visite);
  }

  function majVisite() {
    if (!avecVisite || mode !== 'visite') return;
    const i = ficheActive();
    if (i === visite.index) return;
    visite.index = i;
    fichesVisite.forEach((f, k) => f.classList.toggle('est-active', k === i));
    const fiche = i >= 0 ? fichesVisite[i] : null;
    // Fiche d'une pièce (pieces-e39.js) : on éclaire ses pièces ; les animations (moteur qui tourne,
    // fluides) suivent son système
    const fichePiece = fiche && window.PIECES_E39 ? window.PIECES_E39.map((g) => g.fiches[fiche.dataset.fiche]).find(Boolean) : null;
    visite.fiche = fiche ? (fichePiece ? fichePiece.systeme || null : fiche.dataset.fiche) : null;
    const ids = (fichePiece ? fichePiece.pieces : (visite.fiche && PIECES_PAR_FICHE[visite.fiche]) || []).filter((id) => pieces[id]);
    visite.focus = ids.length ? new Set(ids) : null;
    // Décalage de l'image : la voiture se place du côté opposé au panneau de la fiche
    if (fiche) {
      const z = fiche.getBoundingClientRect();
      if (petitEcran()) { visite.decalage.cx = 0; visite.decalage.cy = 0.2; }
      else if (enVoyage()) { visite.decalage.cx = voyage.cote * 0.2; visite.decalage.cy = 0; }
      else { visite.decalage.cx = (z.left + z.right) / 2 < window.innerWidth / 2 ? -0.18 : 0.18; visite.decalage.cy = 0; }
    } else { visite.decalage.cx = 0; visite.decalage.cy = 0; }
    cadrageVisite();
    // Mise en valeur : la pièce de la fiche s'illumine
    visite.eclairees.forEach((p) => eclairer(p, 0));
    visite.eclairees = ids.map((id) => pieces[id]);
    if (textePiece) textePiece.textContent = ids.length ? ids.map((id) => pieces[id].userData.nom).slice(0, 2).join(' · ') : 'BMW E39 520i — M54B22';
    if (texteCompteur) texteCompteur.textContent = i >= 0 ? 'Fiche ' + (i + 1) + ' / ' + fichesVisite.length : 'Visite guidée · ' + fichesVisite.length + ' fiches';
    appliquerMateriaux();
    majFluides();
    if (mouvementReduit) visite.aSauter = true;
    demanderRendu();
  }

  function animerVisite(dt) {
    const k = visite.aSauter ? 1 : 1 - Math.exp(-dt * 2.4);
    visite.aSauter = false;
    // Lente dérive autour de la pièce pour garder du relief
    if (!mouvementReduit) visite.derive += dt * 0.12;
    const vise = visite.position.clone().sub(visite.cible).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(visite.derive) * 0.18).add(visite.cible);
    camera.position.lerp(vise, k);
    visite.regard.lerp(visite.cible, k);
    camera.lookAt(visite.regard);
    const d = visite.decalage;
    d.x += (d.cx - d.x) * k;
    d.y += (d.cy - d.y) * k;
    const zone = conteneurActuel(), l = zone.clientWidth || 1, h = zone.clientHeight || 1;
    camera.setViewOffset(l, h, d.x * l, d.y * h, l, h);
    // La pièce de la fiche pulse doucement
    const pulse = mouvementReduit ? 0.3 : 0.22 + Math.sin(performance.now() * 0.004) * 0.12;
    visite.eclairees.forEach((p) => eclairer(p, pulse));
  }

  /* ---------- Encyclopédie : tour des équipements, puis habitacle ---------- */
  const sectionEncyclo = document.getElementById('encyclopedie');
  const zoneEncyclo = document.getElementById('encyclo-scene');
  const calquePoints = document.getElementById('encyclo-points');
  const carteEncyclo = document.getElementById('encyclo-carte');
  const encyclo = { vue: 'exterieur', points: [], pointsInterieur: [], position: null, cible: null, choisi: null, anim: null };
  if (zoneEncyclo) observateur.observe(zoneEncyclo);
  if (calquePoints) {
    POINTS_ENCYCLO.forEach((pt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'encyclo__point';
      b.setAttribute('aria-label', pt.nom);
      b.innerHTML = '<span class="encyclo__numero" aria-hidden="true">' + (i + 1) + '</span><span class="encyclo__nom">' + pt.nom + '</span>';
      b.addEventListener('click', () => choisirPoint(pt, b));
      calquePoints.appendChild(b);
      encyclo.points.push({ donnees: pt, el: b, v: new THREE.Vector3() });
    });
    // Points de l'intérieur (place du conducteur) : nom et description tirés des fiches des pièces
    const fichesPieces = {};
    (window.PIECES_E39 || []).forEach((g) => Object.assign(fichesPieces, g.fiches));
    POINTS_INTERIEUR.forEach((pt) => {
      const f = fichesPieces[pt.fiche];
      if (!f) return;
      const ancre = versScene(pt.ancre);
      const donnees = { nom: f.nom, texte: f.description };
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'encyclo__point';
      b.setAttribute('aria-label', f.nom);
      b.innerHTML = '<span class="encyclo__numero" aria-hidden="true">' + (encyclo.pointsInterieur.length + 1) + '</span><span class="encyclo__nom"></span>';
      b.querySelector('.encyclo__nom').textContent = f.nom;
      b.addEventListener('click', () => choisirPointInterieur(donnees, ancre, b));
      calquePoints.appendChild(b);
      encyclo.pointsInterieur.push({ donnees: donnees, el: b, ancre: ancre, v: new THREE.Vector3() });
    });
  }
  // Avant chaque étape (point, changement de vue, retour à la vue de base) : portes, capot et
  // coffre refermés, cache moteur reposé
  function reinitialiserOuvrants() {
    Object.keys(ouvrants).forEach((id) => basculerOuvrant(id, false));
    if (cacheMoteur.cible) basculerCache(false);
    document.querySelectorAll('[data-ouvrants]').forEach((x) => basculer(x, false, 'TOUT FERMER', 'TOUT OUVRIR'));
  }
  function montrerCarte(donnees, bouton) {
    encyclo.points.concat(encyclo.pointsInterieur).forEach((x) => x.el.classList.toggle('est-choisi', x.el === bouton));
    if (!carteEncyclo) return;
    carteEncyclo.querySelector('[data-titre]').textContent = donnees.nom;
    carteEncyclo.querySelector('[data-texte]').textContent = donnees.texte;
    carteEncyclo.hidden = false;
  }
  function choisirPoint(pt, bouton) {
    encyclo.choisi = pt;
    reinitialiserOuvrants();
    montrerCarte(pt, bouton);
    // La caméra rejoint l'équipement
    const ancre = versScene(pt.ancre);
    const dir = new THREE.Vector3().fromArray(pt.vue).normalize();
    allerVers(ancre.clone().addScaledVector(dir, pt.distance), ancre);
  }
  // Intérieur : le conducteur tourne la tête vers l'équipement
  function choisirPointInterieur(donnees, ancre, bouton) {
    reinitialiserOuvrants();
    montrerCarte(donnees, bouton);
    const oeil = versScene(OEIL_CONDUCTEUR);
    allerVers(oeil, oeil.clone().addScaledVector(ancre.clone().sub(oeil).normalize(), 0.25));
  }
  function allerVers(position, cible) {
    encyclo.anim = { p0: camera.position.clone(), c0: controles.target.clone(), p1: position, c1: cible, t: mouvementReduit ? 1 : 0 };
    demanderRendu();
  }
  function vueEncyclo(v) {
    encyclo.vue = v;
    reinitialiserOuvrants();
    document.querySelectorAll('[data-encyclo-vue]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.encycloVue === v)));
    if (sectionEncyclo) sectionEncyclo.classList.toggle('est-interieur', v === 'interieur');
    if (carteEncyclo) carteEncyclo.hidden = true;
    encyclo.points.concat(encyclo.pointsInterieur).forEach((x) => x.el.classList.remove('est-choisi'));
    if (mode !== 'encyclo') return;
    reglerEncyclo(true);
  }
  // Retour à la vue de base : extérieur, caméra de départ, tout refermé
  document.querySelectorAll('[data-encyclo-base]').forEach((b) => b.addEventListener('click', () => vueEncyclo('exterieur')));
  // Réglages de caméra et de contrôles de l'encyclopédie
  function reglerEncyclo(animer) {
    plafonnier.intensity = encyclo.vue === 'interieur' ? 18 : 0;
    appliquerMateriaux();
    controles.autoRotate = false;
    if (encyclo.vue === 'interieur') {
      // Habitacle : la caméra reste à la place du conducteur, le glisser fait tourner le regard
      const oeil = versScene(OEIL_CONDUCTEUR), regard = versScene(REGARD_CONDUCTEUR);
      const cible = oeil.clone().addScaledVector(regard.clone().sub(oeil).normalize(), 0.25);
      controles.minDistance = 0.25; controles.maxDistance = 0.25;
      controles.minPolarAngle = 0.35; controles.maxPolarAngle = 2.5;
      controles.enablePan = false; controles.enableZoom = false;
      controles.rotateSpeed = -0.45;
      camera.fov = 62; camera.updateProjectionMatrix();
      if (animer) allerVers(oeil, cible); else { camera.position.copy(oeil); controles.target.copy(cible); }
    } else {
      controles.minDistance = 6; controles.maxDistance = distanceBase * 1.3;
      controles.minPolarAngle = 0.2; controles.maxPolarAngle = Math.PI - 0.05;
      controles.enablePan = true; controles.rotateSpeed = 1;
      camera.fov = 35; camera.updateProjectionMatrix();
      const position = vues.a1.center.clone().addScaledVector(DIRECTION, distanceBase * 0.85);
      if (animer) allerVers(position, vues.a1.center.clone()); else { camera.position.copy(position); controles.target.copy(vues.a1.center); }
    }
    demanderRendu();
  }
  document.querySelectorAll('[data-encyclo-vue]').forEach((b) => b.addEventListener('click', () => vueEncyclo(b.dataset.encycloVue)));
  if (carteEncyclo) {
    const fermer = carteEncyclo.querySelector('[data-fermer]');
    // La croix fait comme « Vue de base » : extérieur, caméra de départ, tout refermé ;
    // dans l'habitacle, elle ferme seulement la fiche (on reste à la place du conducteur)
    if (fermer) fermer.addEventListener('click', () => {
      if (encyclo.vue === 'interieur') {
        carteEncyclo.hidden = true;
        encyclo.points.concat(encyclo.pointsInterieur).forEach((x) => x.el.classList.remove('est-choisi'));
      } else vueEncyclo('exterieur');
    });
  }
  // Les points suivent la voiture à l'écran
  function placerPoints() {
    if (!calquePoints) return;
    const zone = conteneurActuel(), l = zone.clientWidth, h = zone.clientHeight;
    const cache = mode !== 'encyclo' || encyclo.vue !== 'exterieur';
    encyclo.points.forEach((x) => {
      if (cache) { x.el.style.visibility = 'hidden'; return; }
      // Un point n'est montré que du côté d'où l'équipement se voit (pas à travers la voiture)
      const ancre = versScene(x.donnees.ancre);
      const versCamera = camera.position.clone().sub(ancre).normalize();
      const deFace = versCamera.dot(new THREE.Vector3().fromArray(x.donnees.vue).normalize()) > -0.05;
      x.v.copy(ancre).project(camera);
      const devant = deFace && x.v.z < 1 && Math.abs(x.v.x) < 1.05 && Math.abs(x.v.y) < 1.05;
      x.el.style.visibility = devant ? 'visible' : 'hidden';
      if (devant) x.el.style.transform = 'translate(' + ((x.v.x + 1) / 2 * l).toFixed(1) + 'px,' + ((1 - x.v.y) / 2 * h).toFixed(1) + 'px)';
    });
    // Intérieur : un point se montre quand l'équipement est dans le champ du regard
    const interieur = mode === 'encyclo' && encyclo.vue === 'interieur';
    encyclo.pointsInterieur.forEach((x) => {
      x.v.copy(x.ancre).project(camera);
      const devant = interieur && x.v.z < 1 && Math.abs(x.v.x) < 0.95 && Math.abs(x.v.y) < 0.95;
      x.el.style.visibility = devant ? 'visible' : 'hidden';
      if (devant) x.el.style.transform = 'translate(' + ((x.v.x + 1) / 2 * l).toFixed(1) + 'px,' + ((1 - x.v.y) / 2 * h).toFixed(1) + 'px)';
    });
  }

  /* ---------- Fiche d'une pièce : la pièce mise en évidence dans la voiture complète ---------- */
  const zoneFiche = document.getElementById('fiche-piece-ensemble');
  const fiche = { actif: false, focus: null, ids: [], sauvegarde: null, eclairees: [] };
  if (zoneFiche) observateur.observe(zoneFiche);
  document.addEventListener('fichepiece:ouverte', (e) => {
    const ids = (e.detail.pieces || []).filter((id) => pieces[id]);
    if (!ids.length || !zoneFiche) return;
    fiche.actif = true;
    fiche.ids = ids;
    fiche.focus = new Set(ids);
    // Les ouvrants restent comme ils sont, sauf pour une pièce de carrosserie (tout est refermé)
    changerMode('fiche');
  });
  document.addEventListener('fichepiece:fermee', () => {
    if (!fiche.actif) return;
    fiche.actif = false;
    fiche.eclairees.forEach((p) => eclairer(p, 0));
    fiche.eclairees = [];
    changerMode(choisirMode());
  });
  function entrerFiche() {
    const cadrage = { position: new THREE.Vector3(), cible: new THREE.Vector3() };
    cadragePieces(fiche.ids, cadrage, 1.9, distanceBase * 0.45);
    controles.target.copy(cadrage.cible);
    camera.position.copy(cadrage.position);
    controles.minDistance = 2; controles.maxDistance = distanceBase * 1.5;
    controles.minPolarAngle = 0.05; controles.maxPolarAngle = Math.PI - 0.05;
    controles.enablePan = true; controles.rotateSpeed = 1;
    controles.autoRotate = !mouvementReduit;
    controles.autoRotateSpeed = 0.8;
    fiche.eclairees = fiche.ids.map((id) => pieces[id]);
    fiche.eclairees.forEach((p) => eclairer(p, 0.35));
  }

  /* ---------- Changement de mode selon la section à l'écran ---------- */
  const sauvegardes = {};
  function choisirMode() {
    if (fiche.actif) return 'fiche';
    if (enVoyage()) {
      if (voyage.etape === sectionMaquette) return 'maquette';
      if (zoneEncyclo && voyage.etape === sectionEncyclo) return 'encyclo';
      if (avecVisite && voyage.etape === sectionVisite) return 'visite';
      return 'aucun';
    }
    const h = window.innerHeight;
    const visibleA = (el, haut, bas) => { if (!el) return false; const z = el.getBoundingClientRect(); return z.top < h * haut && z.bottom > h * bas; };
    if (visibleA(sectionMaquette, 0.85, 0.1)) return 'maquette';
    if (zoneEncyclo && visibleA(sectionEncyclo, 0.9, 0.1)) return 'encyclo';
    if (avecVisite && visibleA(sectionVisite, 1, 0)) return 'visite';
    return 'aucun';
  }

  const ZONES = { maquette: zoneScene, visite: zoneVisite, encyclo: zoneEncyclo, fiche: zoneFiche };
  function changerMode(nouveau) {
    if (nouveau === mode) return;
    // On quitte l'ancien mode : on garde la caméra de la maquette et de l'encyclopédie
    if (mode === 'maquette' || mode === 'encyclo') {
      sauvegardes[mode] = { position: camera.position.clone(), cible: controles.target.clone(), fov: camera.fov };
      changerSurvol(null);
    }
    if (mode === 'fiche') fiche.eclairees.forEach((p) => eclairer(p, 0));
    visite.eclairees.forEach((p) => eclairer(p, 0));
    mode = nouveau;
    racineHtml.classList.toggle('maquette-active', mode === 'maquette');
    const zone = ZONES[mode];
    if (zone && rendu.domElement.parentElement !== zone) zone.appendChild(rendu.domElement);
    camera.clearViewOffset();
    controles.enabled = mode === 'maquette' || mode === 'encyclo' || mode === 'fiche';
    controles.autoRotateSpeed = 0.6;
    plafonnier.intensity = 0;
    if (mode !== 'encyclo' && camera.fov !== 35) { camera.fov = 35; camera.updateProjectionMatrix(); }
    if (mode === 'maquette') {
      limitesMaquette();
      controles.autoRotate = !mouvementReduit && !rotationFigee;
      const s = sauvegardes.maquette;
      if (s) { camera.position.copy(s.position); controles.target.copy(s.cible); }
      else { controles.target.copy(vues.a1.center); camera.position.copy(vues.a1.center).addScaledVector(DIRECTION, distanceBase); }
      meca.poser(sim.angles);
    } else if (mode === 'visite') {
      visite.index = -2;
      visite.aSauter = true;
      visite.regard.copy(controles.target);
    } else if (mode === 'encyclo') {
      const s = sauvegardes.encyclo;
      reglerEncyclo(false);
      if (s) { camera.position.copy(s.position); controles.target.copy(s.cible); camera.fov = s.fov; camera.updateProjectionMatrix(); }
    } else if (mode === 'fiche') {
      entrerFiche();
    }
    if (mode !== 'visite' && visite.index !== -2) visite.index = -2;
    redimensionner();
    appliquerVisibilite();
    appliquerMateriaux();
    majFluides();
    majVisite();
    placerPoints();
    demanderOmbre();
    demanderRendu();
  }

  function suivreDefilement() {
    changerMode(choisirMode());
    if (avecVisite && enVoyage()) racineHtml.classList.toggle('visite-active', mode === 'visite');
    else if (avecVisite) {
      const z = sectionVisite.getBoundingClientRect();
      racineHtml.classList.toggle('visite-active', z.top <= 0 && z.bottom >= window.innerHeight);
    }
    majVisite();
    demanderRendu();
  }
  window.addEventListener('scroll', suivreDefilement, { passive: true });
  window.addEventListener('resize', () => { visite.index = -2; suivreDefilement(); });

  /* ---------- Panneau de simulation ---------- */
  const texteRapport = panneauSimulation && panneauSimulation.querySelector('[data-rapport]');
  const barreRegime = panneauSimulation && panneauSimulation.querySelector('[data-regime]');
  function afficherSimulation() {
    if (!panneauSimulation || panneauSimulation.hidden) return;
    const s = sim.etat;
    texteRapport.textContent = s.phase === 'lancement' ? 'démarrage' : s.regime < 50 ? 'moteur arrêté' : s.rapport ? 'rapport ' + s.rapport : 'point mort';
    barreRegime.style.transform = 'scaleX(' + Math.max(0, s.regime / REGIME_MAX).toFixed(3) + ')';
  }

  /* ---------- Boucle de rendu : on ne dessine que si la vue est à l'écran ---------- */
  const horloge = new THREE.Clock();
  let enCours = false;
  function demanderOmbre() { rendu.shadowMap.needsUpdate = true; }

  function image() {
    enCours = false;
    const dt = Math.min(horloge.getDelta(), 0.05);
    if (mode === 'aucun' || document.hidden) return;

    // Mécanique : maquette = simulation (moteur à l'arrêt tant qu'on n'accélère pas) ;
    // visite = démonstration selon la fiche ; autres vues : immobile
    let vitesses = { moteur: 0, carburant: 0 };
    let anime = false;
    if (mode === 'maquette') {
      if (!mouvementReduit) meca.poser(sim.etape(dt));
      const tourne = sim.etat.regime > 0;
      vitesses = { moteur: omega(sim.etat.regime) * 0.35, carburant: tourne ? 0.6 + sim.etat.charge * 0.9 : 0 };
      afficherSimulation();
      anime = !mouvementReduit && (controles.autoRotate || tourne || sim.etat.actif);
    } else if (mode === 'visite') {
      const tourne = !mouvementReduit && FICHES_MOTEUR_TOURNANT.includes(visite.fiche);
      const w = tourne ? VITESSE_RALENTI * 0.8 : 0;
      const roulent = !mouvementReduit && (visite.fiche === 'transmission' || visite.fiche === 'freinage');
      demo.moteur += w * dt;
      demo.disque += w * dt;
      demo.roues += (roulent ? 0.9 : 0) * dt;
      demo.arbre += (roulent ? 0.9 * PONT : 0) * dt;
      demo.levier = roulent ? GRILLE[3] : GRILLE[0];
      if (!mouvementReduit) meca.poser(demo);
      vitesses = { moteur: mouvementReduit ? 0 : 0.8, carburant: mouvementReduit ? 0 : 0.8 };
      animerVisite(dt);
      anime = !mouvementReduit;
    } else if (mode === 'encyclo' || mode === 'fiche') {
      if (encyclo.anim && mode === 'encyclo') {
        const a = encyclo.anim;
        a.t = Math.min(1, a.t + dt * 1.4);
        const k = douce(a.t);
        camera.position.copy(a.p0).lerp(a.p1, k);
        controles.target.copy(a.c0).lerp(a.c1, k);
        if (a.t >= 1) encyclo.anim = null;
        anime = true;
      }
      anime = anime || (!mouvementReduit && controles.autoRotate);
      if (mode === 'fiche') {
        const pulse = mouvementReduit ? 0.3 : 0.25 + Math.sin(performance.now() * 0.004) * 0.12;
        fiche.eclairees.forEach((p) => eclairer(p, pulse));
      }
    }
    // Débit des fluides : pompe à eau et pompe à huile suivent le moteur, la pompe à essence est électrique
    if (fluides.groupe.visible) {
      Object.keys(fluides.textures).forEach((type) => {
        const v = vitesses[FLUIDES[type].vitesse];
        fluides.textures[type].forEach((f) => { f.tex.offset.x -= v * f.facteur * dt; });
      });
    }

    // Transitions : vue éclatée, caisse, ouvrants, cache moteur
    let bouge = false;
    const cE = cibleEclateCourante(), cC = cibleCaisseCourante();
    if (Math.abs(cE - eclate) > 0.001) {
      eclate += (cE - eclate) * Math.min(1, dt * 3.2);
      if (Math.abs(cE - eclate) <= 0.001 || mouvementReduit) eclate = cE;
      appliquerEclate();
      bouge = true;
    }
    if (Math.abs(cC - caisse) > 0.001) {
      caisse += (cC - caisse) * Math.min(1, dt * 3.5);
      if (Math.abs(cC - caisse) <= 0.001 || mouvementReduit) caisse = cC;
      appliquerVisibilite();
      appliquerMateriaux();
      cadrer();
      bouge = true;
    }
    Object.keys(ouvrants).forEach((id) => {
      const o = ouvrants[id], c = cibleOuvrant(id, o);
      if (Math.abs(c - o.t) <= 0.001) return;
      if (mode === 'photo' || mouvementReduit) o.t = c;
      else { o.t += Math.sign(c - o.t) * Math.min(Math.abs(c - o.t), dt * 1.6); }
      poserOuvrant(o);
      bouge = true;
    });
    const cCache = cibleCache();
    if (Math.abs(cCache - cacheMoteur.t) > 0.001) {
      cacheMoteur.t = mouvementReduit ? cCache : cacheMoteur.t + Math.sign(cCache - cacheMoteur.t) * Math.min(Math.abs(cCache - cacheMoteur.t), dt * 1.8);
      placerPieces();
      appliquerVisibilite();
      appliquerMateriaux();
      bouge = true;
    }
    if (bouge) demanderOmbre();
    if (controles.enabled) controles.update();
    rendu.render(scene, camera);
    if (mode === 'maquette' && (cibleEclate || eclate > 0.01 || survolee)) placerEtiquettes();
    if (mode === 'encyclo') placerPoints();
    // On continue tant que quelque chose bouge (les contrôles relancent eux-mêmes le rendu
    // tant que la caméra glisse) ; sinon la boucle s'arrête jusqu'au prochain événement
    if (anime || bouge) demanderRendu();
  }

  function demanderRendu() {
    if (!enCours) {
      enCours = true;
      window.Site.image(image);
    }
  }

  controles.addEventListener('change', demanderRendu);
  document.addEventListener('visibilitychange', () => { horloge.getDelta(); demanderRendu(); });

  /* ---------- Instantané pour la comparaison « réel / maquette » : même angle que la photo ---------- */
  function instantane(largeur, hauteur) {
    const sauve = {
      mode: mode, pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, zoom: camera.zoom, aspect: camera.aspect,
      ouvrants: Object.keys(ouvrants).map((id) => ouvrants[id].t), cache: cacheMoteur.t, eclate: eclate, caisse: caisse,
      ratio: rendu.getPixelRatio(), taille: rendu.getSize(new THREE.Vector2()), visibles: listePieces.map((p) => p.visible)
    };
    // Capot ouvert, cache posé, tout assemblé et opaque
    mode = 'photo';
    Object.values(ouvrants).forEach((o) => { o.t = 0; poserOuvrant(o); });
    ouvrants.capot.t = 1; poserOuvrant(ouvrants.capot);
    cacheMoteur.t = 0; eclate = 0; caisse = 1;
    placerPieces(); appliquerVisibilite(); appliquerMateriaux();
    listePieces.forEach((p) => { if (p.name !== 'cacheMoteur') p.visible = true; });
    camera.clearViewOffset();
    camera.fov = VUE_PHOTO.fov; camera.zoom = 1; camera.aspect = largeur / hauteur; camera.updateProjectionMatrix();
    camera.position.copy(versScene(VUE_PHOTO.position));
    camera.lookAt(versScene(VUE_PHOTO.cible));
    rendu.setPixelRatio(1);
    rendu.setSize(largeur, hauteur, false);
    rendu.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(0xe9e7ef);                 // le JPEG n'a pas de transparence
    rendu.render(scene, camera);
    const url = rendu.domElement.toDataURL('image/jpeg', 0.88);
    scene.background = null;
    // Retour à l'état précédent
    mode = sauve.mode;
    Object.keys(ouvrants).forEach((id, i) => { ouvrants[id].t = sauve.ouvrants[i]; poserOuvrant(ouvrants[id]); });
    cacheMoteur.t = sauve.cache; eclate = sauve.eclate; caisse = sauve.caisse;
    placerPieces(); appliquerVisibilite(); appliquerMateriaux();
    listePieces.forEach((p, i) => { p.visible = sauve.visibles[i]; });
    camera.position.copy(sauve.pos); camera.quaternion.copy(sauve.quat);
    camera.fov = sauve.fov; camera.zoom = sauve.zoom; camera.aspect = sauve.aspect; camera.updateProjectionMatrix();
    rendu.setPixelRatio(sauve.ratio);
    rendu.setSize(sauve.taille.x, sauve.taille.y, false);
    rendu.shadowMap.needsUpdate = true;
    if (mode !== 'aucun') rendu.render(scene, camera);
    return url;
  }
  // L'instantané est pris quand la section de comparaison approche (une fois la carrosserie chargée)
  const imageMaquette = document.getElementById('comparaison-maquette');
  let instantanePris = false;
  function prendreInstantane() {
    if (instantanePris || !imageMaquette) return;
    instantanePris = true;
    imageMaquette.src = instantane(1200, 803);
    imageMaquette.closest('.comparaison-photo').classList.add('est-pret');
  }
  if (imageMaquette && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entrees) => {
      if (!entrees[0].isIntersecting) return;
      const attendre = () => (carrosserieDetaillee || carrosserieEchec ? prendreInstantane() : setTimeout(attendre, 400));
      attendre();
      obs.disconnect();
    }, { rootMargin: '600px 0px' });
    obs.observe(imageMaquette);
  }
  // Bouton « voir cet angle dans la maquette »
  // La photo est prise avec un objectif plus large (46°) que la maquette (35°) : à direction égale,
  // la caméra recule d'autant pour cadrer la même scène, puis la rotation est figée
  document.querySelectorAll('[data-vue-photo]').forEach((b) => b.addEventListener('click', () => {
    const cible = versScene(VUE_PHOTO.cible);
    const recul = Math.tan(THREE.MathUtils.degToRad(VUE_PHOTO.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(35 / 2));
    sauvegardes.maquette = { position: versScene(VUE_PHOTO.position).sub(cible).multiplyScalar(recul).add(cible), cible: cible };
    basculerOuvrant('capot', true);
    basculerCache(false);
    changerCaisse(true);
    if (cibleEclate) boutonEclate.click();
    figerRotation(true);
    if (mode === 'maquette') { camera.position.copy(sauvegardes.maquette.position); controles.target.copy(sauvegardes.maquette.cible); controles.update(); }
    window.Site.allerA(cadre);
  }));

  /* ---------- Carrosserie détaillée : le modèle 3D remplace la carrosserie de secours ---------- */
  let carrosserieEchec = false;
  const versMaquette = new THREE.Matrix4().makeTranslation(TX_GLB, TY_GLB, 0)
    .multiply(new THREE.Matrix4().makeScale(S_GLB, S_GLB, S_GLB))
    .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  chargerCarrosserie(THREE, { GLTFLoader: GLTFLoader, MeshoptDecoder: MeshoptDecoder, mergeGeometries: mergeGeometries },
    'modeles/bmw-e39-web.glb', versMaquette, materiau('peinture')).then((panneaux) => {
    Object.keys(panneaux).forEach((id) => {
      const p = pieces[id];
      if (!p) return;
      const contenu = contenuDe(p);
      contenu.children.slice().forEach((c) => {
        contenu.remove(c);
        c.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      });
      const exterieur = id !== 'habitacle';
      panneaux[id].forEach((morceau) => {
        const m = new THREE.Mesh(morceau.geometrie, morceau.materiau.clone());
        m.castShadow = exterieur;
        m.userData.mat = 'modele';
        // Vitres teintées et leur doublure noire : allégées dans la vue depuis l'habitacle
        m.userData.vitre = ['window', 'glass'].includes(morceau.materiau.name);
        m.userData.vitreNoire = morceau.materiau.name === 'black_glass';
        contenu.add(m);
      });
    });
    // Le volant de secours laisse la place au volant du modèle
    if (pieces.colonneDirection) pieces.colonneDirection.traverse((o) => { if (o.name === 'volantSecours') o.visible = false; });
    // Le levier de la boîte laisse la place au pommeau du modèle (un seul pommeau dans l'habitacle)
    meca.levier.visible = false;
    // Portes : un cache sombre, entre la garniture et la tôle, bouche les trous du modèle (porte ouverte)
    const CACHES_PORTES = {
      Av: [[-0.84, 0.33], [0.16, 0.33], [0.16, 0.7], [-0.84, 0.7]],                   // [z, y] du modèle, sous la ceinture de caisse
      Ar: [[0.23, 0.33], [0.95, 0.33], [1.15, 0.55], [1.15, 0.7], [0.23, 0.7]]        // coin coupé : passage de roue
    };
    ['G', 'D'].forEach((cote) => Object.keys(CACHES_PORTES).forEach((porte) => {
      const o = ouvrants['porte' + porte + cote];
      if (!o) return;
      const x = cote === 'G' ? -0.8 : 0.8;
      const forme = new THREE.Shape(CACHES_PORTES[porte].map(([z, y]) => { const p = depuisGlb(x, y, z); return new THREE.Vector2(p[0], p[1]); }));
      o.contenu.add(place(maillage(new THREE.ShapeGeometry(forme), 'plastiqueOuvert'), 0, 0, depuisGlb(x, 0, 0)[2]));
    }));
    // Coffre : fond noir (le modèle est vide sous la malle) ; vu de l'extérieur, seul l'intérieur de la boîte se dessine
    if (pieces.caisse) {
      const [x0, y0] = depuisGlb(0, 0.2, 1.3), [x1, y1] = depuisGlb(0, 0.8, 2.25);
      const fond = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 1.24 * S_GLB), new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.BackSide }));
      pieces.caisse.add(place(fond, (x0 + x1) / 2, (y0 + y1) / 2, 0));
    }
    memoriserMateriaux(racine);
    carrosserieDetaillee = true;
    cadre.classList.add('est-detaillee');
    appliquerVisibilite();
    appliquerMateriaux();
    demanderOmbre();
    demanderRendu();
  }).catch((e) => {
    carrosserieEchec = true;
    console.warn('[Moteur 3D] carrosserie détaillée non chargée, carrosserie simplifiée conservée : ' + e.message);
  });

  // Accès pour le débogage depuis la console, et pour les autres scripts de la page
  window.MoteurM54 = {
    pieces: pieces, camera: camera, controles: controles, rendre: demanderRendu, mode: () => mode,
    ouvrants: ouvrants, basculerOuvrant: basculerOuvrant, basculerCache: basculerCache, instantane: instantane
  };

  appliquerVisibilite();
  appliquerMateriaux();
  majFluides();
  suivreDefilement();
  redimensionner();
  cadre.classList.add('est-pret');
  return pieces;
}


/* ==========================================================================
   11. Vues 3D des fiches : la pièce (ou le système) seule, que l'on tourne
   (clic gauche), déplace (clic droit) et zoome (molette) librement
   ========================================================================== */
function brancherMiniMaquette(pieces) {
  let mini = null;     // { rendu, scene, camera, controles, racine }
  let actif = false;

  function preparer(conteneur, ids) {
    if (!mini) {
      const { rendu, scene } = preparerRendu(document.createElement('div'), false);
      const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
      const controles = new OrbitControls(camera, rendu.domElement);
      reglerControles(controles);
      controles.enableDamping = !mouvementReduit;
      controles.autoRotate = !mouvementReduit;
      controles.autoRotateSpeed = 1.2;
      rendu.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
      rendu.domElement.setAttribute('data-lenis-prevent', '');
      controles.addEventListener('start', () => { controles.autoRotate = false; });
      mini = { rendu: rendu, scene: scene, camera: camera, controles: controles, racine: null };
    }
    conteneur.appendChild(mini.rendu.domElement);
    conteneur.setAttribute('data-lenis-prevent', '');

    // Copie des pièces concernées, assemblées (ouvrants fermés, cache posé) et centrées
    if (mini.racine) mini.scene.remove(mini.racine);
    const racine = new THREE.Group();
    ids.forEach((id) => {
      if (!pieces[id]) return;
      const copie = pieces[id].clone(true);
      copie.position.set(0, 0, 0);
      copie.visible = true;
      copie.traverse((o) => {
        if (o.name === 'pivotOuvrant') o.rotation.set(0, 0, 0);
        if (o.name === 'volantSecours') return;
        if (o.isMesh) {
          o.material = o.material.clone();
          if (o.material.emissive) {
            o.material.emissive.setHex(o.userData.emissif || 0);
            o.material.emissiveIntensity = o.userData.intensite || 0;
          }
          if (o.userData.base) {
            o.material.opacity = o.userData.base.opacite;
            o.material.transparent = o.userData.base.transparent;
            o.material.depthWrite = o.userData.base.depthWrite;
          }
        }
      });
      racine.add(copie);
    });
    racine.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(racine).getBoundingSphere(new THREE.Sphere());
    const rayon = Math.max(0.25, sphere.radius);
    racine.position.sub(sphere.center);
    mini.scene.add(racine);
    mini.racine = racine;

    // Distance à laquelle la sphère englobante tient dans la vue (marge de 15 %), quelle que soit la largeur
    taillerMini(conteneur);
    const demiAngle = Math.atan(Math.tan(THREE.MathUtils.degToRad(mini.camera.fov / 2)) * Math.min(1, mini.camera.aspect));
    const distance = rayon / Math.sin(demiAngle) * 1.15;
    mini.camera.position.set(-0.9, 0.55, 1).normalize().multiplyScalar(distance);
    mini.camera.near = distance / 100; mini.camera.far = distance * 20;
    mini.controles.target.set(0, 0, 0);
    mini.controles.minDistance = rayon * 0.4;
    mini.controles.maxDistance = distance * 3;
    mini.controles.autoRotate = !mouvementReduit;
    mini.controles.update();
    taillerMini(conteneur);
  }

  function taillerMini(conteneur) {
    const l = conteneur.clientWidth || 300, h = conteneur.clientHeight || 220;
    mini.rendu.setSize(l, h, false);
    mini.camera.aspect = l / h;
    mini.camera.updateProjectionMatrix();
  }

  function lancerBoucle(conteneur) {
    actif = true;
    let derniereTaille = '';
    (function boucle() {
      if (!actif) return;
      const t = conteneur.clientWidth + 'x' + conteneur.clientHeight;
      if (t !== derniereTaille) { derniereTaille = t; taillerMini(conteneur); }
      mini.controles.update();
      mini.rendu.render(mini.scene, mini.camera);
      window.Site.image(boucle);
    })();
  }

  // Fiches « systèmes » (documentation) : la mini-maquette du système
  document.addEventListener('fiche:ouverte', (e) => {
    const conteneur = e.detail.conteneur;
    const liste = PIECES_PAR_FICHE[e.detail.systeme];
    if (!conteneur || !liste) return;
    conteneur.classList.add('est-remplie');
    // On attend la mise en page de la fenêtre pour connaître la taille de la zone
    requestAnimationFrame(() => { preparer(conteneur, liste); lancerBoucle(conteneur); });
  });
  // Fiches « pièces » : la pièce seule
  document.addEventListener('fichepiece:ouverte', (e) => {
    const conteneur = e.detail.seule;
    if (!conteneur || !e.detail.pieces) return;
    requestAnimationFrame(() => { preparer(conteneur, e.detail.pieces); lancerBoucle(conteneur); });
  });
  const arreter = () => { actif = false; };
  document.addEventListener('fiche:fermee', arreter);
  document.addEventListener('fichepiece:fermee', arreter);
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
      import('three/addons/utils/BufferGeometryUtils.js'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js')
    ]);
    THREE = modules[0];
    OrbitControls = modules[1].OrbitControls;
    RoomEnvironment = modules[2].RoomEnvironment;
    RoundedBoxGeometry = modules[3].RoundedBoxGeometry;
    mergeGeometries = modules[4].mergeGeometries;
    GLTFLoader = modules[5].GLTFLoader;
    MeshoptDecoder = modules[6].MeshoptDecoder;
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

/* Performance : la 3D (chargement de Three.js, construction de la maquette, modèle GLB) n'est
   lancée que quand on approche d'une section qui l'utilise, ou à l'ouverture d'une fiche pièce ;
   le chargement de la page n'est plus bloqué par elle */
let lancement = null;
let ficheEnAttente = null;
function lancerUneFois() {
  if (lancement) return lancement;
  observateurSections.disconnect();
  lancement = lancer().then(() => {
    // Une fiche ouverte avant que la 3D soit prête : on lui envoie ses vues maintenant
    if (ficheEnAttente) document.dispatchEvent(new CustomEvent('fichepiece:ouverte', { detail: ficheEnAttente }));
    ficheEnAttente = null;
  });
  return lancement;
}
const SECTIONS_3D = ['documentation', 'moteur', 'reel', 'encyclopedie'];
const observateurSections = new IntersectionObserver((entrees) => {
  if (entrees.some((e) => e.isIntersecting) && !document.documentElement.classList.contains('voyage-pret')) lancerUneFois();
}, { rootMargin: '100% 0px' });
SECTIONS_3D.forEach((id) => { const el = document.getElementById(id); if (el) observateurSections.observe(el); });
// Voyage 3D : on lance la 3D une étape avant la documentation (ou plus loin)
const etapesPage = Array.from(document.querySelectorAll('[data-etape]'));
const premiere3d = Math.min(...SECTIONS_3D.map((id) => etapesPage.indexOf(document.getElementById(id))).filter((i) => i >= 0));
const surCarte = (detail) => { if (detail && etapesPage.indexOf(detail.etape) >= premiere3d - 1) lancerUneFois(); };
document.addEventListener('voyage:carte', (e) => surCarte(e.detail));
surCarte(window.Site && window.Site.carteVoyage);
document.addEventListener('fichepiece:ouverte', (e) => {
  if (lancement) return;
  ficheEnAttente = e.detail;
  lancerUneFois();
});
