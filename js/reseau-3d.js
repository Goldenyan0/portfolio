/* ==========================================================================
   reseau-3d.js — fond 3D du hero : un réseau informatique interactif
   - Des nœuds (machines) reliés à leurs voisins les plus proches (câbles)
   - Des paquets de données qui circulent de nœud en nœud
   - Les nœuds proches de la souris s'illuminent ; le réseau pivote vers elle
   Bibliothèque : Three.js (chargé à la demande depuis jsDelivr).
   Repli : si WebGL est indisponible ou si Three.js ne charge pas,
   le SVG statique déjà présent dans le HTML reste affiché.
   Mouvement réduit : une seule image fixe, sans animation.
   ========================================================================== */

const URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const conteneur = document.getElementById('hero-fond');
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Vérifie que le navigateur sait faire du WebGL
function webglDisponible() {
  try {
    const essai = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (essai.getContext('webgl2') || essai.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

if (conteneur && webglDisponible()) {
  demarrer().catch(function () {
    // Échec (réseau, pilote graphique…) : on garde le repli SVG, sans bruit dans la console
    document.documentElement.classList.remove('webgl-actif');
  });
}

async function demarrer() {
  const THREE = await import(URL_THREE);

  /* ---------- Réglages ---------- */
  const petitEcran = window.innerWidth < 720;
  const NB_NOEUDS = petitEcran ? 70 : 150;
  const VOISINS = 3;                // chaque nœud est relié à ses 3 plus proches voisins
  const DISTANCE_MAX = petitEcran ? 260 : 230;
  const NB_PAQUETS = petitEcran ? 14 : 28;
  const RAYON_LUMIERE = petitEcran ? 140 : 240; // en pixels autour de la souris

  const violet = new THREE.Color('#7c3aed');
  const lavande = new THREE.Color('#d9ccfb');

  /* ---------- Moteur de rendu, scène, caméra ---------- */
  const rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  rendu.setClearColor(0x000000, 0); // fond transparent : le dégradé CSS reste visible
  conteneur.appendChild(rendu.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 3000);
  camera.position.z = 650;

  const groupe = new THREE.Group();
  scene.add(groupe);

  /* ---------- Les nœuds ---------- */
  // Répartis dans un volume aplati, plus large que haut
  const positions = new Float32Array(NB_NOEUDS * 3);
  const tailles = new Float32Array(NB_NOEUDS);
  const eclats = new Float32Array(NB_NOEUDS); // 0 = éteint, 1 = illuminé par la souris
  const noeuds = [];
  for (let i = 0; i < NB_NOEUDS; i++) {
    const x = (Math.random() - 0.5) * (petitEcran ? 900 : 1500);
    const y = (Math.random() - 0.5) * 900;
    const z = (Math.random() - 0.5) * 600;
    positions.set([x, y, z], i * 3);
    // Quelques gros nœuds "serveurs", beaucoup de petits
    tailles[i] = Math.random() < 0.12 ? 15 + Math.random() * 6 : 6 + Math.random() * 5;
    noeuds.push(new THREE.Vector3(x, y, z));
  }

  /* ---------- Les liaisons (graphe des plus proches voisins) ---------- */
  const liaisons = [];             // paires [a, b]
  const voisinsDe = noeuds.map(function () { return []; });
  const dejaVu = new Set();
  for (let i = 0; i < NB_NOEUDS; i++) {
    const proches = [];
    for (let j = 0; j < NB_NOEUDS; j++) {
      if (i === j) continue;
      const d = noeuds[i].distanceTo(noeuds[j]);
      if (d < DISTANCE_MAX) proches.push({ j: j, d: d });
    }
    proches.sort(function (a, b) { return a.d - b.d; });
    proches.slice(0, VOISINS).forEach(function (p) {
      const cle = Math.min(i, p.j) + '-' + Math.max(i, p.j);
      if (dejaVu.has(cle)) return;
      dejaVu.add(cle);
      liaisons.push([i, p.j]);
      voisinsDe[i].push(p.j);
      voisinsDe[p.j].push(i);
    });
  }

  /* ---------- Matériau des points (shader : disque doux + halo) ---------- */
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
      varying float vProfondeur;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vEclat = aEclat;
        vProfondeur = smoothstep(-1100.0, -300.0, mv.z); // 0 = loin, 1 = proche
        gl_PointSize = aTaille * (1.0 + aEclat * 2.2) * uRatio * (520.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uCouleurA;
      uniform vec3 uCouleurB;
      varying float vEclat;
      varying float vProfondeur;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float coeur = 1.0 - smoothstep(0.18, 0.24, d);                  // disque plein
        float halo = (1.0 - smoothstep(0.24, 0.5, d)) * 0.35 * (0.3 + vEclat); // halo doux
        vec3 couleur = mix(uCouleurA, uCouleurB, clamp(0.25 + vEclat + vProfondeur * 0.3, 0.0, 1.0));
        float alpha = max(coeur, halo) * (0.35 + 0.65 * vProfondeur + 0.4 * vEclat);
        gl_FragColor = vec4(couleur, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const geoPoints = new THREE.BufferGeometry();
  geoPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geoPoints.setAttribute('aTaille', new THREE.BufferAttribute(tailles, 1));
  geoPoints.setAttribute('aEclat', new THREE.BufferAttribute(eclats, 1));
  groupe.add(new THREE.Points(geoPoints, materiauPoints));

  /* ---------- Les câbles (segments colorés selon l'éclat de leurs extrémités) ---------- */
  const posLignes = new Float32Array(liaisons.length * 6);
  const couleursLignes = new Float32Array(liaisons.length * 6);
  liaisons.forEach(function (l, k) {
    posLignes.set([noeuds[l[0]].x, noeuds[l[0]].y, noeuds[l[0]].z, noeuds[l[1]].x, noeuds[l[1]].y, noeuds[l[1]].z], k * 6);
  });
  const geoLignes = new THREE.BufferGeometry();
  geoLignes.setAttribute('position', new THREE.BufferAttribute(posLignes, 3));
  geoLignes.setAttribute('color', new THREE.BufferAttribute(couleursLignes, 3));
  const lignes = new THREE.LineSegments(geoLignes, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false
  }));
  groupe.add(lignes);

  /* ---------- Les paquets de données qui parcourent le réseau ---------- */
  const paquets = [];
  const posPaquets = new Float32Array(NB_PAQUETS * 3);
  const taillesPaquets = new Float32Array(NB_PAQUETS).fill(7);
  const eclatsPaquets = new Float32Array(NB_PAQUETS).fill(1);
  for (let p = 0; p < NB_PAQUETS; p++) {
    const l = liaisons[Math.floor(Math.random() * liaisons.length)];
    paquets.push({ de: l[0], vers: l[1], t: Math.random(), vitesse: 0.004 + Math.random() * 0.008 });
  }
  const geoPaquets = new THREE.BufferGeometry();
  geoPaquets.setAttribute('position', new THREE.BufferAttribute(posPaquets, 3));
  geoPaquets.setAttribute('aTaille', new THREE.BufferAttribute(taillesPaquets, 1));
  geoPaquets.setAttribute('aEclat', new THREE.BufferAttribute(eclatsPaquets, 1));
  groupe.add(new THREE.Points(geoPaquets, materiauPoints));

  /* ---------- Taille du canvas ---------- */
  let largeur = 1, hauteur = 1;
  function redimensionner() {
    largeur = conteneur.clientWidth || 1;
    hauteur = conteneur.clientHeight || 1;
    rendu.setSize(largeur, hauteur, false);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    if (mouvementReduit) dessiner(0);
  }
  new ResizeObserver(redimensionner).observe(conteneur);

  /* ---------- Souris (ou curseur virtuel sur écran tactile) ---------- */
  let sourisX = 0, sourisY = 0;   // de -1 à 1
  let sourisActive = false;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    sourisActive = true;
    sourisX = (e.clientX / window.innerWidth) * 2 - 1;
    sourisY = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  /* ---------- Une image ---------- */
  const projete = new THREE.Vector3();
  let rotationX = 0, rotationY = 0;

  function dessiner(temps) {
    // Sans souris (mobile), un point lumineux virtuel se promène lentement
    if (!sourisActive) {
      sourisX = Math.sin(temps * 0.00035) * 0.6;
      sourisY = Math.cos(temps * 0.00027) * 0.4;
    }

    // Scrollytelling : en descendant dans le hero, la caméra plonge dans le réseau
    // (progression fournie par index.js, de 0 à 1)
    const plongee = (window.Site && window.Site.progressionHero) || 0;
    camera.position.z = 650 - plongee * 440;

    // Le réseau pivote doucement vers la souris + une lente dérive continue
    rotationY += ((sourisX * 0.3 + temps * 0.00004 + plongee * 0.9) - rotationY) * 0.05;
    rotationX += ((-sourisY * 0.18) - rotationX) * 0.05;
    groupe.rotation.set(rotationX, rotationY, plongee * 0.25);
    groupe.updateMatrixWorld();

    // Éclat de chaque nœud selon sa distance (à l'écran) à la souris
    const pxSourisX = (sourisX + 1) / 2 * largeur;
    const pxSourisY = (1 - sourisY) / 2 * hauteur;
    for (let i = 0; i < NB_NOEUDS; i++) {
      projete.copy(noeuds[i]).applyMatrix4(groupe.matrixWorld).project(camera);
      const px = (projete.x + 1) / 2 * largeur;
      const py = (1 - projete.y) / 2 * hauteur;
      const d = Math.hypot(px - pxSourisX, py - pxSourisY);
      const cible = Math.max(0, 1 - d / RAYON_LUMIERE);
      const adouci = cible * cible * (3 - 2 * cible); // courbe en S : bord doux, centre franc
      eclats[i] += (adouci - eclats[i]) * 0.12;
    }
    geoPoints.attributes.aEclat.needsUpdate = true;

    // Couleur des câbles : lavande au repos, violet près de la souris
    liaisons.forEach(function (l, k) {
      for (let bout = 0; bout < 2; bout++) {
        const e = eclats[l[bout]];
        couleursLignes[k * 6 + bout * 3] = lavande.r + (violet.r - lavande.r) * e;
        couleursLignes[k * 6 + bout * 3 + 1] = lavande.g + (violet.g - lavande.g) * e;
        couleursLignes[k * 6 + bout * 3 + 2] = lavande.b + (violet.b - lavande.b) * e;
      }
    });
    geoLignes.attributes.color.needsUpdate = true;

    // Avancée des paquets ; arrivé au bout, un paquet repart vers un voisin au hasard
    paquets.forEach(function (p, k) {
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
      posPaquets[k * 3] = a.x + (b.x - a.x) * p.t;
      posPaquets[k * 3 + 1] = a.y + (b.y - a.y) * p.t;
      posPaquets[k * 3 + 2] = a.z + (b.z - a.z) * p.t;
    });
    geoPaquets.attributes.position.needsUpdate = true;

    rendu.render(scene, camera);
  }

  /* ---------- Boucle d'animation, en pause hors écran ---------- */
  let visible = true;
  let boucleLancee = false;

  function boucle(temps) {
    if (!visible || document.hidden) {
      boucleLancee = false;
      return;
    }
    dessiner(temps);
    requestAnimationFrame(boucle);
  }
  function relancer() {
    if (!boucleLancee && visible && !document.hidden) {
      boucleLancee = true;
      requestAnimationFrame(boucle);
    }
  }

  redimensionner();

  if (mouvementReduit) {
    // Une seule image fixe
    dessiner(0);
  } else {
    new IntersectionObserver(function (entrees) {
      visible = entrees[0].isIntersecting;
      relancer();
    }).observe(conteneur);
    document.addEventListener('visibilitychange', relancer);
    relancer();
  }

  document.documentElement.classList.add('webgl-actif');
}
