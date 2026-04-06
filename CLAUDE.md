# Trieur de Factures - Claude Code Project Guide

## Projet
Application desktop Electron pour trier, tamponner (numero comptable) et classer des factures PDF/DOC/DOCX.

**Repo** : https://github.com/remmmi/Trieur-facture branche main
**Version** : 1.0.3
**Derniere release** : https://github.com/remmmi/Trieur-facture/releases/tag/v1.0.3

## Plateformes
- **Developpement/test** : Debian (Linux)
- **Utilisateurs finaux** : Windows (necessite LibreOffice pour la conversion DOC/DOCX)
- Utiliser des chemins compatibles cross-platform (path.join, pas de hardcoded `/`)

## Architecture 3 couches
- **Main Process** (`src/main/`) : Services backend (scan fichiers, conversion DOCX->PDF, tampon PDF, deplacement fichiers, AI extraction, AbortController)
- **Preload** (`src/preload/`) : Bridge IPC strict entre Main et Renderer (`window.api.*`)
- **Renderer** (`src/renderer/src/`) : React UI (preview PDF, formulaire metier, gestion file d'attente, panneaux redimensionnables)

## Stack technique
- Electron 39 + electron-vite + React 19 + TypeScript
- Zustand (state management)
- Tailwind CSS v4 + shadcn/ui (composants UI manuels dans `src/renderer/src/components/ui/`)
- pdfjs-dist **v4.10.38** (preview PDF) -- ATTENTION : v5.x incompatible avec Electron 39 (Map.getOrInsertComputed)
- pdf-lib (tampon PDF), libreoffice-convert (conversion DOC->PDF)
- @anthropic-ai/sdk (extraction IA des factures via Claude Sonnet 4, avec AbortController)
- react-resizable-panels v2 (panneaux redimensionnables) -- PAS v4 (API differente, drag casse)
- fuse.js v7 (fuzzy matching fournisseurs, threshold 0.3, check ambiguite)
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
    index.ts              # Entry point Electron, BrowserWindow, close-requested/force-quit IPC
    ipc.ts                # Handlers IPC centralises (fichiers, AI, settings, plan comptable, screenshot, abort, page-count)
    utils/
      sanitize.ts         # Utilitaires sanitisation noms de fichiers, parsing dates ISO
    services/
      fileService.ts      # Scan dossier, selection dossier (avec defaultPath persistant)
      convertService.ts   # Conversion DOC/DOCX -> PDF
      stampService.ts     # Tampon PDF (pdf-lib) : stampSingle + stampMultiple + tampon bleu "Paye"
      aiService.ts        # Extraction IA via Claude API (fournisseur, date, montant, amountType HT/TTC, suggestedAccount, AbortController)
      supplierMappingService.ts  # Config persistee : mappings fournisseurs, cle API, plan comptable, settings multiples
  preload/
    index.ts              # contextBridge.exposeInMainWorld('api', ...) + onCloseRequested/forceQuit
    index.d.ts            # Types pour window.api (ProcessData, VentilationLine, ProcessResult, AiSuggestion)
  renderer/src/
    main.tsx              # Mount React avec StrictMode + ErrorBoundary
    App.tsx               # Router : WelcomeScreen -> Layout -> Completion. Modal gros fichier. Warning fermeture.
    components/
      ErrorBoundary.tsx   # Catch React crashes, affiche erreur + bouton reload
      Layout.tsx          # PanelGroup redimensionnable : FileSidebar | PdfPreview | ComptaForm
      PdfPreview.tsx      # Preview PDF : auto-fit zoom, tampon draggable, multi-tampon ventile, tampon bleu "Paye", spinner loading
      ComptaForm.tsx      # Formulaire : fournisseur, compte, date, ventilation, partie ajustable, champ "Paye", montant
      SplitLines.tsx      # Composant ventilation : N cards (compte + TVA + HT + TTC) + zone recap + bouton "le reste"
      AccountCombobox.tsx # Combobox compte comptable reutilisable (recherche + ajout inline)
      FileQueue.tsx       # Barre de navigation fichiers + bouton reload source
      FileSidebar.tsx     # Liste laterale avec navigation directe + clic droit "Ignorer"
      WelcomeScreen.tsx   # Ecran d'accueil avec selection source/destination
      SettingsPanel.tsx   # 3 onglets : General (API, nommage, tampon, seuil gros fichier), Fournisseurs, Plan comptable
      SaveMappingDialog.tsx # Dialog auto-learn mapping fournisseur
      ui/                 # Composants shadcn/ui
    store/
      useAppStore.ts      # Store Zustand (folders, queue, form avec paid, stamp, ventilation, ignoredFiles, fileLoading, aiProcessing)
    data/
      planComptable.ts    # Plan comptable avec 000000 Documents divers + 471000 Comptes d'attente
    lib/
      utils.ts            # cn() helper
      sanitize.ts         # Sanitisation cote renderer (noms de fichiers, dates)
```

## Conventions
- IPC channels : kebab-case (ex: `select-folder`, `process-document`, `ai-abort`, `force-quit`)
- Composants React : PascalCase, un fichier par composant
- Services backend : camelCase, dans `src/main/services/`
- Les alias `@` et `@renderer` pointent vers `src/renderer/src/`
- Les composants UI shadcn sont crees manuellement (pas via CLI) dans `components/ui/`

## Claude Code Agents
Trois sub-agents specialises dans `.claude/agents/` :
- **electron-pro.md** : Main process, IPC, services backend, build/packaging, CI/CD
- **frontend-dev.md** : Composants React, store Zustand, logique UI
- **ui-designer.md** : Tailwind CSS, shadcn/ui, theme, layout, accessibilite

## Plan comptable
- Plan par defaut avec 000000 Documents divers + 471000 Comptes d'attente
- Import CSV custom via Parametres > Plan comptable (ecrase le precedent)
- Ajout de comptes inline depuis le combobox (tick verte si numero inconnu)
- Persiste dans config.json > customPlanComptable

## Logique de destination
- Chemin auto-genere : `{dossierBase}/{annee}/{mois_ou_trimestre}/{nom}.pdf`
- Sous-dossiers crees automatiquement si inexistants
- Destination custom possible par document (clic sur la preview du chemin)
- Verification anti-ecrasement avant ecriture (erreur affichee sous "partie ajustable")
- Option prefix num de compte dans le nom (checkbox settings, ventile : 601100+602200)

## Tampon PDF
- Preview en temps reel sur le canvas (page 1 uniquement)
- Deplacable par drag & drop sur le canvas
- Rotatif par scroll wheel quand la souris est sur le tampon (mode simple uniquement)
- Position par defaut : haut centre (35%, 5%), rotation -5 degres
- Tampon final : Helvetica Bold, rouge, fond blanc avec bordure grise
- Taille adaptative : clamp(10, 16, pageWidth/22) -- plus gros que v0.2
- Option "libelle dans le tampon" dans settings (desactivee par defaut : affiche juste le numero)

### Tampon bleu "Paye"
- Champ optionnel "Paye" dans le formulaire (sous partie ajustable)
- Si rempli, un tampon bleu `Paye : {contenu}` s'ajoute sous le dernier tampon rouge
- Meme rotation que le tampon rouge en mode simple, pas de rotation en mode ventile
- Bordure bleutee, texte bleu fonce rgb(0, 0, 0.8)

### Mode ventile (multi-comptes)
- Toggle "Ventilation" dans le formulaire, entre la date et la partie ajustable
- N cards : compte combobox + select TVA + HT + TTC (calcul bidirectionnel)
- Bouton "le reste" sur la derniere card (complete avec la diff vs total IA, utilise TVA de la card precedente)
- Zone recap : sommes HT/TTC + ecart avec estimation IA (vert si OK, rouge + flash si ecart)
- L'IA indique si le montant detecte est HT ou TTC (amountType)
- Tampons empiles verticalement sur le PDF, sans rotation
- Format par ligne : `{numero} : {montant}` (ou `{numero} - {libelle} : {montant}` si option activee)
- Montants formates en virgule decimale + symbole euro : `120,00€` (pas `120.00`)
- Max 8 lignes, taille police adaptative (min 7pt)
- Toggle OFF : reset form + restauration derniere suggestion IA (pas de re-appel API)

## Extraction IA (Claude Sonnet 4)
- Extraction auto au chargement de chaque PDF + bouton sparkle fuchsia pour relecture manuelle
- Bouton stop IA (X) visible pendant le traitement, utilise AbortController pour annuler l'appel API
- Extrait : fournisseur, numero facture, date, montant HT/TTC/TVA, type du montant (HT ou TTC)
- Pre-classification : si le doc ne semble pas etre une facture (rapport, >4 pages, pas de montant), suggere 000000 Documents divers
- Detection ticket de caisse (format etroit, BVI, CB) -> "ticket-caisse" dans partie ajustable
- Matching fournisseur fuzzy via Fuse.js (threshold 0.3, check ambiguite si 2e candidat trop proche)
- Detection mapping orphelin : si le compte du fournisseur matche n'existe plus dans le plan comptable, modale OrphanAccountDialog pour le corriger
- Gestion erreurs : credit epuise, rate limit, auth invalide, reseau KO
- Animation sparkle pulse cardiaque blanc/fuchsia pendant le traitement

## Import CSV fournisseurs
- Bouton "Importer CSV" dans Settings > Fournisseurs
- Separateur point-virgule (;), 1 ou 2 colonnes : nom;compte (compte optionnel)
- Si compte introuvable dans le plan comptable -> vide (pas importe avec un mauvais numero)
- Si une seule colonne (pas de ;) -> import du nom seul, compte vide
- Header auto-detecte et skippe (si 2e colonne n'est pas un chiffre)
- Handler IPC bulk `import-supplier-mappings` (1 seul load + save, pas N appels sequentiels)

## Ignorer un document
- Bouton rouge "Ignorer ce document" sous le bouton Valider
- Clic droit dans FileSidebar -> menu "Ignorer"
- Le fichier sort de la queue mais reste physiquement dans le dossier source
- Pas de persistance (memoire session uniquement)
- Warning a la fermeture de l'app si des fichiers sont ignores (dialog confirm natif)

## Navigation fichiers
- Barre FileQueue : fleches prev/next, compteur, bouton reload source (RefreshCw)
- FileSidebar : panneau lateral gauche redimensionnable avec liste cliquable + clic droit ignorer
- Panneaux redimensionnables : FileSidebar (14%, 10-22%) | PdfPreview (52%, 35-65%) | ComptaForm (34%, 28-45%)
- Auto-fit zoom : le PDF s'adapte a la largeur du conteneur au chargement
- Spinner overlay pendant le chargement d'un nouveau fichier
- Reset immediat du formulaire au changement de document

## Gros fichiers
- Modal d'avertissement si un PDF depasse le seuil de pages (defaut 8, configurable dans settings)
- L'utilisateur peut confirmer (lancer l'IA) ou annuler (saisie manuelle)

## Parametres (persistes dans ~/.config/trieur-facture/config.json)
- Onglet General :
  - Dossiers source/destination
  - Cle API Claude (avec validation + test)
  - Checkbox montant TTC dans filename
  - Checkbox prefixer filename par num de compte
  - Checkbox libelle dans le tampon (desactivee par defaut)
  - Granularite temporelle : mois ou trimestre (radio)
  - Seuil gros fichiers (nombre de pages, defaut 8)
- Onglet Fournisseurs : CRUD mappings (nom facture -> nom court + compte comptable par defaut)
- Onglet Plan comptable : import CSV, preview tableau, reset vers defaut

## Fermeture de l'app
- Le bouton X envoie `close-requested` au renderer via IPC
- Le renderer affiche un confirm si des fichiers sont ignores
- Puis appelle `forceQuit` pour fermer reellement
- Pas de `beforeunload` (bloquant sous Electron)

## Donnees de test
- source_test.zip et target_test.zip en local (proteges par mot de passe, pas dans le repo)
- 12 factures PDF dont un ticket de caisse Leroy Merlin

## CI/CD
- `.github/workflows/build.yml` : build Windows sur tag `v*`
- TOUJOURS `npm install --force` (pas `npm ci`) -- deps platform-specific Linux dans le lock file
- Node 22 en CI
- electron-builder pour le packaging (`npx electron-builder --win --publish never`)
- Release creee par `softprops/action-gh-release@v2`
- Pour release : `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
- Ne JAMAIS mettre de fichiers de test dans le repo

## Workflow de dev
- L'utilisateur dit "app" pour lancer `npm run dev` en background
- L'utilisateur dit "reboot" ou "restart" pour kill + relance
- Les modifs du main process necessitent un reboot (pas de HMR, seulement le renderer)
- Screenshots via chemin fichier ou CDP (remote debugging port 9222 + build production)
- Validation manuelle dans l'app, pas de tests unitaires
- L'utilisateur prefere les composants UI standard web (combobox/select plutot qu'input brut)

## Points d'attention
- pdfjs-dist doit rester en v4.x (v5 incompatible Electron 39)
- Le fond de l'app est #1c1b19 (pas noir pur)
- Le canvas PDF a un fillRect blanc avant le rendu (sinon invisible sur fond sombre)
- Le canvas utilise shrink-0 dans le flex container (sinon le zoom ne fonctionne pas)
- Les render tasks pdfjs sont annulees (cancel) avant d'en lancer une nouvelle (evite les corruptions de canvas)
- Le wheel listener du tampon doit etre sur le conteneur scrollable (pas le canvas) avec passive:false
- La rotation est desactivee en mode ventile (molette bloquee)
- findSupplierMapping normalise tirets/espaces pour le matching flou
- L'icone app est l'emoji facture (receipt) genere en PNG 512x512
- Le SplitLines n'utilise PAS de useEffect pour notifier le parent (evite les boucles de re-render)
- canValidate en mode ventile utilise un state `splitLinesValid` (pas une ref, sinon pas reactif)
- ErrorBoundary wrape App dans main.tsx pour catcher les crashes React
- La fermeture app passe par IPC close-requested/force-quit (pas beforeunload)
- Le tampon bleu "Paye" se positionne sous le dernier tampon rouge (coords PDF Y decroissant)
- Auto-fit zoom se calcule apres le mount du container (pas dans loadPdf, le container n'est pas encore rendu)
- react-resizable-panels v2 (PanelGroup/Panel/PanelResizeHandle), pas v4 (API differente, drag cassé)

## Bug connu
- Sur Windows en build prod, le toggle Ventilation peut crasher l'app (ecran vide). L'ErrorBoundary affiche maintenant l'erreur au lieu d'un ecran blanc. La cause racine reste a diagnostiquer (probablement un probleme de rendu conditionnel en prod).
