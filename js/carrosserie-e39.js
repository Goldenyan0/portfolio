/* ==========================================================================
   carrosserie-e39.js — la carrosserie de la maquette, tirée du modèle 3D
   « BMW E39 Free » de Black Snow (licence CC BY 4.0, crédit dans le README),
   dans sa version allégée modeles/bmw-e39-web.glb (compression meshopt).
   Le modèle d'origine est une M5 ; à l'import, on le ramène à ma 520i :
   - badges M5 retirés, badge « 520i » ajouté à droite du coffre (comme sur la voiture)
   - échappement : une seule sortie, à gauche
   - roues M5 retirées : les roues 17 pouces de la maquette les remplacent
   - pédales retirées : la maquette a ses trois pédales
   - peinture bleu topaze métallisé, vernie
   Les triangles d'un ouvrant qui débordent de sa zone (garnitures étirées à l'ouverture)
   sont retirés ; moteur-3d.js bouche les trous (caches de portes, fond noir du coffre).
   Chaque triangle est rangé dans un panneau (capot, portes, coffre, ailes…)
   d'après sa position : les ouvrants peuvent s'ouvrir et la vue éclatée
   sépare les panneaux. Les maillages identiques d'un même panneau sont fusionnés.
   Repère du fichier : mètres, avant vers -Z, droite de la voiture vers +X.
   ========================================================================== */

// Maillages retirés (noms nettoyés par GLTFLoader : les points disparaissent)
const RETIRES = ['Object_44002', 'Object_4001', 'Object_4002', 'Object_4003', 'Object_4004',
  'Object_39001', 'Object_39003', 'Object_39004', 'Object_39005',
  'Object_24001', 'Object_24002', 'Object_24003', 'Object_24004'];
// Les quatre sorties d'échappement de la M5
const ECHAPPEMENT = ['Object_51001', 'Object_37001', 'Object_25001'];
// Garnitures intérieures (rangées dans l'habitacle, sauf celles des portes)
const INTERIEUR = ['Object_4', 'Object_5', 'Object_6', 'Object_8', 'Object_10', 'Object_11', 'Object_12', 'Object_14',
  'Object_16', 'Object_19', 'Object_21', 'Object_35', 'Object_40', 'Object_49', 'Object_53', 'Object_54', 'Object_55',
  'Object_58001', 'Object_58002', 'Object_58003', 'Object_14001', 'Object_14002', 'Object_35001', 'Object_35002', 'Object_49001'];
// Feux arrière (tous fixés à la carrosserie)
const FEUX = ['Object_64', 'Object_42', 'Object_50', 'Object_59', 'Object_41', 'Object_63', 'Object_58'];
const VITRES = ['Object_62', 'Object_26'];
// Derrière la calandre (ventilateur, cadre du bouclier) : restent sur la voiture, pas sur le capot
const DERRIERE_CALANDRE = ['Object_31', 'Object_51002', 'Object_51003', 'Object_51004'];

// "Object_33_body_0" → "Object_33"
const prefixe = (nom) => (nom.match(/^Object_\d+/) || [''])[0];
const dans = (liste, nom) => liste.includes(prefixe(nom));

/* --------------------------------------------------------------------------
   Zones des ouvrants (repère du fichier, en mètres)
   -------------------------------------------------------------------------- */
const Z_PORTES = 0.195;                                            // entre porte avant et porte arrière
const limiteAvantPorte = (y) => -0.925 + Math.max(0, y - 0.86) * 0.95;  // montant de pare-brise incliné
const limiteArrierePorte = (y) => 1.31 - Math.max(0, y - 0.95) * 0.5;   // custode inclinée

// Porte contenant le point (ou null). ecart : distance minimale à l'axe de la voiture ;
// bas : hauteur minimale (les garnitures intérieures descendent plus bas que la tôle).
function zonePorte(x, y, z, ecart, marge, bas) {
  const ax = Math.abs(x), m = marge || 0;
  if (ax < ecart - m || y < (bas || 0.25) - m || y > 1.195 + m) return null;
  const cote = x < 0 ? 'G' : 'D';
  if (z >= limiteAvantPorte(y) - m && z < Z_PORTES + m) return 'porteAv' + cote;
  if (z >= Z_PORTES - m && z <= limiteArrierePorte(y) + m) return 'porteAr' + cote;
  return null;
}

// Petites pièces posées sur le capot (calandre en double haricot, logo) et sur le coffre
const surCapot = (x, y, z) => Math.abs(x) < 0.285 && z < -2.17 && y > 0.335;
// (au-dessus des baguettes sous les feux : elles restent sur la carrosserie)
const surCoffre = (x, y, z) => Math.abs(x) < 0.625 && z > 1.72 && y > 0.56 && y < 0.885;

// Panneau d'un point qui n'appartient pas à un ouvrant
function region(x, y, z, interieur) {
  const ax = Math.abs(x), cote = x < 0 ? 'G' : 'D';
  if (interieur) return 'habitacle';
  if (z < -1.8 && y < 0.56) return 'faceAvant';
  if (z > 1.74 && y < 0.47) return 'faceArriere';
  if (y > 1.12) return 'toit';
  if (z < -0.93) return ax > 0.4 ? 'aileAv' + cote : 'caisse';
  if (z > 1.28) return ax > 0.4 ? 'custode' + cote : 'caisse';
  return 'caisse';
}


/* --------------------------------------------------------------------------
   Outils : composantes connexes (sommets soudés au millimètre)
   -------------------------------------------------------------------------- */
function composantes(positions, index, nbTriangles) {
  const nbSommets = positions.length / 3;
  const soudure = new Map();
  const rep = new Int32Array(nbSommets);
  for (let i = 0; i < nbSommets; i++) {
    const cle = Math.round(positions[i * 3] * 1000) + ',' + Math.round(positions[i * 3 + 1] * 1000) + ',' + Math.round(positions[i * 3 + 2] * 1000);
    let r = soudure.get(cle);
    if (r === undefined) { r = i; soudure.set(cle, i); }
    rep[i] = r;
  }
  const parent = new Int32Array(nbSommets).map((_, i) => i);
  const racine = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const unir = (a, b) => { a = racine(a); b = racine(b); if (a !== b) parent[a] = b; };
  for (let t = 0; t < nbTriangles; t++) {
    unir(rep[index(t * 3)], rep[index(t * 3 + 1)]);
    unir(rep[index(t * 3)], rep[index(t * 3 + 2)]);
  }
  // Numéro de composante de chaque triangle + boîte englobante de chaque composante
  const numero = new Map();
  const triComp = new Int32Array(nbTriangles);
  const boites = [];
  for (let t = 0; t < nbTriangles; t++) {
    const r = racine(rep[index(t * 3)]);
    let c = numero.get(r);
    if (c === undefined) {
      c = boites.length;
      numero.set(r, c);
      boites.push({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], triangles: [] });
    }
    triComp[t] = c;
    const b = boites[c];
    b.triangles.push(t);
    for (let k = 0; k < 3; k++) {
      const v = index(t * 3 + k) * 3;
      for (let a = 0; a < 3; a++) {
        if (positions[v + a] < b.min[a]) b.min[a] = positions[v + a];
        if (positions[v + a] > b.max[a]) b.max[a] = positions[v + a];
      }
    }
  }
  boites.forEach((b) => { b.centre = [0, 1, 2].map((a) => (b.min[a] + b.max[a]) / 2); });
  return boites;
}

// Composante (presque) entièrement dans les portes ? Renvoie { porte majoritaire, plusieurs portes }
// ou null. part : proportion minimale de sommets dans une porte (1 = tous).
function porteDeComposante(b, positions, index, ecart, part, bas) {
  const compte = {};
  let dedans = 0, total = 0;
  for (const t of b.triangles) {
    for (let k = 0; k < 3; k++) {
      const v = index(t * 3 + k) * 3;
      const p = zonePorte(positions[v], positions[v + 1], positions[v + 2], ecart, 0.015, bas);
      total++;
      if (p) { dedans++; compte[p] = (compte[p] || 0) + 1; }
    }
  }
  if (!dedans || dedans < total * part) return null;
  const portes = Object.keys(compte).sort((a, b2) => compte[b2] - compte[a]);
  return { porte: portes[0], plusieurs: portes.length > 1 && compte[portes[1]] > total * 0.1 };
}


/* --------------------------------------------------------------------------
   Panneau de chaque triangle d'un maillage
   -------------------------------------------------------------------------- */
function etiqueter(nom, positions, index, nbTriangles) {
  const labels = new Array(nbTriangles).fill(null);
  const boites = composantes(positions, index, nbTriangles);
  const pref = prefixe(nom);
  const interieur = dans(INTERIEUR, nom);
  // Garnitures de porte : à l'intérieur, la porte commence plus loin de l'axe et descend plus bas
  const ecartPorte = interieur ? 0.665 : 0.555;
  const basPorte = interieur ? 0.17 : 0.25;
  const centre = (t) => {
    const a = index(t * 3) * 3, b = index(t * 3 + 1) * 3, c = index(t * 3 + 2) * 3;
    return [0, 1, 2].map((k) => (positions[a + k] + positions[b + k] + positions[c + k]) / 3);
  };
  // portes : 'oui' (tout point d'une porte y va), 'seules' (partage entre portes avant / arrière
  // d'une garniture qui n'appartient qu'aux portes), 'non'
  const regionTriangle = (t, portes) => {
    const [x, y, z] = centre(t);
    // (les seuils, tout en bas, restent sur la caisse)
    if (portes === 'seules' && y >= 0.17) return (z < Z_PORTES ? 'porteAv' : 'porteAr') + (x < 0 ? 'G' : 'D');
    if (portes === 'oui') {
      const p = interieur ? (y < 0.95 && zonePorte(x, y, z, 0.70, 0, basPorte)) : zonePorte(x, y, z, ecartPorte, 0, basPorte);
      if (p) return p;
    }
    // Feux arrière : fixés à la carrosserie, ils ne montent pas avec la malle
    if (dans(FEUX, nom) && z > 1.7 && y > 0.45) return 'feuxAr';
    if (surCapot(x, y, z) && !dans(DERRIERE_CALANDRE, nom)) return 'capot';
    if (surCoffre(x, y, z) && !interieur) return 'coffre';
    // Doublure noire sous le capot (le reste de ce maillage : passages de roue, dessous)
    if (pref === 'Object_25' && z < -0.95 && z > -2.22 && y > 0.55 && Math.abs(x) < 0.8) return 'capot';
    // Dessus du caisson « frame » : il fermait la baie moteur
    if (pref === 'Object_43' && z > -2.05 && z < -0.95 && y > 0.45) return 'retire';
    // Bas des portes : dans le modèle, la tôle sous la porte (au-dessus du bas de caisse) fait partie
    // de la coque ; elle suit la porte (passage de roue arrière exclu)
    if (pref === 'Object_33' && y > 0.14 && y < 0.37 && Math.abs(x) > 0.78 && z < 0.98) {
      const p = zonePorte(x, y, z, 0.78, 0, 0.14);
      if (p) return p;
    }
    // Coque : l'aile avant entoure le projecteur
    if (pref === 'Object_33' && z < -1.8 && y >= 0.33 && Math.abs(x) > 0.55) return 'aileAv' + (x < 0 ? 'G' : 'D');
    return region(x, y, z, interieur);
  };

  boites.forEach((b) => {
    const [cx] = b.centre;
    let label = null, portes = 'oui';
    if (pref === 'Object_28') label = 'faceAvant';
    else if (pref === 'Object_30') label = 'coffre';
    // Pédales du modèle : la maquette a ses trois pédales
    else if (pref === 'Object_14' && b.max[1] < 0.4 && b.min[2] > -0.96 && b.max[2] < -0.68 && b.max[0] < -0.2) label = 'retire';
    else if (dans(ECHAPPEMENT, nom)) label = cx > -0.43 ? 'retire' : 'faceArriere';
    else if (pref === 'Object_44' && b.max[1] < 0.4) label = 'retire';           // inserts des baguettes (M5)
    else if (pref === 'Object_65') label = 'caisse';                             // grille d'auvent
    else if (pref === 'Object_40' || pref === 'Object_55') label = 'habitacle';   // garnitures de montants
    else if (pref === 'Object_29') {
      if (b.max[2] < -0.9 && b.min[1] > 0.3) label = 'capot';
      else if (b.min[2] > 1.5) label = 'faceArriere';
      else { const p = porteDeComposante(b, positions, index, 0.555, 1); label = p ? p.porte : 'caisse'; }  // rétroviseurs, bas de caisse
    } else if (dans(VITRES, nom) && b.min[0] < 0 && b.max[0] > 0) {
      label = b.min[1] > 1.15 ? 'toit' : b.max[2] < -0.2 ? 'pareBrise' : b.min[2] > 1.0 ? 'lunette' : null;
    } else if (interieur && b.min[2] > 0 && b.max[2] < 0.32 && Math.max(-b.min[0], b.max[0]) < 0.71) {
      label = 'habitacle';                                                       // garnitures du montant central
    } else if (pref === 'Object_33' || pref === 'Object_25') {
      // Coque et doublures : seules les composantes entières des portes les suivent
      const p = porteDeComposante(b, positions, index, 0.555, 0.95);
      label = p ? p.porte : (pref === 'Object_33' && b.min[1] > 1.1 ? 'toit' : null);
      portes = 'non';
    } else {
      const p = porteDeComposante(b, positions, index, ecartPorte, interieur ? 0.9 : 1, basPorte);
      if (p && !p.plusieurs) label = p.porte;
      else if (p) portes = 'seules';
    }
    if (label) { b.triangles.forEach((t) => { labels[t] = label; }); return; }
    // Composante à cheval sur plusieurs panneaux : triangle par triangle
    b.triangles.forEach((t) => { labels[t] = regionTriangle(t, portes); });
  });
  // Garnitures intérieures qui dépassent en avant du tablier : elles se verraient dans la baie moteur
  if (interieur) {
    for (let t = 0; t < nbTriangles; t++) {
      if (labels[t] === 'habitacle' && centre(t)[2] < -0.94) labels[t] = 'retire';
    }
  }
  // Triangles d'un ouvrant qui débordent de sa zone (ils s'étirent en lambeaux à l'ouverture) :
  // retirés ; les caches des portes et le fond du coffre bouchent les trous (moteur-3d.js)
  for (let t = 0; t < nbTriangles; t++) {
    const l = labels[t];
    if (l !== 'coffre' && !(interieur && l && l.startsWith('porte'))) continue;
    for (let k = 0; k < 3; k++) {
      const v = index(t * 3 + k) * 3, x = positions[v], y = positions[v + 1], z = positions[v + 2];
      const dehors = l === 'coffre' ? !(Math.abs(x) < 0.66 && z > 1.7 && y > 0.46) : zonePorte(x, y, z, 0.64, 0.03, basPorte) !== l;
      if (dehors) { labels[t] = 'retire'; break; }
    }
  }
  return labels;
}


/* --------------------------------------------------------------------------
   Matériaux : les matériaux identiques sont partagés (moins d'appels de dessin)
   -------------------------------------------------------------------------- */
function signature(m) {
  return [m.type, m.color && m.color.getHexString(), m.roughness, m.metalness, m.map && m.map.uuid,
    m.transparent, m.opacity, m.side, m.emissive && m.emissive.getHexString()].join('|');
}


/* --------------------------------------------------------------------------
   Badge « 520i » : texte chromé sur une plaque transparente
   -------------------------------------------------------------------------- */
function badge520i(THREE) {
  const toile = document.createElement('canvas');
  toile.width = 512; toile.height = 128;
  const ctx = toile.getContext('2d');
  // Lettres droites et géométriques (comme le badge d'origine), en chrome : dégradé vertical
  // clair / sombre / clair avec un reflet net au milieu, et un fin liseré sombre pour le relief
  ctx.font = '600 104px "Space Grotesk", Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chrome = ctx.createLinearGradient(0, 18, 0, 110);
  chrome.addColorStop(0, '#ffffff');
  chrome.addColorStop(0.35, '#c9ced6');
  chrome.addColorStop(0.48, '#5c6370');
  chrome.addColorStop(0.52, '#f2f4f7');
  chrome.addColorStop(0.75, '#9aa1ab');
  chrome.addColorStop(1, '#e9ecf0');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(20, 22, 28, 0.55)';
  ctx.strokeText('520i', 256, 68);
  ctx.fillStyle = chrome;
  ctx.fillText('520i', 256, 66);
  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: texture, transparent: true, metalness: 0.35, roughness: 0.3, emissive: 0x5a5f68, emissiveMap: texture, depthWrite: false });
}


/* --------------------------------------------------------------------------
   Chargement : renvoie les panneaux (géométries dans le repère de la maquette)
   versMaquette : matrice qui passe du repère du fichier à celui de la maquette
   -------------------------------------------------------------------------- */
export async function chargerCarrosserie(THREE, outils, url, versMaquette, peinture) {
  const { GLTFLoader, MeshoptDecoder, mergeGeometries } = outils;
  const chargeur = new GLTFLoader();
  chargeur.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await chargeur.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);

  const lots = new Map();            // "panneau|signature" → { panneau, materiau, geos: [] }
  const materiaux = new Map();       // signature → matériau partagé
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const total = new THREE.Matrix4(), normale = new THREE.Matrix3();

  gltf.scene.traverse((objet) => {
    if (!objet.isMesh || RETIRES.includes(prefixe(objet.name))) return;
    const geo = objet.geometry;
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const indexBrut = geo.index ? geo.index.array : null;
    const index = indexBrut ? (i) => indexBrut[i] : (i) => i;
    const nbTriangles = (indexBrut ? indexBrut.length : pos.count) / 3;

    // Positions dans le repère du fichier (mètres)
    const positions = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(objet.matrixWorld);
      positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
    }
    const labels = etiqueter(objet.name, positions, index, nbTriangles);

    // Matériau : peinture de la caisse remplacée, les autres partagés par signature
    let materiau = objet.material;
    if (materiau.name === 'body') materiau = peinture;
    else {
      const sig = signature(materiau);
      if (!materiaux.has(sig)) materiaux.set(sig, materiau);
      materiau = materiaux.get(sig);
    }

    total.multiplyMatrices(versMaquette, objet.matrixWorld);
    normale.getNormalMatrix(total);

    // Un morceau de géométrie par panneau (sommets renumérotés)
    const parPanneau = new Map();
    for (let t = 0; t < nbTriangles; t++) {
      const l = labels[t];
      if (l === 'retire') continue;
      if (!parPanneau.has(l)) parPanneau.set(l, []);
      parPanneau.get(l).push(t);
    }
    parPanneau.forEach((triangles, panneau) => {
      const nouveau = new Int32Array(pos.count).fill(-1);
      const p = [], ns = [], us = [], idx = [];
      triangles.forEach((t) => {
        for (let k = 0; k < 3; k++) {
          const i = index(t * 3 + k);
          if (nouveau[i] < 0) {
            nouveau[i] = p.length / 3;
            v.fromBufferAttribute(pos, i).applyMatrix4(total);
            p.push(v.x, v.y, v.z);
            if (nor) { n.fromBufferAttribute(nor, i).applyMatrix3(normale).normalize(); ns.push(n.x, n.y, n.z); }
            if (uv) us.push(uv.getX(i), uv.getY(i));
          }
          idx.push(nouveau[i]);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(us, 2));
      g.setIndex(idx);
      if (!nor) g.computeVertexNormals();
      const cle = panneau + '|' + materiau.uuid + '|' + (uv ? 'uv' : '');
      if (!lots.has(cle)) lots.set(cle, { panneau: panneau, materiau: materiau, geos: [] });
      lots.get(cle).geos.push(g);
    });
  });

  // Fusion par panneau et par matériau
  const panneaux = {};
  lots.forEach((lot) => {
    const g = lot.geos.length > 1 ? mergeGeometries(lot.geos, false) : lot.geos[0];
    if (lot.geos.length > 1) lot.geos.forEach((x) => x.dispose());
    if (!g) return;
    (panneaux[lot.panneau] = panneaux[lot.panneau] || []).push({ geometrie: g, materiau: lot.materiau, peinture: lot.materiau === peinture });
  });

  // Badge « 520i » à droite du coffre, à la place du badge M5 (x ≈ 0,31 → 0,44 m)
  const plaque = new THREE.PlaneGeometry(0.13, 0.0325);
  plaque.applyMatrix4(new THREE.Matrix4().makeTranslation(0.375, 0.705, 2.318));
  plaque.applyMatrix4(versMaquette);
  (panneaux.coffre = panneaux.coffre || []).push({ geometrie: plaque, materiau: badge520i(THREE), peinture: false });

  gltf.scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return panneaux;
}
