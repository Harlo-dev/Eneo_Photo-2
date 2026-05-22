# Eneo Photo

Application web de gestion privée de photos et vidéos, inspirée de Google Photos. 100 % front-end (HTML, CSS, JavaScript vanilla).

## Lancement

Ouvrez `index.html` dans un navigateur moderne (Chrome, Edge, Firefox), ou servez le dossier avec un serveur local :

```bash
# Python
cd eneo-photo
python -m http.server 8080

# Puis ouvrir http://localhost:8080
```

> **Note :** IndexedDB et certaines APIs (capture écran) fonctionnent mieux via `http://` que via `file://`.

## Fonctionnalités

- Upload drag & drop + bouton, capture écran (`getDisplayMedia`)
- Grille responsive, thumbnails compressés, lazy loading
- Albums, archive, corbeille (soft delete)
- Coffre verrouillé avec PIN (SHA-256)
- Thème clair/sombre, avatar local

## Structure

```
eneo-photo/
├── index.html
├── css/ (themes, layout, style)
├── js/  (modules modulaires)
└── assets/
```

## Premier lancement

Un PIN à 4 chiffres est demandé à la première ouverture. Il protège l’accès aux médias verrouillés et à la section « Verrouillés ».
