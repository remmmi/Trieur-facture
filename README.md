# Trieur de Factures

Application desktop pour traiter, tamponner et classer vos factures PDF en un clic, propulsee par l'IA d'Anthropic (Claude). Pensee pour les comptables, freelances et TPE qui veulent eliminer la corvee mensuelle de saisie comptable.

## Pourquoi ce logiciel

La saisie manuelle d'un dossier comptable mensuel, c'est :

- Ouvrir chaque facture, relever fournisseur, date, montant, TVA
- Renommer le fichier selon une convention (`AAAAMM_fournisseur_numero.pdf`)
- Apposer un tampon avec le numero de compte
- Le classer dans le bon sous-dossier annee / trimestre / mois

Trieur de Factures fait tout ca automatiquement. Vous deposez vos factures dans un dossier, l'IA extrait les informations, vous validez d'un clic et le document est tamponne et classe.

## Fonctionnalites principales

### Extraction IA des donnees comptables

- Reconnaissance automatique du fournisseur, du numero de facture, des dates, des montants HT/TTC et de la TVA
- Detection du type de document : facture, ticket de caisse (BVI / CB), document divers
- Pre-classification intelligente : un document qui n'est pas une facture (rapport, courrier) est dirige vers le compte "Documents divers"
- Choix du modele : Sonnet 4.6 par defaut (rapide, economique) ou Opus 4.7 sur demande (vision haute resolution pour scans flous ou tickets vertical denses)
- Bouton "Relecture IA" pour repasser un document en mode premium quand l'extraction standard a echoue

### Tampon comptable personnalise

- Apposition du numero de compte directement sur le PDF
- Position et rotation reglables a la souris (drag and drop + molette)
- Tampon "Paye" bleu optionnel pour les pieces deja reglees (CB, virement, prelevement)
- Mode "ventilation" pour les factures multi-comptes : empile autant de tampons que de lignes de ventilation, avec calcul HT/TVA/TTC bidirectionnel

### Classement automatique

- Renommage du fichier selon une convention configurable
- Creation automatique de l'arborescence `annee / [trimestre] / mois / facture.pdf`
- Granularite reglable : par mois, par trimestre, ou les deux
- Filing par date d'emission ou par date de paiement (utile pour les prelevements SEPA)

### Plan comptable et mappings fournisseurs

- Plan comptable francais par defaut, importable depuis un CSV
- Ajout de comptes a la volee depuis le combobox
- Apprentissage automatique des mappings fournisseur vers compte
- Detection des mappings orphelins quand le plan comptable change
- Import en masse via CSV (separateur point-virgule)

## Comment ca marche

1. **Selectionner les dossiers source et destination**. Le dossier source contient vos PDF a traiter, le dossier destination est la racine de votre arborescence comptable.
2. **Laisser l'IA travailler**. Chaque PDF est analyse automatiquement : fournisseur, date, montant, compte propose. Vous voyez la preview en temps reel.
3. **Valider d'un clic**. Le document est tamponne, renomme et classe. Passez au suivant.

Un dossier mensuel typique de 30 factures se traite en 5 a 10 minutes au lieu d'une heure.

## Pour qui

- Comptables et experts-comptables qui veulent automatiser la prise en charge des dossiers clients
- Freelances et auto-entrepreneurs qui font leur compta eux-memes
- TPE qui n'ont pas les moyens d'un logiciel comptable complet
- Toute personne avec une pile de factures PDF a classer

## Installation

### Windows

Telechargez le `.exe` de la derniere release : https://github.com/remmmi/Trieur-facture/releases

Le logiciel necessite LibreOffice installe sur la machine pour convertir les documents Word (.doc, .docx) en PDF.

### Linux

Clonez le repo et lancez en developpement :

```bash
git clone https://github.com/remmmi/Trieur-facture.git
cd Trieur-facture
npm install
npm run dev
```

Pour un build de production :

```bash
npm run build
```

## Configuration

### Cle API Anthropic

L'extraction IA necessite une cle API Anthropic (Claude). Recuperez-la sur https://console.anthropic.com, puis collez-la dans **Parametres > General > Cle API Anthropic**. Le logiciel valide la cle automatiquement.

Cout indicatif : environ 0,003 dollar par facture en mode Sonnet 4.6, 0,015 dollar en mode Opus 4.7. Une centaine de factures par mois coute moins d'un cafe.

### Dossiers et nommage

Dans **Parametres > General**, vous pouvez :

- Choisir d'inclure le montant TTC dans le nom du fichier
- Prefixer le nom par le numero de compte (utile pour les classements alphabetiques)
- Inclure le libelle du compte dans le tampon
- Definir le seuil de "gros fichier" qui declenche une confirmation avant l'analyse IA
- Configurer les modes de paiement disponibles pour le tampon "Paye"

### Plan comptable

Importez votre plan comptable au format CSV depuis **Parametres > Plan comptable**. Format attendu : deux colonnes `numero;libelle` separees par des points-virgules, une ligne par compte. Le plan par defaut contient deja les comptes courants 000000 (Documents divers) et 471000 (Comptes d'attente).

## Confidentialite et securite

- Aucune donnee n'est envoyee a un serveur tiers, sauf le contenu des PDF a l'API Anthropic au moment de l'extraction
- Anthropic ne stocke pas les donnees envoyees a l'API (cf. leurs CGU "zero data retention" pour les comptes API)
- La cle API et la configuration sont stockees localement dans `~/.config/trieur-facture/config.json` (Linux) ou `%APPDATA%\trieur-facture\config.json` (Windows)
- Aucune telemetrie, aucun tracking

## Stack technique

- Electron 39 + electron-vite + TypeScript
- React 19 + Zustand pour le state management
- Tailwind CSS v4 + shadcn/ui pour l'interface
- pdfjs-dist v4 pour la preview, pdf-lib pour le tampon
- libreoffice-convert pour la conversion DOC/DOCX
- @anthropic-ai/sdk pour l'extraction IA
- Fuse.js pour le fuzzy matching des fournisseurs

## Roadmap

- Support multi-comptes Anthropic (clefs partagees pour les cabinets)
- Export comptable direct vers CSV / FEC
- OCR local de secours en cas d'indisponibilite reseau
- Mode batch pour traiter un dossier entier sans intervention

## Contribuer

Les contributions sont bienvenues. Le projet utilise une architecture trois couches stricte (main / preload / renderer). Voir `CLAUDE.md` pour les conventions et `src/renderer/src/components/DebugPanel.tsx` pour les outils de debug en mode developpement.

## Licence

MIT

---

**Mots-cles** : logiciel comptable francais, tri factures PDF, OCR factures, automatisation comptabilite, tampon comptable PDF, ventilation comptable, extraction donnees facture, plan comptable francais, classement automatique factures, Electron, Claude AI, Anthropic, open source, freelance, auto-entrepreneur, TPE.
