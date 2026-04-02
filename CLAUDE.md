# Trieur de Factures - Claude Code Project Guide

## Projet
Application desktop Electron pour trier, tamponner (numero comptable) et classer des factures PDF/DOC/DOCX.

**Repo** : https://github.com/remmmi/Trieur-facture branche release/beta-1

## Plateformes
- **Developpement/test** : Debian (Linux)
- **Utilisateurs finaux** : Windows
- Utiliser des chemins compatibles cross-platform (path.join, pas de hardcoded `/`)

## Architecture 3 couches
- **Main Process** (`src/main/`) : Services backend (scan fichiers, conversion DOCX->PDF, tampon PDF, deplacement fichiers, AI extraction)
- **Preload** (`src/preload/`) : Bridge IPC strict entre Main et Renderer (`window.api.*`)
- **Renderer** (`src/renderer/src/`) : React UI (preview PDF, formulaire metier, gestion file d'attente)

## Stack technique
- Electron 39 + electron-vite + React 19 + TypeScript
- Zustand (state management)
- Tailwind CSS v4 + shadcn/ui (composants UI manuels dans `src/renderer/src/components/ui/`)
- pdfjs-dist **v4.10.38** (preview PDF) -- ATTENTION : v5.x incompatible avec Electron 39 (Map.getOrInsertComputed)
- pdf-lib (tampon PDF), libreoffice-convert (conversion DOC->PDF)
- @anthropic-ai/sdk (extraction IA des factures via Claude Sonnet 4)
- date-fns (dates)

## Commandes
- `npm run dev` : Lancer en mode developpement
- `npm run build` : Build production (avec typecheck)
- `npm run lint` : ESLint
- `npm run format` : Prettier
- `npm run typecheck` : Verification TypeScript

## Structure des fichiers
```
src/
  main/
    index.ts              # Entry point Electron, BrowserWindow
    ipc.ts                # Handlers IPC centralises (fichiers, AI, settings, plan comptable, screenshot)
    services/
      fileService.ts      # Scan dossier, selection dossier (avec defaultPath persistant)
      convertService.ts   # Conversion DOC/DOCX -> PDF
      stampService.ts     # Tampon PDF (pdf-lib) avec position/rotation
      aiService.ts        # Extraction IA via Claude API (fournisseur, date, montant, ticket de caisse)
      supplierMappingService.ts  # Config persistee : mappings fournisseurs, cle API, plan comptable, settings
  preload/
    index.ts              # contextBridge.exposeInMainWorld('api', ...)
    index.d.ts            # Types pour window.api
  renderer/src/
    main.tsx
    App.tsx               # Router : WelcomeScreen -> Layout -> Completion. Charge plan comptable et lance AI auto
    components/
      Layout.tsx          # Layout principal : PdfPreview (60%) + ComptaForm (40%)
      PdfPreview.tsx      # Preview PDF avec tampon draggable/rotatif sur canvas
      ComptaForm.tsx      # Formulaire comptable : fournisseur, compte, date, montant, partie ajustable
      AccountCombobox.tsx # Combobox compte comptable reutilisable (recherche + ajout inline)
      FileQueue.tsx       # Barre de navigation fichiers
      WelcomeScreen.tsx   # Ecran d'accueil avec selection source/destination
      SettingsPanel.tsx   # 3 onglets : General (dossiers, API, montant filename), Fournisseurs, Plan comptable
      SaveMappingDialog.tsx # Dialog auto-learn mapping fournisseur
      ui/                 # Composants shadcn/ui
    store/
      useAppStore.ts      # Store Zustand (folders, queue, form, stamp position/rotation, aiProcessing)
    data/
      planComptable.ts    # Plan comptable avec chargement dynamique (defaut + custom persiste)
    lib/
      utils.ts            # cn() helper
```

## Conventions
- IPC channels : kebab-case (ex: `select-folder`, `process-document`)
- Composants React : PascalCase, un fichier par composant
- Services backend : camelCase, dans `src/main/services/`
- Les alias `@` et `@renderer` pointent vers `src/renderer/src/`
- Les composants UI shadcn sont crees manuellement (pas via CLI) dans `components/ui/`

## Plan comptable
- Plan par defaut embarque dans `src/renderer/src/data/planComptable.ts`
- Import CSV custom via Parametres > Plan comptable (ecrase le precedent)
- Ajout de comptes inline depuis le combobox (tick verte si numero inconnu)
- Persiste dans config.json > customPlanComptable

## Logique de destination
- Chemin auto-genere : `{dossierBase}/{annee}/{mois}/{nom}.pdf`
- Sous-dossiers crees automatiquement si inexistants
- Destination custom possible par document (clic sur la preview du chemin)
- Verification anti-ecrasement avant ecriture (erreur si fichier existe deja)

## Tampon PDF
- Preview en temps reel sur le canvas (page 1 uniquement)
- Deplacable par drag & drop sur le canvas
- Rotatif par scroll wheel quand la souris est sur le tampon
- Position et rotation stockees dans le store (ratio 0-1 + degres)
- Tampon final : Helvetica Bold, rouge, fond blanc avec bordure grise
- Taille adaptative selon la largeur de la page (8-12pt)

## Extraction IA (Claude Sonnet 4)
- Extraction auto au chargement de chaque PDF + bouton sparkle fuchsia pour relecture manuelle
- Extrait : fournisseur, numero facture, date, montant HT/TTC/TVA
- Detection ticket de caisse (format etroit, BVI, CB) -> "ticket-caisse" dans partie ajustable
- Matching fournisseur flou (normalise tirets/espaces/casse) vers les mappings
- Gestion erreurs : credit epuise, rate limit, auth invalide, reseau KO
- Animation sparkle pulse cardiaque blanc/fuchsia pendant le traitement

## Parametres (persistes dans ~/.config/trieur-facture/config.json)
- Onglet General : dossiers source/destination, cle API Claude, checkbox montant dans filename
- Onglet Fournisseurs : CRUD mappings (nom facture -> nom court + compte comptable par defaut)
- Onglet Plan comptable : import CSV, preview tableau, reset vers defaut

## Donnees de test
- source_test.zip et target_test.zip dans le repo (mot de passe : john95ft2)
- 13 factures PDF dont un ticket de caisse Leroy Merlin (28032026.pdf)
- Dezipper a la racine : `unzip -P john95ft2 source_test.zip && unzip -P john95ft2 target_test.zip`

## Workflow de dev
- L'utilisateur dit "app" pour lancer `npm run dev` en background
- L'utilisateur dit "reboot" pour kill + relance
- Les modifs du main process necessitent un reboot (pas de HMR, seulement le renderer)
- Screenshots via chemin fichier ou CDP (remote debugging port 9222 + build production)
- Validation manuelle dans l'app, pas de tests unitaires
- L'utilisateur prefere les composants UI standard web (combobox/select plutot qu'input brut)

## Points d'attention
- pdfjs-dist doit rester en v4.x (v5 incompatible Electron 39)
- Le fond de l'app est #1c1b19 (pas noir pur)
- Le canvas PDF a un fillRect blanc avant le rendu (sinon invisible sur fond sombre)
- Le wheel listener du tampon doit etre sur le conteneur scrollable (pas le canvas) avec passive:false
- findSupplierMapping normalise tirets/espaces pour le matching flou
- L'icone app est l'emoji facture (receipt) genere en PNG 512x512
