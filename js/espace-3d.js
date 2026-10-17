/* ==========================================================================
   espace-3d.js — l'environnement 3D commun aux 3 pages
   - Un réseau de nœuds (« étoiles d'araignée ») où circulent des paquets de données ;
     les nœuds proches de la souris s'illuminent (calcul fait dans les shaders)
   - Voyage (accueil et page voiture, classe .voyage posée dans le <head>) : chaque section
     [data-etape] devient une carte posée dans l'espace — ou chacun de ses [data-carte].
     Les cartes sont de vrais objets 3D (transformations CSS 3D, même caméra que le réseau) :
     le texte reste du HTML net, lisible et accessible au clavier. Le défilement fait voyager
     la caméra : elle lit chaque carte de face à l'échelle 1, descend le long des cartes hautes,
     puis recule et s'envole vers la suivante (courbe de Bézier) ; elle est amortie à chaque image.
   - CV : la caméra avance le long d'un chemin au fil du défilement (pas de cartes)
   - Sommaire latéral persistant (étapes [data-etape], cliquables), jauge de progression,
     annonce de l'étape atteinte
   Expose window.Site.allerA(element) : défile jusqu'à la carte qui contient l'élément.
   Bibliothèque : Three.js (même URL que l'importmap de e39.html : un seul chargement).
   Repli : sans WebGL, la page reste un site classique.
   Mouvement réduit : pas de voyage (page classique), une image fixe du réseau.
   ========================================================================== */

const URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const racineHtml = document.documentElement;
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const petitEcran = window.innerWidth < 720;
const etapes = Array.from(document.querySelectorAll('[data-etape]'));
const avecVoyage = racineHtml.classList.contains('voyage');

// Vérifie que le navigateur sait faire du WebGL
function webglDisponible() {
  try {
    const essai = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (essai.getContext('webgl2') || essai.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

// Défile jusqu'à un élément : par la carte du voyage s'il est actif, sinon dans la page
function allerA(el) {
  if (window.Site && window.Site.allerA) return window.Site.allerA(el);
  el.scrollIntoView({ behavior: mouvementReduit ? 'auto' : 'smooth' });
}


/* --------------------------------------------------------------------------
   1. Sommaire latéral (toujours affiché sur grand écran, repliable ailleurs),
      jauge de progression et annonce de l'étape atteinte
   -------------------------------------------------------------------------- */
const sommaire = (function creerSommaire() {
  if (etapes.length < 2) return null;
  const nav = document.createElement('nav');
  nav.className = 'sommaire';
  nav.setAttribute('aria-label', 'Sommaire');
  const bascule = document.createElement('button');
  bascule.type = 'button';
  bascule.className = 'sommaire__bascule';
  bascule.setAttribute('aria-expanded', 'false');
  bascule.setAttribute('aria-controls', 'sommaire-liste');
  bascule.innerHTML = '<span class="sommaire__icone" aria-hidden="true"><span></span></span><span class="sommaire__libelle">Sommaire</span>';
  const liste = document.createElement('ol');
  liste.id = 'sommaire-liste';
  liste.className = 'sommaire__liste';
  const boutons = etapes.map((etape, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sommaire__lien';
    b.innerHTML = '<span class="sommaire__numero" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span><span class="sommaire__nom"></span>';
    b.querySelector('.sommaire__nom').textContent = etape.dataset.etape;
    b.addEventListener('click', () => {
      ouvrir(false);
      allerA(etape);
    });
    li.appendChild(b);
    liste.appendChild(li);
    return b;
  });
  nav.append(bascule, liste);
  document.body.appendChild(nav);

  function ouvrir(etat) {
    nav.classList.toggle('est-ouvert', etat);
    bascule.setAttribute('aria-expanded', String(etat));
  }
  bascule.addEventListener('click', () => ouvrir(!nav.classList.contains('est-ouvert')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('est-ouvert')) { ouvrir(false); bascule.focus(); } });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) ouvrir(false); });

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
   2. Défilement classique (CV, ou voyage indisponible) : étape atteinte et
      position de la caméra sur son chemin
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

let voyage = null;      // posé par demarrer() quand les cartes sont en place
function suivreDefilement() {
  if (voyage || !sommaire) return;
  const e = etatDefilement(window.scrollY);
  sommaire.activer(e.active);
  sommaire.progression(Math.min(1, window.scrollY / finPage));
}
function remesurer() {
  if (voyage) return;
  mesurerAncres();
  suivreDefilement();
}
remesurer();
window.addEventListener('scroll', suivreDefilement, { passive: true });
window.addEventListener('resize', remesurer);
new ResizeObserver(remesurer).observe(document.body);
if (document.fonts) document.fonts.ready.then(remesurer);


/* --------------------------------------------------------------------------
   3. Voyage : les cartes dans l'espace et la caméra qui les parcourt
   -------------------------------------------------------------------------- */
const FOV_VOYAGE = 50;
const MARGE = 20;             // marge (px) entre une carte lue et le bord de l'écran

// Matrices CSS : repère Three.js (y vers le haut) → repère CSS (y vers le bas)
const net = (v) => (Math.abs(v) < 1e-10 ? 0 : v);
function matriceCamera(m) {
  const e = m.elements;
  return 'matrix3d(' + [e[0], -e[1], e[2], e[3], e[4], -e[5], e[6], e[7], e[8], -e[9], e[10], e[11], e[12], -e[13], e[14], e[15]].map(net).join(',') + ')';
}
function matriceObjet(m) {
  const e = m.elements;
  return 'matrix3d(' + [e[0], e[1], e[2], e[3], -e[4], -e[5], -e[6], -e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]].map(net).join(',') + ')';
}

function creerVoyage(THREE, camera) {
  const main = document.querySelector('main');
  if (!main) return null;
  // Les cartes : chaque étape, ou ses [data-carte] si elle en contient
  const cartes = [];
  etapes.forEach((etape) => {
    const internes = Array.from(etape.querySelectorAll('[data-carte]'));
    (internes.length ? internes : [etape]).forEach((el) => cartes.push({ el: el, etape: etape, i: cartes.length }));
  });
  if (cartes.length < 2) return null;

  // Structure : <main> devient la scène (perspective), une « caméra » CSS enveloppe son contenu
  // (l'ordre du document ne change pas) ; une piste après la scène donne la longueur du voyage
  const defilement = document.createElement('div');
  defilement.className = 'voyage__defilement';
  main.before(defilement);
  defilement.appendChild(main);
  const cameraCss = document.createElement('div');
  cameraCss.className = 'voyage__camera';
  while (main.firstChild) cameraCss.appendChild(main.firstChild);
  main.appendChild(cameraCss);
  const piste = document.createElement('div');
  piste.className = 'voyage__piste';
  piste.setAttribute('aria-hidden', 'true');
  defilement.appendChild(piste);
  cartes.forEach((c) => {
    c.el.classList.add('carte-3d');
    for (let p = c.el.parentElement; p && p !== cameraCss; p = p.parentElement) p.classList.add('voyage-relais');
  });
  // Décors posés à plat derrière les cartes (la voiture de la visite guidée)
  main.querySelectorAll('[data-voyage-fond]').forEach((el) => main.insertBefore(el, cameraCss));
  racineHtml.classList.add('voyage-pret');

  camera.fov = FOV_VOYAGE;
  const tanDemi = Math.tan(THREE.MathUtils.degToRad(FOV_VOYAGE / 2));
  let l = 1, h = 1, D = 1, nav = 64, gauche = 0, origine = 0, total = 1, pause = 1, transition = 1;
  const segments = [];
  const m4 = new THREE.Matrix4(), un = new THREE.Vector3(1, 1, 1), euler = new THREE.Euler();

  /* ---------- Mise en page : pose de chaque carte, puis segments du défilement ---------- */
  function miseEnPage() {
    const avant = actif >= 0 ? { s: window.scrollY - origine, carte: actif, debut: cartes[actif].debut } : null;
    l = window.innerWidth;
    h = window.innerHeight;
    D = h / 2 / tanDemi;                                   // à cette distance : 1 unité = 1 pixel
    nav = parseFloat(getComputedStyle(racineHtml).getPropertyValue('--hauteur-nav')) || 64;
    gauche = parseFloat(getComputedStyle(racineHtml).getPropertyValue('--sommaire-largeur')) || 0;
    pause = h * 0.4;
    transition = h * (petitEcran ? 0.85 : 1.05);
    main.style.perspective = D + 'px';

    let haut = 0, z = 0, etroites = 0;
    cartes.forEach((c, i) => {
      c.l = c.el.offsetWidth;
      c.h = c.el.offsetHeight;
      const cote = i % 2 ? 1 : -1;
      // Pose : en quinconce de part et d'autre du voyage, tournée vers lui ; chaque carte
      // commence un peu sous la précédente (le voyage descend) et plus loin devant
      euler.set(0.02 * cote, -0.2 * cote, 0);
      c.quat = (c.quat || new THREE.Quaternion()).setFromEuler(euler);
      c.pos = (c.pos || new THREE.Vector3()).set(cote * Math.min(l, 1500) * 0.4 + Math.sin(i * 2.3) * 90, haut - c.h / 2, z);
      c.normale = (c.normale || new THREE.Vector3()).set(0, 0, 1).applyQuaternion(c.quat);
      haut -= c.h + h * 0.3;
      z -= D * 2.3;
      c.matrice = (c.matrice || new THREE.Matrix4()).compose(c.pos, c.quat, un);
      // Lecture : la carte occupe l'espace libre de l'écran (sous la navigation, à droite du
      // sommaire) ; une carte étroite se cale d'un côté (place pour la voiture de la visite)
      const libreL = l - gauche, libreH = h - nav - 2 * MARGE;
      let centreX = gauche + libreL / 2;
      c.cote = 0;                                          // côté de l'écran où la carte est lue
      if (c.l < libreL * 0.6 && l >= 720) {
        c.cote = etroites++ % 2 ? 1 : -1;
        centreX = c.cote > 0 ? l - MARGE - c.l / 2 : gauche + MARGE + c.l / 2;
      }
      c.x = l / 2 - centreX;
      c.course = Math.max(0, c.h - libreH);
      c.yDebut = c.course ? c.h / 2 - (h / 2 - nav - MARGE) : nav / 2;
      c.yFin = c.course ? h / 2 - MARGE - c.h / 2 : nav / 2;
    });

    // Segments : lecture de chaque carte (pause comprise), transition vers la suivante
    segments.length = 0;
    let s = 0;
    cartes.forEach((c, i) => {
      c.debut = s;
      s += c.course + pause;
      c.fin = s;
      segments.push({ lecture: true, c: c, debut: c.debut, fin: c.fin });
      if (i < cartes.length - 1) {
        segments.push({ lecture: false, a: c, b: cartes[i + 1], debut: s, fin: s + transition });
        s += transition;
      }
    });
    total = s;
    piste.style.height = total + 'px';
    poserCartes(Math.max(0, actif));
    origine = defilement.getBoundingClientRect().top + window.scrollY;
    // Après un changement de taille, on reste sur la même carte, au même endroit
    if (avant) {
      const c = cartes[avant.carte];
      const y = origine + c.debut + Math.min(avant.s - avant.debut, c.fin - c.debut);
      if (Math.abs(y - window.scrollY) > 2) defiler(y, true);
    }
    if (window.Site && window.Site.lenis) window.Site.lenis.resize();
    if (voyage) voyage.surMiseEnPage();
    premier = true;
  }

  /* ---------- Repère CSS : centré sur la carte lue ----------
     Pour savoir quel élément est sous le pointeur, le navigateur projette d'abord le pointeur sur
     le plan de la « caméra » CSS ; ce plan doit donc être devant la caméra. Le repère CSS est
     celui de la carte lue (même rendu : seules les matrices sont exprimées autrement). */
  const repere = new THREE.Matrix4(), repereInverse = new THREE.Matrix4(), vueCss = new THREE.Matrix4();
  let carteRepere = -1;
  function poserCartes(i) {
    carteRepere = i;
    repere.copy(cartes[carteRepere].matrice);
    repereInverse.copy(repere).invert();
    cartes.forEach((c) => {
      m4.multiplyMatrices(repereInverse, c.matrice);
      c.el.style.transform = 'translate(-50%,-50%)' + matriceObjet(m4);
    });
    derniereCss = '';
  }

  /* ---------- Pose de la caméra pour un défilement donné ---------- */
  const lissage = (u) => u * u * u * (u * (u * 6 - 15) + 10);
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), c1 = new THREE.Vector3(), c2 = new THREE.Vector3();
  function poseLecture(c, t, p, q) {
    p.set(c.x, c.yDebut + (c.yFin - c.yDebut) * t, D).applyQuaternion(c.quat).add(c.pos);
    if (q) q.copy(c.quat);
  }
  const vise = { p: new THREE.Vector3(), q: new THREE.Quaternion(), actif: 0, continu: 0 };
  function cible(s) {
    s = Math.min(Math.max(s, 0), total);
    let seg = segments[segments.length - 1];
    for (let k = 0; k < segments.length; k++) { if (s <= segments[k].fin) { seg = segments[k]; break; } }
    if (seg.lecture) {
      const c = seg.c;
      const t = c.course ? Math.min(1, Math.max(0, (s - seg.debut - pause / 2) / c.course)) : 0;
      poseLecture(c, t, vise.p, vise.q);
      vise.actif = c.i;
      vise.continu = c.i;
      return;
    }
    // Transition : la caméra recule devant la carte quittée, puis rejoint la suivante
    const k = lissage((s - seg.debut) / (seg.fin - seg.debut)), j = 1 - k;
    poseLecture(seg.a, 1, pA);
    poseLecture(seg.b, 0, pB);
    c1.copy(pA).addScaledVector(seg.a.normale, D * 1.1);
    c2.copy(pB).addScaledVector(seg.b.normale, D * 1.1);
    vise.p.set(0, 0, 0)
      .addScaledVector(pA, j * j * j).addScaledVector(c1, 3 * j * j * k)
      .addScaledVector(c2, 3 * j * k * k).addScaledVector(pB, k * k * k);
    vise.q.copy(seg.a.quat).slerp(seg.b.quat, k);
    vise.actif = k < 0.5 ? seg.a.i : seg.b.i;
    vise.continu = seg.a.i + k;
  }

  /* ---------- À chaque image : la caméra rattrape sa cible, les cartes s'estompent au loin ---------- */
  let actif = -1, premier = true, derniereCss = '';
  function suivre(dt) {
    cible(window.scrollY - origine);
    const k = premier ? 1 : 1 - Math.exp(-dt * 7);
    premier = false;
    camera.position.lerp(vise.p, k);
    camera.quaternion.slerp(vise.q, k);
    const immobile = camera.position.distanceToSquared(vise.p) < 0.004 && 1 - Math.abs(camera.quaternion.dot(vise.q)) < 1e-9;
    if (immobile) { camera.position.copy(vise.p); camera.quaternion.copy(vise.q); }
    camera.updateMatrixWorld();
    if (vise.actif !== carteRepere) poserCartes(vise.actif);
    vueCss.multiplyMatrices(camera.matrixWorldInverse, repere);
    const css = 'translateZ(' + D + 'px)' + matriceCamera(vueCss) + 'translate(' + l / 2 + 'px,' + h / 2 + 'px)';
    if (css !== derniereCss) { cameraCss.style.transform = css; derniereCss = css; }

    if (vise.actif !== actif) {
      if (actif >= 0) cartes[actif].el.classList.remove('est-active');
      actif = vise.actif;
      if (sommaire) sommaire.activer(etapes.indexOf(cartes[actif].etape));
      window.Site.carteVoyage = { carte: cartes[actif].el, etape: cartes[actif].etape, cote: cartes[actif].cote };
      document.dispatchEvent(new CustomEvent('voyage:carte', { detail: window.Site.carteVoyage }));
    }
    cartes[actif].el.classList.add('est-active');
    // Seules les cartes proches sont dessinées ; plus elles sont loin du voyage, plus elles s'effacent
    cartes.forEach((c) => {
      const ecart = Math.abs(c.i - vise.continu);
      const visible = ecart < 2.6;
      if (visible !== c.visible) { c.visible = visible; c.el.style.visibility = visible ? '' : 'hidden'; }
      if (!visible) return;
      // Le contenu d'une carte apparaît quand elle approche (les révélations de commun.js
      // attendent un défilement de la page ; ici, c'est la caméra qui bouge)
      if (!c.revelee && ecart < 1.2) {
        c.revelee = true;
        c.el.querySelectorAll('[data-revele], [data-mots]').forEach((el) => el.classList.add('est-visible'));
      }
      const o = Math.round(Math.max(0.12, 1 - ecart * 0.42) * 50) / 50;
      if (o !== c.opacite) { c.opacite = o; c.el.style.opacity = o === 1 ? '' : String(o); }
    });
    if (sommaire) sommaire.progression(Math.min(1, Math.max(0, (window.scrollY - origine) / total)));
    // Les effets liés à la position à l'écran (traits des timelines…) suivent la caméra
    if (!immobile && window.Site.rafraichir) window.Site.rafraichir();
    return !immobile;
  }

  /* ---------- Aller à un élément : la carte qui le contient (ou la première de son étape) ---------- */
  function defiler(y, immediat) {
    const lenis = window.Site && window.Site.lenis;
    if (lenis) lenis.scrollTo(y, immediat ? { immediate: true, force: true } : { duration: 1.6, force: true });
    else window.scrollTo(0, y);
  }
  function positionDe(el) {
    const c = cartes.find((x) => x.el === el || x.el.contains(el)) || cartes.find((x) => x.etape === el || el.contains(x.el));
    if (!c) return null;
    let t = 0;
    if (c.course && c.el !== el && c.el.contains(el)) {
      let haut = 0;
      for (let n = el; n && n !== c.el; n = n.offsetParent) haut += n.offsetTop;
      t = Math.min(1, Math.max(0, (haut - MARGE) / c.course));
    }
    return origine + c.debut + pause / 2 + t * c.course;
  }
  window.Site.allerA = (el, options) => {
    const y = positionDe(el);
    if (y === null) return false;
    defiler(y, options && options.immediat);
    return true;
  };
  // Clavier : le focus qui entre dans une autre carte y emmène la caméra
  document.addEventListener('focusin', (e) => {
    if (e.target.closest('dialog')) return;
    const c = cartes.find((x) => x.el.contains(e.target));
    if (c && c.i !== actif) window.Site.allerA(e.target);
  });

  // Une carte change de taille (accordéon, filtre, image chargée) ou l'écran change : nouvelle mise en page
  let attente = 0;
  const relancer = () => { clearTimeout(attente); attente = setTimeout(miseEnPage, 140); };
  window.addEventListener('resize', relancer);
  const observateur = new ResizeObserver(relancer);
  cartes.forEach((c) => observateur.observe(c.el));

  miseEnPage();
  // Lien vers une section (index.html#projets) : on y va directement
  if (location.hash.length > 1) {
    const ancre = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (ancre) window.Site.allerA(ancre, { immediat: true });
  }

  return {
    cartes: cartes,
    suivre: suivre,
    etapeActive: () => etapes.indexOf(cartes[Math.max(0, actif)].etape),
    surMiseEnPage: () => {},
    // Points de passage de la caméra (pour répartir le réseau autour du voyage)
    chemin: () => {
      const points = [];
      cartes.forEach((c) => { const a = new THREE.Vector3(), b = new THREE.Vector3(); poseLecture(c, 0, a); poseLecture(c, 1, b); points.push(a, b); });
      return new THREE.CatmullRomCurve3(points, false, 'centripetal');
    },
    // Boule de l'étape : à côté de la première carte de chaque étape, reliée à elle par un câble
    attaches: () => etapes.map((etape) => {
      const c = cartes.find((x) => x.etape === etape);
      if (!c) return null;
      const cote = c.i % 2 ? 1 : -1;
      const bord = new THREE.Vector3(cote * c.l / 2, c.h / 2 - 90, 0).applyQuaternion(c.quat).add(c.pos);
      const boule = new THREE.Vector3(cote * (c.l / 2 + 320), c.h / 2 + 40, -160).applyQuaternion(c.quat).add(c.pos);
      return { bord: bord, boule: boule };
    }),
    echelle: () => D / 360
  };
}


/* --------------------------------------------------------------------------
   4. L'espace 3D
   -------------------------------------------------------------------------- */
if (webglDisponible()) {
  demarrer().catch((e) => {
    // Échec (réseau, pilote graphique…) : la page reste un site classique
    console.warn('[Espace 3D] ' + e.message);
    racineHtml.classList.remove('espace-actif', 'voyage-pret');
  });
}

async function demarrer() {
  const THREE = await import(URL_THREE);

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
  const camera = new THREE.PerspectiveCamera(58, 1, 1, 60000);

  // Les cartes d'abord : le réseau se répartit autour du voyage de la caméra
  if (avecVoyage && !mouvementReduit) voyage = creerVoyage(THREE, camera);
  const E = voyage ? voyage.echelle() : 1;              // échelle du réseau (unités par « pas »)

  /* ---------- Le chemin : celui du voyage, ou une courbe qui serpente vers l'avant (-Z) ---------- */
  const NB_ETAPES = Math.max(2, etapes.length);
  const PAS = 760;
  let chemin;
  if (voyage) chemin = voyage.chemin();
  else {
    const controle = [];
    for (let i = -1; i <= NB_ETAPES; i++) {
      controle.push(new THREE.Vector3(Math.sin(i * 1.3) * 240, Math.cos(i * 0.9) * 120 + Math.sin(i * 2.1) * 40, -i * PAS));
    }
    chemin = new THREE.CatmullRomCurve3(controle, false, 'centripetal');
  }
  const du = 1 / (NB_ETAPES + 1);
  const uEtape = (i) => (i + 1) * du;
  const uCamera = (position) => uEtape(position) - 0.42 * du;

  /* ---------- Réglages (allégés sur petit écran) ---------- */
  const longueur = voyage ? voyage.cartes.length : NB_ETAPES;
  const NB_NOEUDS = Math.round((petitEcran ? 22 : 40) * longueur + (petitEcran ? 60 : 110));
  const VOISINS = 3;
  const DISTANCE_MAX = 320 * E;
  const NB_PAQUETS = petitEcran ? 18 : 46;

  const violet = new THREE.Color('#7c3aed');
  const lavande = new THREE.Color('#d9ccfb');

  /* ---------- Les nœuds, répartis dans un tube autour du chemin ---------- */
  const noeuds = [];
  const tailles = [];
  const etapesNoeuds = [];                              // -1 : nœud ; k : boule de l'étape k
  const aleatoire = (() => { let g = 7; return () => { g = (g * 16807) % 2147483647; return (g - 1) / 2147483646; }; })();
  const tmp = new THREE.Vector3(), axe = new THREE.Vector3();
  for (let i = 0; i < NB_NOEUDS; i++) {
    // Un nuage plus dense au départ (le réseau de l'accueil), puis tout le long du parcours
    const u = i < NB_NOEUDS * 0.16 ? aleatoire() * du * 1.4 : aleatoire();
    chemin.getPoint(Math.min(1, u), tmp);
    const angle = aleatoire() * Math.PI * 2;
    const rayon = (120 + Math.pow(aleatoire(), 0.7) * (petitEcran ? 520 : 720)) * E;
    axe.set(Math.cos(angle) * rayon * 1.5, Math.sin(angle) * rayon * 0.8, (aleatoire() - 0.5) * 260 * E);
    noeuds.push(tmp.clone().add(axe));
    tailles.push(aleatoire() < 0.12 ? 15 + aleatoire() * 6 : 6 + aleatoire() * 5);
    etapesNoeuds.push(-1);
  }
  // Les boules violettes : une par étape (à côté de sa carte pendant le voyage)
  const attaches = voyage ? voyage.attaches() : null;
  const waypoints = etapes.map((_, i) => {
    if (attaches && attaches[i]) return attaches[i].boule.clone();
    const p = chemin.getPoint(uEtape(i));
    const tangente = chemin.getTangent(uEtape(i));
    const cote = new THREE.Vector3().crossVectors(tangente, new THREE.Vector3(0, 1, 0)).normalize();
    return p.add(cote.multiplyScalar(i % 2 ? 150 : -150)).add(new THREE.Vector3(0, -30, 0));
  });
  const debutWaypoints = noeuds.length;
  waypoints.forEach((w, i) => { noeuds.push(w); tailles.push(34); etapesNoeuds.push(i); });

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

  /* ---------- Shaders : l'éclat (souris, étape active) et la brume sont calculés sur la carte
     graphique ; le JavaScript ne touche plus aux nœuds à chaque image ---------- */
  const uniformes = {
    uRatio: { value: rendu.getPixelRatio() },
    uEchelle: { value: E },
    uEcran: { value: new THREE.Vector2(1, 1) },
    uSouris: { value: new THREE.Vector2(0, 0) },
    uRayon: { value: petitEcran ? 150 : 240 },
    uActif: { value: 0 },
    uTemps: { value: 0 },
    uBrume: { value: new THREE.Vector2(1100 * E, 1850 * E) },
    uCouleurA: { value: new THREE.Color('#a78bfa') },
    uCouleurB: { value: violet },
    uLavande: { value: lavande }
  };
  const eclat = `
    uniform vec2 uEcran;
    uniform vec2 uSouris;
    uniform float uRayon;
    uniform float uEchelle;
    uniform vec2 uBrume;
    float eclatSouris(vec4 clip) {
      vec2 ecart = (clip.xy / clip.w - uSouris) * 0.5 * uEcran;
      float c = clamp(1.0 - length(ecart) / uRayon, 0.0, 1.0);
      return c * c * (3.0 - 2.0 * c);
    }
    float brume(float d) {
      return smoothstep(18.0 * uEchelle, 90.0 * uEchelle, d) * (1.0 - smoothstep(uBrume.x, uBrume.y, d));
    }
  `;
  const materiauPoints = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: uniformes,
    vertexShader: eclat + `
      attribute float aTaille;
      attribute float aEtape;
      uniform float uRatio;
      uniform float uActif;
      uniform float uTemps;
      varying float vEclat;
      varying float vVisible;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        float e = eclatSouris(gl_Position);
        if (aEtape > -0.5) e = abs(aEtape - uActif) < 0.5 ? 0.9 + sin(uTemps * 4.0) * 0.25 : 0.35;
        else if (aEtape < -1.5) e = 1.0;
        vEclat = e;
        vVisible = brume(d);
        gl_PointSize = min(90.0, aTaille * (1.0 + e * 1.6) * uRatio * (430.0 * uEchelle / max(d, 1.0)));
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
  const geoPoints = new THREE.BufferGeometry();
  geoPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geoPoints.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(tailles), 1));
  geoPoints.setAttribute('aEtape', new THREE.BufferAttribute(new Float32Array(etapesNoeuds), 1));
  const points = new THREE.Points(geoPoints, materiauPoints);
  points.frustumCulled = false;
  scene.add(points);

  /* ---------- Câbles du réseau (lavande, virent au violet près de la souris) ---------- */
  const posLignes = new Float32Array(liaisons.length * 6);
  function poserLignes() {
    liaisons.forEach((l, k) => {
      posLignes.set([noeuds[l[0]].x, noeuds[l[0]].y, noeuds[l[0]].z, noeuds[l[1]].x, noeuds[l[1]].y, noeuds[l[1]].z], k * 6);
    });
  }
  poserLignes();
  const geoLignes = new THREE.BufferGeometry();
  geoLignes.setAttribute('position', new THREE.BufferAttribute(posLignes, 3));
  const lignes = new THREE.LineSegments(geoLignes, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: uniformes,
    vertexShader: eclat + `
      varying float vEclat;
      varying float vVisible;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vEclat = eclatSouris(gl_Position);
        vVisible = brume(-mv.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uLavande;
      uniform vec3 uCouleurB;
      varying float vEclat;
      varying float vVisible;
      void main() { gl_FragColor = vec4(mix(uLavande, uCouleurB, vEclat), 0.75 * vVisible); }
    `
  }));
  lignes.frustumCulled = false;
  scene.add(lignes);

  /* ---------- Anneau qui s'étend autour de la boule de l'étape atteinte ---------- */
  const anneau = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 64),
    new THREE.MeshBasicMaterial({ color: violet, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  );
  scene.add(anneau);
  let anneauT = 1;

  /* ---------- Paquets de données (toujours éclairés) ---------- */
  const paquets = [];
  const posPaquets = new Float32Array(NB_PAQUETS * 3);
  for (let p = 0; p < NB_PAQUETS; p++) {
    const l = liaisons[Math.floor(aleatoire() * liaisons.length)];
    paquets.push({ de: l[0], vers: l[1], t: aleatoire(), vitesse: 0.004 + aleatoire() * 0.008 });
  }
  const geoPaquets = new THREE.BufferGeometry();
  geoPaquets.setAttribute('position', new THREE.BufferAttribute(posPaquets, 3));
  geoPaquets.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(NB_PAQUETS).fill(7), 1));
  geoPaquets.setAttribute('aEtape', new THREE.BufferAttribute(new Float32Array(NB_PAQUETS).fill(-2), 1));
  const pointsPaquets = new THREE.Points(geoPaquets, materiauPoints);
  pointsPaquets.frustumCulled = false;
  scene.add(pointsPaquets);

  /* ---------- Voyage : un câble relie la carte de chaque étape à sa boule ; un paquet y circule ---------- */
  const cables = [];
  const posAttaches = new Float32Array(Math.max(1, etapes.length) * 3);
  const geoAttaches = new THREE.BufferGeometry();
  geoAttaches.setAttribute('position', new THREE.BufferAttribute(posAttaches, 3));
  geoAttaches.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(Math.max(1, etapes.length)).fill(11), 1));
  geoAttaches.setAttribute('aEtape', new THREE.BufferAttribute(new Float32Array(Math.max(1, etapes.length)).fill(-2), 1));
  const pointsAttaches = new THREE.Points(geoAttaches, materiauPoints);
  pointsAttaches.frustumCulled = false;
  if (voyage) {
    etapes.forEach(() => {
      const ligne = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.4, depthWrite: false }));
      ligne.frustumCulled = false;
      cables.push({ ligne: ligne, courbe: new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()) });
      scene.add(ligne);
    });
    scene.add(pointsAttaches);
  }
  function poserCables() {
    const liste = voyage.attaches();
    liste.forEach((a, i) => {
      const cable = cables[i];
      cable.ligne.visible = !!a;
      if (!a) return;
      // La boule suit sa carte (nouvelle mise en page) : ses liaisons au réseau suivent aussi
      noeuds[debutWaypoints + i].copy(a.boule);
      positions.set([a.boule.x, a.boule.y, a.boule.z], (debutWaypoints + i) * 3);
      cable.courbe.v0.copy(a.bord);
      cable.courbe.v1.copy(a.bord).lerp(a.boule, 0.5).add(new THREE.Vector3(0, 160, 0));
      cable.courbe.v2.copy(a.boule);
      cable.ligne.geometry.dispose();
      cable.ligne.geometry = new THREE.BufferGeometry().setFromPoints(cable.courbe.getPoints(32));
    });
    geoPoints.attributes.position.needsUpdate = true;
    poserLignes();
    geoLignes.attributes.position.needsUpdate = true;
  }
  if (voyage) {
    poserCables();
    voyage.surMiseEnPage = () => { poserCables(); demander(); };
  }

  /* ---------- Taille ---------- */
  function redimensionner() {
    const l = window.innerWidth, h = window.innerHeight;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    uniformes.uEcran.value.set(l, h);
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
  const regard = new THREE.Vector3(), cible = new THREE.Vector3();
  let position = etatDefilement(window.scrollY).position;
  let derniereCible = position, vitesse = 0, actifPrecedent = -1;

  // Sans voyage : la caméra suit le chemin selon le défilement (avec l'inertie et l'effet de vitesse)
  function placerCameraChemin(temps, dt) {
    const etat = mouvementReduit ? { position: 0, active: 0 } : etatDefilement(window.scrollY);
    position += (etat.position - position) * (mouvementReduit ? 1 : Math.min(1, dt * 4.5));
    vitesse += ((etat.position - derniereCible) / Math.max(dt, 0.001) - vitesse) * 0.1;
    derniereCible = etat.position;
    const u = Math.min(1, Math.max(0, uCamera(position)));
    chemin.getPoint(u, camera.position);
    camera.position.x += sourisX * 26;
    camera.position.y += sourisY * 16;
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
    return etat.active;
  }

  function dessiner(temps, dt, active) {
    if (!sourisActive) {
      sourisX = Math.sin(temps * 0.00035) * 0.6;
      sourisY = Math.cos(temps * 0.00027) * 0.4;
    }
    uniformes.uSouris.value.set(sourisX, sourisY);
    uniformes.uTemps.value = temps / 1000;
    uniformes.uActif.value = active;

    // Étape atteinte : sa boule lâche une onde, son câble s'allume
    if (active !== actifPrecedent) {
      actifPrecedent = active;
      if (waypoints[active] && !mouvementReduit) { anneau.position.copy(noeuds[debutWaypoints + active]); anneauT = 0; }
      cables.forEach((c, i) => { c.ligne.material.opacity = i === active ? 0.75 : 0.32; });
    }
    if (anneauT < 1) {
      anneauT = Math.min(1, anneauT + dt * 0.8);
      anneau.scale.setScalar((20 + anneauT * 160) * E);
      anneau.material.opacity = (1 - anneauT) * 0.55;
      anneau.lookAt(camera.position);
    } else anneau.material.opacity = 0;

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

    if (voyage) {
      cables.forEach((c, k) => {
        if (!c.ligne.visible) return;
        c.courbe.getPoint(((temps || 0) * 0.00018 + k * 0.23) % 1, tmp);
        posAttaches.set([tmp.x, tmp.y, tmp.z], k * 3);
      });
      geoAttaches.attributes.position.needsUpdate = true;
    }
    rendu.render(scene, camera);
  }

  /* ---------- Boucle : la caméra du voyage est mise à jour à chaque image ; le réseau est en
     pause si l'onglet est caché ou si une scène plein écran (visite de la E39) le recouvre ---------- */
  // Performance : à l'arrêt (caméra immobile, aucun défilement depuis un instant), 30 images par seconde suffisent
  let enCours = false, dernier = performance.now(), dernierDefilement = 0;
  window.addEventListener('scroll', () => { dernierDefilement = performance.now(); demander(); }, { passive: true });
  function image(temps) {
    enCours = false;
    const dt = Math.min(0.05, (temps - dernier) / 1000);
    if (document.hidden) { dernier = temps; return; }
    let bouge = false, active;
    if (voyage) {
      bouge = voyage.suivre(dt);
      active = voyage.etapeActive();
    }
    const auRepos = !bouge && temps - dernierDefilement > 900;
    if (!mouvementReduit && auRepos && temps - dernier < 30) { demander(); return; }
    dernier = temps;
    if (!voyage) active = placerCameraChemin(temps, dt);
    const recouvert = racineHtml.classList.contains('visite-active');
    if (!recouvert) dessiner(temps, dt, active);
    if (!mouvementReduit) demander();
  }
  function demander() {
    if (!enCours) { enCours = true; requestAnimationFrame(image); }
  }
  document.addEventListener('visibilitychange', () => { dernier = performance.now(); demander(); });

  redimensionner();
  racineHtml.classList.add('espace-actif');
  requestAnimationFrame(() => couche.classList.add('est-pret'));
}
