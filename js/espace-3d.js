/* ==========================================================================
   espace-3d.js — l'environnement 3D commun aux 3 pages
   Le réseau « étoiles d'araignée » de l'accueil devient un espace qu'on traverse :
   - Une caméra avance le long d'un chemin qui serpente dans le réseau ; c'est le
     défilement de la page qui la fait avancer (elle marque une pause à chaque étape)
   - Chaque section marquée [data-etape] est un point violet (waypoint) : quand la
     caméra l'atteint, la section reçoit la classe .est-atteinte et son panneau s'affiche
   - Des paquets de données circulent ; les nœuds proches de la souris s'illuminent
   - Aides à la navigation : rail de repères (cliquables), jauge de progression,
     annonce de l'étape atteinte ; effet de vitesse quand on défile vite
   Bibliothèque : Three.js (même URL que l'importmap de e39.html : un seul chargement).
   Repli : sans WebGL, la page reste un site classique (panneaux et repères compris).
   Mouvement réduit : une image fixe, la caméra ne se déplace pas.
   ========================================================================== */

const URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const racineHtml = document.documentElement;
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const petitEcran = window.innerWidth < 720;
const etapes = Array.from(document.querySelectorAll('[data-etape]'));

// Vérifie que le navigateur sait faire du WebGL
function webglDisponible() {
  try {
    const essai = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (essai.getContext('webgl2') || essai.getContext('webgl')));
  } catch (e) {
    return false;
  }
}


/* --------------------------------------------------------------------------
   1. Repères : rail des étapes (bureau), jauge et annonce (toutes tailles)
   -------------------------------------------------------------------------- */
const reperes = (function creerReperes() {
  if (etapes.length < 2) return null;
  const nav = document.createElement('nav');
  nav.className = 'reperes';
  nav.setAttribute('aria-label', 'Repères du parcours');
  const liste = document.createElement('ol');
  const boutons = etapes.map((etape, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'reperes__bouton';
    b.innerHTML = '<span class="reperes__point" aria-hidden="true"></span><span class="reperes__nom"></span>';
    b.querySelector('.reperes__nom').textContent = etape.dataset.etape;
    b.addEventListener('click', () => {
      const site = window.Site;
      if (site && site.lenis) site.lenis.scrollTo(etape, { offset: -60, duration: 1.6 });
      else etape.scrollIntoView({ behavior: mouvementReduit ? 'auto' : 'smooth' });
    });
    li.appendChild(b);
    liste.appendChild(li);
    return b;
  });
  nav.appendChild(liste);
  const trace = document.createElement('span');
  trace.className = 'reperes__trace';
  trace.innerHTML = '<span></span>';
  nav.appendChild(trace);
  document.body.appendChild(nav);

  // Jauge de progression (fine ligne sous la navigation) et annonce de l'étape atteinte
  const jauge = document.createElement('div');
  jauge.className = 'reperes__jauge';
  jauge.setAttribute('aria-hidden', 'true');
  jauge.innerHTML = '<span></span>';
  document.body.appendChild(jauge);
  const annonce = document.createElement('p');
  annonce.className = 'reperes__annonce';
  annonce.setAttribute('aria-hidden', 'true');
  document.body.appendChild(annonce);

  let active = -1, minuterie = 0;
  return {
    activer(i) {
      if (i === active) return;
      const premiere = active === -1;
      active = i;
      boutons.forEach((b, k) => {
        b.classList.toggle('est-active', k === i);
        b.classList.toggle('est-passee', k < i);
        if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      etapes.forEach((e, k) => e.classList.toggle('est-atteinte', k === i));
      trace.firstChild.style.transform = 'scaleY(' + (i / (etapes.length - 1)).toFixed(3) + ')';
      if (premiere) return;
      annonce.textContent = etapes[i].dataset.etape;
      annonce.classList.add('est-visible');
      clearTimeout(minuterie);
      minuterie = setTimeout(() => annonce.classList.remove('est-visible'), 1600);
    },
    progression(p) {
      jauge.firstChild.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
  };
})();


/* --------------------------------------------------------------------------
   2. Position de chaque étape dans la page et paramètre de la caméra
   -------------------------------------------------------------------------- */
let ancres = [];        // défilement (px) auquel la caméra arrive sur chaque étape
let finPage = 1;
function mesurerAncres() {
  const h = window.innerHeight;
  ancres = etapes.map((e) => Math.max(0, e.getBoundingClientRect().top + window.scrollY - h * 0.3));
  for (let i = 1; i < ancres.length; i++) ancres[i] = Math.max(ancres[i], ancres[i - 1] + 1);
  finPage = Math.max(1, document.documentElement.scrollHeight - h);
}

// Renvoie { position (0 → nb d'étapes - 1, avec pauses aux étapes), active }
function etatDefilement(s) {
  if (!ancres.length) return { position: 0, active: 0 };
  if (s <= ancres[0]) return { position: 0, active: 0 };
  for (let i = 0; i < ancres.length - 1; i++) {
    if (s < ancres[i + 1]) {
      const f = (s - ancres[i]) / (ancres[i + 1] - ancres[i]);
      const t = Math.min(1, Math.max(0, (f - 0.12) / 0.76));
      return { position: i + t * t * (3 - 2 * t), active: f < 0.55 ? i : i + 1 };
    }
  }
  return { position: ancres.length - 1, active: ancres.length - 1 };
}

function suivreDefilement() {
  const e = etatDefilement(window.scrollY);
  if (reperes) {
    reperes.activer(e.active);
    reperes.progression(Math.min(1, window.scrollY / finPage));
  }
  return e;
}

mesurerAncres();
suivreDefilement();
window.addEventListener('scroll', suivreDefilement, { passive: true });
window.addEventListener('resize', () => { mesurerAncres(); suivreDefilement(); });
new ResizeObserver(() => { mesurerAncres(); suivreDefilement(); }).observe(document.body);
if (document.fonts) document.fonts.ready.then(() => { mesurerAncres(); suivreDefilement(); });


/* --------------------------------------------------------------------------
   3. L'espace 3D
   -------------------------------------------------------------------------- */
if (webglDisponible()) {
  demarrer().catch(() => {
    // Échec (réseau, pilote graphique…) : la page reste un site classique, sans bruit
    racineHtml.classList.remove('espace-actif');
  });
}

async function demarrer() {
  const THREE = await import(URL_THREE);

  /* ---------- Réglages (allégés sur petit écran) ---------- */
  const NB_ETAPES = Math.max(2, etapes.length);
  const PAS = 760;                                   // distance entre deux étapes
  const NB_NOEUDS = Math.round((petitEcran ? 26 : 48) * NB_ETAPES + (petitEcran ? 60 : 110));
  const VOISINS = 3;
  const DISTANCE_MAX = 320;
  const NB_PAQUETS = petitEcran ? 18 : 46;
  const RAYON_LUMIERE = petitEcran ? 150 : 240;

  const violet = new THREE.Color('#7c3aed');
  const lavande = new THREE.Color('#d9ccfb');
  const fond = new THREE.Color('#fafaf9');

  /* ---------- Couche fixe derrière le contenu ---------- */
  const couche = document.createElement('div');
  couche.className = 'espace';
  couche.setAttribute('aria-hidden', 'true');
  document.body.prepend(couche);

  const rendu = new THREE.WebGLRenderer({ antialias: !petitEcran, alpha: true, powerPreference: 'low-power' });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, petitEcran ? 1.15 : 1.4));
  rendu.setClearColor(0x000000, 0);
  couche.appendChild(rendu.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(fond, 380, 1900);
  const camera = new THREE.PerspectiveCamera(58, 1, 1, 3200);

  /* ---------- Le chemin : une courbe qui serpente vers l'avant (-Z) ---------- */
  const controle = [];
  for (let i = -1; i <= NB_ETAPES; i++) {
    controle.push(new THREE.Vector3(Math.sin(i * 1.3) * 240, Math.cos(i * 0.9) * 120 + Math.sin(i * 2.1) * 40, -i * PAS));
  }
  const chemin = new THREE.CatmullRomCurve3(controle, false, 'centripetal');
  const du = 1 / (controle.length - 1);
  const uEtape = (i) => (i + 1) * du;               // waypoint i = point de contrôle i + 1
  const uCamera = (position) => uEtape(position) - 0.42 * du;   // la caméra s'arrête un peu avant

  /* ---------- Les nœuds, répartis dans un tube autour du chemin ---------- */
  const noeuds = [];
  const tailles = [];
  const aleatoire = (() => { let g = 7; return () => { g = (g * 16807) % 2147483647; return (g - 1) / 2147483646; }; })();
  const tmp = new THREE.Vector3(), axe = new THREE.Vector3();
  for (let i = 0; i < NB_NOEUDS; i++) {
    // Un nuage plus dense au départ (le réseau de l'accueil), puis tout le long du parcours
    const u = i < NB_NOEUDS * 0.16 ? aleatoire() * du * 1.4 : aleatoire();
    chemin.getPoint(u, tmp);
    const angle = aleatoire() * Math.PI * 2;
    const rayon = 120 + Math.pow(aleatoire(), 0.7) * (petitEcran ? 520 : 720);
    axe.set(Math.cos(angle) * rayon * 1.5, Math.sin(angle) * rayon * 0.8, (aleatoire() - 0.5) * 260);
    noeuds.push(tmp.clone().add(axe));
    tailles.push(aleatoire() < 0.12 ? 15 + aleatoire() * 6 : 6 + aleatoire() * 5);
  }
  // Les waypoints : un gros point violet par étape, sur le côté du chemin
  const waypoints = etapes.map((_, i) => {
    const p = chemin.getPoint(uEtape(i));
    const tangente = chemin.getTangent(uEtape(i));
    const cote = new THREE.Vector3().crossVectors(tangente, new THREE.Vector3(0, 1, 0)).normalize();
    return p.add(cote.multiplyScalar(i % 2 ? 150 : -150)).add(new THREE.Vector3(0, -30, 0));
  });
  const debutWaypoints = noeuds.length;
  waypoints.forEach((w) => { noeuds.push(w); tailles.push(34); });

  /* ---------- Les liaisons : 3 plus proches voisins (grille spatiale) ---------- */
  const cellule = DISTANCE_MAX;
  const grille = new Map();
  const cle = (x, y, z) => x + ',' + y + ',' + z;
  noeuds.forEach((n, i) => {
    const k = cle(Math.floor(n.x / cellule), Math.floor(n.y / cellule), Math.floor(n.z / cellule));
    if (!grille.has(k)) grille.set(k, []);
    grille.get(k).push(i);
  });
  const liaisons = [];
  const voisinsDe = noeuds.map(() => []);
  const dejaVu = new Set();
  noeuds.forEach((n, i) => {
    const cx = Math.floor(n.x / cellule), cy = Math.floor(n.y / cellule), cz = Math.floor(n.z / cellule);
    const proches = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      (grille.get(cle(cx + a, cy + b, cz + c)) || []).forEach((j) => {
        if (j === i) return;
        const d = n.distanceTo(noeuds[j]);
        if (d < DISTANCE_MAX) proches.push({ j: j, d: d });
      });
    }
    proches.sort((p, q) => p.d - q.d);
    proches.slice(0, i >= debutWaypoints ? 5 : VOISINS).forEach((p) => {
      const c = Math.min(i, p.j) + '-' + Math.max(i, p.j);
      if (dejaVu.has(c)) return;
      dejaVu.add(c);
      liaisons.push([i, p.j]);
      voisinsDe[i].push(p.j);
      voisinsDe[p.j].push(i);
    });
  });
  voisinsDe.forEach((v, i) => { if (!v.length) v.push(i); });

  /* ---------- Points (shader : disque doux + halo, fondu dans la brume) ---------- */
  const materiauPoints = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uRatio: { value: rendu.getPixelRatio() },
      uCouleurA: { value: new THREE.Color('#a78bfa') },
      uCouleurB: { value: violet }
    },
    vertexShader: `
      attribute float aTaille;
      attribute float aEclat;
      uniform float uRatio;
      varying float vEclat;
      varying float vVisible;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        vEclat = aEclat;
        vVisible = smoothstep(18.0, 90.0, d) * (1.0 - smoothstep(1100.0, 1850.0, d));
        gl_PointSize = min(90.0, aTaille * (1.0 + aEclat * 1.6) * uRatio * (430.0 / max(d, 1.0)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uCouleurA;
      uniform vec3 uCouleurB;
      varying float vEclat;
      varying float vVisible;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float coeur = 1.0 - smoothstep(0.18, 0.24, d);
        float halo = (1.0 - smoothstep(0.24, 0.5, d)) * 0.35 * (0.3 + vEclat);
        vec3 couleur = mix(uCouleurA, uCouleurB, clamp(0.35 + vEclat, 0.0, 1.0));
        float alpha = max(coeur, halo) * (0.55 + 0.45 * min(vEclat, 1.0)) * vVisible;
        gl_FragColor = vec4(couleur, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const positions = new Float32Array(noeuds.length * 3);
  noeuds.forEach((n, i) => positions.set([n.x, n.y, n.z], i * 3));
  const eclats = new Float32Array(noeuds.length);
  const geoPoints = new THREE.BufferGeometry();
  geoPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geoPoints.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(tailles), 1));
  geoPoints.setAttribute('aEclat', new THREE.BufferAttribute(eclats, 1));
  scene.add(new THREE.Points(geoPoints, materiauPoints));

  /* ---------- Câbles (couleur selon l'éclat de leurs extrémités) ---------- */
  const posLignes = new Float32Array(liaisons.length * 6);
  const couleursLignes = new Float32Array(liaisons.length * 6);
  liaisons.forEach((l, k) => {
    posLignes.set([noeuds[l[0]].x, noeuds[l[0]].y, noeuds[l[0]].z, noeuds[l[1]].x, noeuds[l[1]].y, noeuds[l[1]].z], k * 6);
  });
  const geoLignes = new THREE.BufferGeometry();
  geoLignes.setAttribute('position', new THREE.BufferAttribute(posLignes, 3));
  geoLignes.setAttribute('color', new THREE.BufferAttribute(couleursLignes, 3));
  scene.add(new THREE.LineSegments(geoLignes, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, fog: true })));

  /* ---------- Anneau qui s'étend autour du waypoint atteint ---------- */
  const anneau = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 64),
    new THREE.MeshBasicMaterial({ color: violet, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false })
  );
  scene.add(anneau);
  let anneauT = 1;

  /* ---------- Paquets de données ---------- */
  const paquets = [];
  const posPaquets = new Float32Array(NB_PAQUETS * 3);
  for (let p = 0; p < NB_PAQUETS; p++) {
    const l = liaisons[Math.floor(aleatoire() * liaisons.length)];
    paquets.push({ de: l[0], vers: l[1], t: aleatoire(), vitesse: 0.004 + aleatoire() * 0.008 });
  }
  const geoPaquets = new THREE.BufferGeometry();
  geoPaquets.setAttribute('position', new THREE.BufferAttribute(posPaquets, 3));
  geoPaquets.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(NB_PAQUETS).fill(7), 1));
  geoPaquets.setAttribute('aEclat', new THREE.BufferAttribute(new Float32Array(NB_PAQUETS).fill(1), 1));
  scene.add(new THREE.Points(geoPaquets, materiauPoints));

  /* ---------- Panneaux 3D : chaque panneau de section devient une dalle de verre posée
     dans l'espace (face avant calée sous le texte, tranche violette visible en perspective),
     reliée par un câble lumineux à la boule violette de son étape. Le texte reste du HTML. ---------- */
  const PROFONDEUR = 360;                   // distance des dalles devant la caméra
  const EPAISSEUR = 40;                     // épaisseur des dalles
  const FUITE = 0.35;                        // la tranche fuit vers la boule violette de l'étape
  function formeArrondie(l, h, r) {
    const s = new THREE.Shape(), x = -l / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + l - r, y); s.quadraticCurveTo(x + l, y, x + l, y + r);
    s.lineTo(x + l, y + h - r); s.quadraticCurveTo(x + l, y + h, x + l - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const dalles = [];
  etapes.forEach((etape, i) => {
    const el = etape.classList.contains('panneau') ? etape : etape.querySelector('.panneau');
    if (!el || el.matches('.cv-feuille, .cv-actions')) return;
    const sombre = !!el.closest('.chiffres');
    const groupe = new THREE.Group();
    const faces = new THREE.MeshBasicMaterial({ color: sombre ? 0x15131d : 0xffffff, transparent: true, opacity: sombre ? 0.93 : 0.84, depthWrite: false, fog: false });
    const tranche = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.32, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const maille = new THREE.Mesh(new THREE.BufferGeometry(), [faces, tranche]);
    maille.matrixAutoUpdate = false;                                  // cisaillement posé à chaque image
    const contour = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.55, fog: false }));
    groupe.add(maille, contour);
    groupe.renderOrder = 3;
    scene.add(groupe);
    // Câble : courbe du bord de la dalle jusqu'à la boule violette de l'étape
    const posCable = new Float32Array(33 * 3);
    const geoCable = new THREE.BufferGeometry();
    geoCable.setAttribute('position', new THREE.BufferAttribute(posCable, 3));
    const cable = new THREE.Line(geoCable, new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    cable.frustumCulled = false;
    scene.add(cable);
    dalles.push({ el: el, i: i, groupe: groupe, maille: maille, contour: contour, cable: cable, posCable: posCable, l: 0, h: 0, sombre: sombre });
  });
  // Points lumineux : l'attache du câble sur la dalle et un paquet qui circule vers la boule
  const posAttaches = new Float32Array(Math.max(1, dalles.length) * 2 * 3);
  const eclatsAttaches = new Float32Array(Math.max(1, dalles.length) * 2);
  const geoAttaches = new THREE.BufferGeometry();
  geoAttaches.setAttribute('position', new THREE.BufferAttribute(posAttaches, 3));
  geoAttaches.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(Math.max(1, dalles.length) * 2).fill(12), 1));
  geoAttaches.setAttribute('aEclat', new THREE.BufferAttribute(eclatsAttaches, 1));
  const attaches = new THREE.Points(geoAttaches, materiauPoints);
  attaches.frustumCulled = false;
  if (dalles.length) {
    scene.add(attaches);
    racineHtml.classList.add('panneaux-3d');
  }

  const vue = new THREE.Vector3(), bout = new THREE.Vector3(), milieu = new THREE.Vector3(), projeteBoule = new THREE.Vector3();
  const courbeCable = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  function placerDalles(temps, active) {
    if (!dalles.length) return;
    camera.updateMatrixWorld();
    const tanDemi = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const parPixel = 2 * PROFONDEUR * tanDemi / hauteur;          // unités par pixel à cette profondeur
    dalles.forEach((d, k) => {
      const z = d.el.getBoundingClientRect();
      const visible = z.width > 0 && z.bottom > -80 && z.top < hauteur + 80;
      d.groupe.visible = visible;
      d.cable.visible = visible;
      if (!visible) { eclatsAttaches[k * 2] = 0; eclatsAttaches[k * 2 + 1] = 0; return; }
      // Taille : on reconstruit la dalle seulement si le panneau a changé de taille
      const l = z.width * parPixel, h = z.height * parPixel;
      if (Math.abs(l - d.l) > 0.4 || Math.abs(h - d.h) > 0.4) {
        d.l = l; d.h = h;
        const r = Math.min(32 * parPixel, l / 4, h / 4);
        const forme = formeArrondie(l, h, r);
        d.maille.geometry.dispose();
        d.maille.geometry = new THREE.ExtrudeGeometry(forme, { depth: EPAISSEUR, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -EPAISSEUR);
        d.contour.geometry.dispose();
        d.contour.geometry = new THREE.BufferGeometry().setFromPoints(forme.getPoints(6).map((p) => new THREE.Vector3(p.x, p.y, 0.5)));
      }
      // Position : la face avant se projette exactement sous le panneau HTML
      const cx = (z.left + z.width / 2) / largeur * 2 - 1, cy = 1 - (z.top + z.height / 2) / hauteur * 2;
      vue.set(cx * PROFONDEUR * tanDemi * camera.aspect, cy * PROFONDEUR * tanDemi, -PROFONDEUR).applyMatrix4(camera.matrixWorld);
      d.groupe.position.copy(vue);
      d.groupe.quaternion.copy(camera.quaternion);
      // Le panneau s'estompe en arrivant et en partant : la dalle aussi
      const fondu = 1 - Math.min(1, Math.abs(d.el.approche || 0)) * 0.5;
      const estActive = d.i === active;
      d.maille.material[0].opacity = (d.sombre ? 0.93 : 0.84) * fondu;
      d.maille.material[1].opacity = (estActive ? 0.3 : 0.18) * fondu;
      d.contour.material.opacity = (estActive ? 0.85 : 0.45) * fondu;
      d.cable.material.opacity = (estActive ? 0.75 : 0.32) * fondu;
      // Attache du câble : sur le bord de la dalle tourné vers la boule
      const boule = waypoints[d.i];
      projeteBoule.copy(boule).project(camera);
      const versDroite = projeteBoule.z > 1 ? cx < 0 : projeteBoule.x > cx;
      // Profondeur visible : la face arrière glisse vers la boule (la face avant ne bouge pas)
      let fx = projeteBoule.z > 1 ? (cx < 0 ? 1 : -1) : projeteBoule.x - cx;
      let fy = projeteBoule.z > 1 ? 0.3 : projeteBoule.y - cy;
      const n = Math.hypot(fx, fy) || 1;
      fx /= n; fy /= n;
      d.maille.matrix.set(1, 0, -fx * FUITE, 0, 0, 1, -fy * FUITE, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      bout.set((versDroite ? 1 : -1) * l / 2, h * 0.18, 0).applyQuaternion(camera.quaternion).add(vue);
      milieu.copy(bout).lerp(boule, 0.5).addScaledVector(new THREE.Vector3(0, 1, 0), 60);
      courbeCable.v0.copy(bout); courbeCable.v1.copy(milieu); courbeCable.v2.copy(boule);
      for (let s = 0; s <= 32; s++) {
        courbeCable.getPoint(s / 32, milieu);
        d.posCable.set([milieu.x, milieu.y, milieu.z], s * 3);
      }
      d.cable.geometry.attributes.position.needsUpdate = true;
      posAttaches.set([bout.x, bout.y, bout.z], k * 6);
      courbeCable.getPoint(((temps || 0) * 0.00018 + k * 0.23) % 1, milieu);
      posAttaches.set([milieu.x, milieu.y, milieu.z], k * 6 + 3);
      eclatsAttaches[k * 2] = (estActive ? 1 : 0.5) * fondu;
      eclatsAttaches[k * 2 + 1] = (mouvementReduit ? 0 : (estActive ? 1.2 : 0.6)) * fondu;
    });
    geoAttaches.attributes.position.needsUpdate = true;
    geoAttaches.attributes.aEclat.needsUpdate = true;
  }

  /* ---------- Taille ---------- */
  let largeur = 1, hauteur = 1;
  function redimensionner() {
    largeur = window.innerWidth;
    hauteur = window.innerHeight;
    rendu.setSize(largeur, hauteur, false);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    demander();
  }
  window.addEventListener('resize', redimensionner);

  /* ---------- Souris (ou point lumineux virtuel sur écran tactile) ---------- */
  let sourisX = 0, sourisY = 0, sourisActive = false;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    sourisActive = true;
    sourisX = (e.clientX / window.innerWidth) * 2 - 1;
    sourisY = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  /* ---------- Une image ---------- */
  const projete = new THREE.Vector3(), regard = new THREE.Vector3(), cible = new THREE.Vector3();
  let position = etatDefilement(window.scrollY).position;
  let derniereCible = position, vitesse = 0, actifPrecedent = -1;

  function dessiner(temps, dt) {
    const etat = mouvementReduit ? { position: 0, active: 0 } : etatDefilement(window.scrollY);
    // La caméra rattrape doucement sa cible (inertie) et mesure sa vitesse (effet de vitesse)
    position += (etat.position - position) * (mouvementReduit ? 1 : Math.min(1, dt * 4.5));
    vitesse += ((etat.position - derniereCible) / Math.max(dt, 0.001) - vitesse) * 0.1;
    derniereCible = etat.position;

    if (!sourisActive) {
      sourisX = Math.sin(temps * 0.00035) * 0.6;
      sourisY = Math.cos(temps * 0.00027) * 0.4;
    }

    const u = Math.min(1, Math.max(0, uCamera(position)));
    chemin.getPoint(u, camera.position);
    camera.position.x += sourisX * 26;
    camera.position.y += sourisY * 16;
    // Regard : vers l'avant du chemin, attiré par le waypoint le plus proche
    chemin.getPoint(Math.min(1, u + 0.35 * du), regard);
    const proche = Math.round(position);
    const attirance = Math.max(0, 1 - Math.abs(position - proche) * 2.2) * 0.45;
    cible.copy(regard).lerp(waypoints[proche] || regard, attirance);
    camera.up.set(Math.sin(u * 9) * 0.07, 1, 0).normalize();
    camera.lookAt(cible);
    const fovCible = 58 + Math.min(16, Math.abs(vitesse) * 9);
    if (Math.abs(camera.fov - fovCible) > 0.05) {
      camera.fov += (fovCible - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
    }

    // Étape atteinte : son waypoint s'illumine et lâche une onde
    if (etat.active !== actifPrecedent) {
      actifPrecedent = etat.active;
      if (waypoints[etat.active] && !mouvementReduit) { anneau.position.copy(waypoints[etat.active]); anneauT = 0; }
    }
    if (anneauT < 1) {
      anneauT = Math.min(1, anneauT + dt * 0.8);
      anneau.scale.setScalar(20 + anneauT * 160);
      anneau.material.opacity = (1 - anneauT) * 0.55;
      anneau.lookAt(camera.position);
    } else anneau.material.opacity = 0;

    // Éclat des nœuds près de la souris (et des waypoints : celui de l'étape active pulse)
    const pxX = (sourisX + 1) / 2 * largeur, pxY = (1 - sourisY) / 2 * hauteur;
    for (let i = 0; i < noeuds.length; i++) {
      let cibleEclat;
      if (i >= debutWaypoints) {
        const k = i - debutWaypoints;
        cibleEclat = k === etat.active ? 0.9 + Math.sin(temps * 0.004) * 0.25 : 0.35;
      } else {
        projete.copy(noeuds[i]).project(camera);
        if (projete.z > 1) { eclats[i] *= 0.9; continue; }
        const d = Math.hypot((projete.x + 1) / 2 * largeur - pxX, (1 - projete.y) / 2 * hauteur - pxY);
        const c = Math.max(0, 1 - d / RAYON_LUMIERE);
        cibleEclat = c * c * (3 - 2 * c);
      }
      eclats[i] += (cibleEclat - eclats[i]) * 0.12;
    }
    geoPoints.attributes.aEclat.needsUpdate = true;
    liaisons.forEach((l, k) => {
      for (let bout = 0; bout < 2; bout++) {
        const e = Math.min(1, eclats[l[bout]]);
        couleursLignes[k * 6 + bout * 3] = lavande.r + (violet.r - lavande.r) * e;
        couleursLignes[k * 6 + bout * 3 + 1] = lavande.g + (violet.g - lavande.g) * e;
        couleursLignes[k * 6 + bout * 3 + 2] = lavande.b + (violet.b - lavande.b) * e;
      }
    });
    geoLignes.attributes.color.needsUpdate = true;

    paquets.forEach((p, k) => {
      if (!mouvementReduit) {
        p.t += p.vitesse;
        if (p.t >= 1) {
          const suivants = voisinsDe[p.vers];
          p.de = p.vers;
          p.vers = suivants[Math.floor(Math.random() * suivants.length)];
          p.t = 0;
        }
      }
      const a = noeuds[p.de], b = noeuds[p.vers];
      posPaquets.set([a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t, a.z + (b.z - a.z) * p.t], k * 3);
    });
    geoPaquets.attributes.position.needsUpdate = true;

    placerDalles(temps, etat.active);
    rendu.render(scene, camera);
  }

  /* ---------- Boucle : en pause si l'onglet est caché ou si une scène plein écran
     (visite de la E39) recouvre l'espace ---------- */
  // Performance : à l'arrêt (aucun défilement depuis un instant), 30 images par seconde suffisent
  let enCours = false, dernier = performance.now(), dernierDefilement = 0;
  window.addEventListener('scroll', () => { dernierDefilement = performance.now(); }, { passive: true });
  function image(temps) {
    enCours = false;
    if (!mouvementReduit && temps - dernierDefilement > 900 && temps - dernier < 30) { demander(); return; }
    const dt = Math.min(0.05, (temps - dernier) / 1000);
    dernier = temps;
    if (document.hidden) return;
    // Une scène plein écran (visite de la E39, ouverture du capot) recouvre l'espace : rien à dessiner
    const recouvert = racineHtml.classList.contains('visite-active') || racineHtml.classList.contains('capot-actif');
    if (!recouvert) dessiner(temps, dt);
    if (!mouvementReduit) demander();
  }
  function demander() {
    if (!enCours) { enCours = true; requestAnimationFrame(image); }
  }
  document.addEventListener('visibilitychange', () => { dernier = performance.now(); demander(); });
  if (mouvementReduit) window.addEventListener('scroll', demander, { passive: true });

  redimensionner();
  racineHtml.classList.add('espace-actif');
  requestAnimationFrame(() => couche.classList.add('est-pret'));
}
