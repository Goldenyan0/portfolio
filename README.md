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
| [Three.js](https://threejs.org/) | Réseau 3D interactif du hero (avec repli SVG si WebGL est indisponible) et maquette 3D de la E39 (moteur, transmission, carrosserie, fluides) sur `e39.html` |
| [Lenis](https://lenis.darkroom.engineering/) | Défilement fluide |
| [EmailJS](https://www.emailjs.com/) | Envoi du formulaire de contact (avec champ piège anti-spam) |
| Space Grotesk + Inter | Polices hébergées dans le dépôt (`fonts/`) |

3 librairies externes au maximum, chargées depuis jsDelivr.

---

## ✨ Animations et interactions

- Préchargeur (compteur + rideau), boutons magnétiques (curseur natif du système)
- Hero en *scrollytelling* : le titre se réduit et s'efface, la caméra plonge dans le réseau 3D
- Titres révélés mot à mot, transitions entre sections en volets (clip-path)
- Section « Pourquoi moi » épinglée : une comparaison par écran
- Projets en grille (3 colonnes sur desktop, 2 sur tablette, 1 sur mobile), filtre animé par catégorie, inclinaison 3D des cartes
- Parallax multicouche, compteurs, barres de compétences, timelines qui se dessinent

**Accessibilité :** si « réduire les animations » est activé dans le système, le site s'affiche en version statique, sans mouvement. Mise en page pensée d'abord pour le mobile (vérifiée à 360 px).

---

## 📁 Structure

```
portfolio/
├── index.html · cv.html · e39.html
├── css/style.css          # feuille de style commune
├── js/
│   ├── commun.js          # comportements partagés (navigation, révélations, scroll…)
│   ├── index.js           # page d'accueil
│   └── reseau-3d.js       # fond 3D du hero (module Three.js)
├── fonts/                 # polices auto-hébergées
├── img/                   # images du site (projets, E39…)
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

> ⚠️ Pour que le formulaire de contact fonctionne, un compte **EmailJS** configuré est nécessaire.

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
