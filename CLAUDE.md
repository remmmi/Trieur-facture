# Trieur de Factures - Claude Code Project Guide

## Projet
Application desktop Electron pour trier, tamponner (numéro comptable) et classer des factures PDF/DOC/DOCX.

## Plateformes
- **Développement/test** : Debian (Linux)
- **Utilisateurs finaux** : Windows
- Utiliser des chemins compatibles cross-platform (path.join, pas de hardcoded `/`)

## Architecture 3 couches
- **Main Process** (`src/main/`) : Services backend (scan fichiers, conversion DOCX->PDF, tampon PDF, déplacement fichiers)
- **Preload** (`src/preload/`) : Bridge IPC strict entre Main et Renderer (`window.api.*`)
- **Renderer** (`src/renderer/src/`) : React UI (preview PDF, formulaire métier, gestion file d'attente)

## Stack technique
- Electron + electron-vite + React + TypeScript
- Zustand (state management)
- Tailwind CSS v4 + shadcn/ui (composants UI manuels dans `src/renderer/src/components/ui/`)
- pdfjs-dist (preview PDF), pdf-lib (tampon PDF), libreoffice-convert (conversion DOC->PDF)
- date-fns (dates)

## Commandes
- `npm run dev` : Lancer en mode développement
- `npm run build` : Build production (avec typecheck)
- `npm run lint` : ESLint
- `npm run format` : Prettier
- `npm run typecheck` : Vérification TypeScript

## Structure des fichiers
```
src/
├── main/
│   ├── index.ts          # Entry point Electron, BrowserWindow
│   ├── ipc.ts            # Handlers IPC centralisés
│   └── services/
│       ├── fileService.ts     # Scan dossier, déplacement fichiers
│       ├── convertService.ts  # Conversion DOC/DOCX -> PDF
│       └── stampService.ts    # Tampon PDF (pdf-lib)
├── preload/
│   ├── index.ts          # contextBridge.exposeInMainWorld('api', ...)
│   └── index.d.ts        # Types pour window.api
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── components/
        │   ├── Layout.tsx
        │   ├── PdfPreview.tsx
        │   ├── ComptaForm.tsx
        │   ├── FileQueue.tsx
        │   └── ui/            # Composants shadcn/ui
        ├── store/
        │   └── useAppStore.ts # Store Zustand
        ├── data/
        │   └── planComptable.ts
        └── lib/
            └── utils.ts       # cn() helper
```

## Conventions
- IPC channels : kebab-case (ex: `select-folder`, `process-document`)
- Composants React : PascalCase, un fichier par composant
- Services backend : camelCase, dans `src/main/services/`
- Les alias `@` et `@renderer` pointent vers `src/renderer/src/`
- Les composants UI shadcn sont créés manuellement (pas via CLI) dans `components/ui/`

## Plan comptable
- Fichier CSV dans `resources/plan-comptable.csv`
- L'utilisateur peut aussi saisir manuellement un compte non présent dans la liste

## Logique de destination
- Chemin auto-généré : `{dossierBase}/{année}/{mois}/`
- Sous-dossiers créés automatiquement si inexistants
