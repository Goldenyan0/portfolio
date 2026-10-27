# 🌐 Portfolio – Yanis Poulain

> Site web portfolio personnel — Vitrine professionnelle en ligne

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/fr/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/fr/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/fr/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TryHackMe](https://img.shields.io/badge/TryHackMe-212C42?style=flat&logo=tryhackme&logoColor=white)](https://tryhackme.com/p/Goldenyan.exe)

---

## 📌 Présentation

Ce projet est mon **portfolio personnel** : une vitrine en ligne qui présente mon profil, mon alternance, mes compétences, mes projets et mon parcours en informatique.

Alternant en administration systèmes et réseaux à l'**Établissement Français du Sang**, en **BTS SIO** à MyDigitalSchool (2026-2028).

---

## 🗂️ Pages

| Page | Contenu |
|---|---|
| `index.html` | Portfolio immersif : domaines, chiffres clés, « Pourquoi moi », projets, stack, parcours, contact |
| `cv.html` | CV formel, imprimable / exportable en PDF |
| `e39.html` | Projet BMW E39 520i (M54B22) : mécanique, diagnostic et documentation du moteur |

Les trois pages partagent une seule feuille de style : `css/style.css`.

---

## 🧰 Technologies utilisées

| Technologie | Usage |
|---|---|
| HTML5 / CSS3 / JavaScript vanilla | Structure, mise en page, animations — sans framework |
| [Three.js](https://threejs.org/) | Espace 3D parcouru au défilement sur les 3 pages (repli : site classique si WebGL est indisponible) et E39 en 3D sur `e39.html` (visite guidée, maquette, fluides) |
| [Lenis](https://lenis.darkroom.engineering/) | Défilement fluide (hébergé dans le dépôt : `js/vendor/`) |
| [EmailJS](https://www.emailjs.com/) | Envoi du formulaire de contact (avec champ piège anti-spam), chargé seulement quand on utilise le formulaire, avec contrôle d'intégrité (SRI) |
| Space Grotesk + Inter | Polices hébergées dans le dépôt (`fonts/`) |

3 librairies externes au maximum ; Three.js et EmailJS sont servis par jsDelivr.

---

## ✨ Animations et interactions

- Navigation immersive (accueil et page E39) : chaque section est une carte posée dans l'espace 3D (transformations CSS 3D, même caméra que le réseau). Le défilement fait voyager la caméra : elle lit chaque carte de face, à l'échelle 1, puis s'envole vers la suivante ; sur `e39.html`, chaque fiche de la documentation est sa propre carte. Le CV garde la caméra qui avance dans le réseau
- Sommaire latéral persistant (repliable sur mobile), jauge de progression, annonce de l'étape atteinte
- Page E39 : visite guidée — la voiture reste à l'écran et la caméra rejoint la pièce de chaque fiche ; la maquette 3D complète (vue éclatée numérotée, accélération, fluides, panneau d'affichage) ; fiches pièces avec la pièce dans la voiture, la pièce seule en 3D et sa photo réelle ; tour du propriétaire (extérieur et intérieur) ; photos agrandies au clic
- Préchargeur (compteur + rideau), boutons magnétiques (curseur natif du système)
- Titres révélés mot à mot ; sans navigation immersive (CV, ou WebGL indisponible) : hero en *scrollytelling*, transitions en volets (clip-path), « Pourquoi moi » épinglée
- Projets en grille (3 colonnes sur desktop, 2 sur tablette, 1 sur mobile), filtre animé par catégorie, inclinaison 3D des cartes
- Parallax multicouche, compteurs, barres de compétences, timelines qui se dessinent

- **Vue classique** (bouton de la navigation, ou du menu sur mobile) : la même page en défilement simple, sans voyage 3D ni réseau en arrière-plan — plus rapide à parcourir et plus légère. Le choix est mémorisé ; on revient sur la même section

**Accessibilité :** si « réduire les animations » est activé dans le système, le site s'affiche en version statique, sans mouvement. Contrastes conformes WCAG AA (audit axe-core). Mise en page pensée d'abord pour le mobile (vérifiée à 360 px).

**Performance :** une seule boucle d'animation par page ; les mesures de la page passent avant les écritures de styles à chaque image ; les shaders de la maquette sont compilés à l'avance (y compris les variantes « fantôme ») ; sur une machine modeste, la maquette passe d'elle-même à 30 images/s pendant que la page garde ses 60.

**Sécurité :** chaque page déclare une *Content-Security-Policy* (seuls le site et jsDelivr sont autorisés ; scripts inline autorisés par empreinte). Après toute modification d'un script inline (`<head>`, importmap), relancer `pwsh outils/csp.ps1`.

---

## 📁 Structure

```
portfolio/
├── index.html · cv.html · e39.html
├── 404.html               # page « introuvable » (servie par GitHub Pages)
├── css/style.css          # feuille de style commune
├── outils/csp.ps1         # met à jour la Content-Security-Policy des pages
├── js/
│   ├── commun.js          # comportements partagés (navigation, révélations, panneaux, scroll…)
│   ├── index.js           # page d'accueil
│   ├── espace-3d.js       # espace 3D commun aux 3 pages (module Three.js)
│   ├── moteur-3d.js       # E39 en 3D : visite guidée et maquette (module Three.js)
│   ├── carrosserie-e39.js # découpe du modèle de carrosserie en panneaux (module)
│   ├── pieces-e39.js      # fiches des pièces de la maquette
│   ├── e39.js · cv.js     # pages projet automobile et CV
│   └── vendor/lenis.min.js # Lenis (licence MIT)
├── fonts/                 # polices auto-hébergées
├── img/                   # images du site (projets, E39…)
├── modeles/               # modèle 3D de la carrosserie (bmw-e39-web.glb : version allégée)
├── photos-pieces/         # photos réelles des pièces (sources dans MANIFEST.csv)
└── ref/ma-voiture/        # photos d'origine de la E39 (plaques floutées)
```

---

## 🚀 Lancer le projet en local

Le fond 3D est un module JavaScript : il faut passer par un petit serveur local (ouvrir `index.html` directement ne suffit pas).

```bash
git clone https://github.com/Goldenyan0/portfolio
cd portfolio
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

Sans Python (Windows) : `pwsh .claude/serveur.ps1` sert le dossier sur http://localhost:8000.

> ⚠️ Pour que le formulaire de contact fonctionne, un compte **EmailJS** configuré est nécessaire.

---

## 🙏 Crédits

- Carrosserie de la maquette 3D : modèle « BMW E39 Free » de **Black Snow** (Sketchfab), sous licence [Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/), ramené à ma 520i (badges M5 retirés, sortie d'échappement unique, peinture bleu topaze) — mécanique modélisée pour ce site
- Photos des pièces (`photos-pieces/`) : la source de chaque photo est indiquée dans `MANIFEST.csv`

---

## 📬 Me contacter

| Canal | Lien |
|---|---|
| ✉️ Email | y.poulain04@gmail.com |
| 💻 GitHub | [github.com/Goldenyan0](https://github.com/Goldenyan0) |
| 🛡️ TryHackMe | [tryhackme.com/p/Goldenyan.exe](https://tryhackme.com/p/Goldenyan.exe) |

---

<p align="center">
  Copyright © 2026 — Made by <strong>Yanis Poulain</strong>
</p>
