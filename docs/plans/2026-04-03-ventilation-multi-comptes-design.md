# Ventilation multi-comptes -- Design Document

**Date** : 2026-04-03
**Statut** : Implemente (v0.2.0, enrichi v1.0.1 : bouton "le reste", amountType HT/TTC, tampon bleu "Paye")
**Auteur** : Claude Code + utilisateur

## Probleme

Certaines factures couvrent des achats relevant de plusieurs comptes comptables (ex: fournitures + petit outillage). Actuellement, une seule paire compte/montant est possible par document. L'utilisateur doit choisir un compte arbitraire ou traiter la facture hors de l'app.

## Solution

Ajouter un mode "Ventilation" qui permet de saisir N lignes (compte + TVA + montant HT/TTC) pour un meme document PDF. Le PDF recoit N tampons empiles verticalement.

## Specifications fonctionnelles

### Mode simple (inchange)

Le formulaire actuel reste strictement identique quand la ventilation est desactivee :
- Un compte comptable (combobox)
- Un montant TTC (input texte)
- Un tampon unique sur le PDF

### Mode ventilation

#### Declencheur
Toggle pill "Ventilation" dans le formulaire, place apres la date et entre deux separateurs visuels.

#### Toggle ON
La zone compte + montant est remplacee par N cards dynamiques + zone recapitulative.

#### Toggle OFF
- Reset complet du formulaire (`resetForm()`)
- Relance de l'analyse IA sur le document courant

#### Chaque card contient
| Champ | Type | Comportement |
|-------|------|-------------|
| Compte comptable | AccountCombobox | Recherche + ajout inline (existant) |
| % TVA | Input numerique | Taux de TVA (20, 10, 5.5, 0) |
| Montant HT | Input numerique | Saisie -> calcul auto TTC |
| Montant TTC | Input numerique | Saisie -> calcul auto HT |
| Bouton supprimer | Icone "x" | Desactive si 1 seule ligne |

Le calcul bidirectionnel HT <-> TTC utilise un discriminant `lastEdited: 'ht' | 'ttc'` pour eviter les boucles. Quand le taux TVA change, on recalcule selon le dernier champ edite.

Formules :
- TTC = HT * (1 + taux/100)
- HT = TTC / (1 + taux/100)

#### Zone recapitulative (sous les cards)
- Somme HT totale
- Somme TTC totale
- Ecart avec le montant total estime par l'IA
- Si ecart != 0 : fond rouge, animation flash, bouton Valider desactive
- Si ecart == 0 : fond vert
- Si montant IA absent : pas de controle d'ecart, validation libre

#### Contraintes
- Minimum 1 ligne toujours presente (suppression -> recree une ligne vide)
- Maximum 8 lignes (au-dela, warning dans le resultat de traitement)
- Bouton "+" pleine largeur, style border-dashed, pour ajouter une ligne

### Tampon PDF

#### Format par ligne
```
601100 - Fournitures -> 120.00
602200 - Petit outillage -> 66.57
```

#### Empilement
- N tampons empiles verticalement (du haut vers le bas)
- Chaque tampon = rectangle blanc 0.9 opacite + bordure grise + texte rouge
- Espacement entre tampons : 0 (les rectangles se touchent)

#### Taille de police
- Mode simple : `clamp(8, 12, pageWidth / 30)` (inchange)
- Mode ventile : `clamp(7, min(12, pageWidth/30), maxBlockHeight / (N * 1.6))`
- `maxBlockHeight = pageHeight * 0.4` (max 40% de la page)

#### Rotation
- Desactivee en mode ventile (drag position OK, molette bloquee)
- Le bloc est toujours droit (rotation = 0 degres)

#### Overflow
- Si > 8 lignes : seules les 8 premieres sont tamponnees
- `ProcessResult.warning` contient le message d'avertissement

### Classement fichier

Aucun changement :
- Le dossier de destination est determine par la date (annee/mois ou trimestre)
- Le nom de fichier suit le pattern existant : `{fournisseur} - {partie ajustable} [- montant].pdf`
- Les numeros de compte ne sont PAS ajoutes au nom (TODO futur : checkbox optionnelle dans settings)

## Specifications techniques

### Nouvelles interfaces TypeScript

```typescript
// Ligne de ventilation (renderer, state local)
interface SplitLine {
  id: string                    // crypto.randomUUID()
  accountNumber: string
  accountLabel: string
  tvaRate: string               // "20", "5.5", "10", "0"
  amountHT: string
  amountTTC: string
  lastEdited: 'ht' | 'ttc'
}

// Ligne de ventilation (IPC, main process)
interface VentilationLine {
  accountNumber: string
  accountLabel: string
  amount: string                // Montant TTC
}

// ProcessData -- ajout backward-compatible
interface ProcessData {
  // ... champs existants inchanges ...
  ventilation?: VentilationLine[]  // absent ou vide = mode simple
}

// ProcessResult -- ajout optionnel
interface ProcessResult {
  success: boolean
  destinationPath: string
  warning?: string              // ex: "3 ligne(s) omises (max 8)"
}
```

### Architecture composants

```
ComptaForm.tsx
  |-- useState: ventilationEnabled (boolean)
  |-- useRef: splitLinesRef (SplitLine[])
  |
  |-- [ventilationEnabled = false]
  |     |-- AccountCombobox (existant)
  |     |-- Input montant (existant)
  |
  |-- [ventilationEnabled = true]
        |-- SplitLines.tsx (nouveau)
              |-- useState: lines (SplitLine[])
              |-- Props: aiTotalTTC, onChange(lines, isBalanced)
              |-- N x SplitCard (compte + TVA + HT + TTC)
              |-- Zone recap (sommes + ecart)
              |-- Bouton "+"
```

### State management

Les lignes de ventilation vivent en **state local** dans `SplitLines.tsx`, pas dans le store Zustand :
- Ephemeres (videes a chaque changement de document)
- N'interessent pas les autres composants (FileQueue, WelcomeScreen)
- Remontees a ComptaForm via callback `onChange` et ref

Exception : le store Zustand recoit un flag `ventilationEnabled` et les lignes finales pour que `PdfPreview` puisse dessiner le bloc multi-tampon en preview.

### Fichiers impactes

| Fichier | Nature du changement |
|---------|---------------------|
| `src/renderer/src/components/SplitLines.tsx` | **Nouveau** -- sous-composant cards + recap |
| `src/renderer/src/components/ComptaForm.tsx` | Toggle + branchement handleValidate + canValidate |
| `src/renderer/src/components/PdfPreview.tsx` | Rendu multi-tampon + blocage rotation molette |
| `src/renderer/src/store/useAppStore.ts` | `ventilationEnabled`, `ventilationLines` pour preview |
| `src/main/services/stampService.ts` | `stampMultiple()` + interface `VentilationLine` |
| `src/preload/index.d.ts` | Types `VentilationLine`, `ProcessData`, `ProcessResult` |
| `src/renderer/src/assets/main.css` | Animation `gap-flash` pour erreur ecart |

### Design UI

#### Card de ventilation
- Compte : pleine largeur, combobox existant
- 2e rangee : grid 3 colonnes (% TVA, HT, TTC)
- Labels : `text-[10px] uppercase tracking-wide`
- Inputs : `h-7 text-xs`
- Fond card : `bg-muted/30`, bordure `border-border`, `rounded-md`
- Bouton "x" : coin superieur droit de la card

#### Zone recap
- Fond vert (`bg-emerald-500/10`) si ecart == 0
- Fond rouge (`bg-red-500/10`) + animation flash si ecart != 0
- Texte : somme HT | somme TTC | ecart en gras

#### Toggle
- Pill centree : "Ventilation" avec switch
- Entre deux `<hr>` visuels, apres le champ date

#### Scroll
- Les cards s'etendent dans le flux normal du formulaire
- Le scroll du panneau droit (overflow-auto) gere le debordement
- Bouton Valider reste accessible (sticky footer si necessaire)
