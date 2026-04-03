# Ventilation multi-comptes -- Plan d'implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre la ventilation d'une facture sur N comptes comptables avec N tampons empiles sur le PDF.

**Architecture:** Approche C -- sous-composant `SplitLines.tsx` enfichable dans `ComptaForm.tsx`. Le toggle "Ventilation" bascule entre le mode simple (inchange) et le mode ventile. Cote backend, `stampService.ts` recoit un tableau optionnel `ventilation` et empile les tampons. Rotation desactivee en mode ventile.

**Tech Stack:** React 19, TypeScript, Zustand, pdf-lib, Tailwind CSS v4, shadcn/ui

**Design doc:** `docs/plans/2026-04-03-ventilation-multi-comptes-design.md`

---

### Task 1: Types et interfaces IPC (3 couches)

**Files:**
- Modify: `src/preload/index.d.ts:10-27` (ProcessData, ProcessResult)
- Modify: `src/main/services/stampService.ts:7-19` (ProcessData)
- Modify: `src/main/services/stampService.ts:28-31` (ProcessResult)

**Step 1: Ajouter VentilationLine et modifier ProcessData dans index.d.ts**

Dans `src/preload/index.d.ts`, ajouter apres l'interface `ProcessData` existante :

```typescript
export interface VentilationLine {
  accountNumber: string
  accountLabel: string
  amount: string
}
```

Et ajouter dans `ProcessData` :
```typescript
  ventilation?: VentilationLine[]
```

Et modifier `ProcessResult` :
```typescript
export interface ProcessResult {
  success: boolean
  destinationPath: string
  warning?: string
}
```

**Step 2: Dupliquer les memes interfaces dans stampService.ts**

Dans `src/main/services/stampService.ts`, ajouter `VentilationLine` avant `ProcessData`, ajouter `ventilation?: VentilationLine[]` dans `ProcessData`, et `warning?: string` dans `ProcessResult`.

**Step 3: Mettre a jour le type de retour dans preload/index.ts**

Dans `src/preload/index.ts` ligne 13, changer le type de retour :
```typescript
processDocument: (data: unknown): Promise<{ success: boolean; destinationPath: string; warning?: string }> =>
    ipcRenderer.invoke('process-document', data),
```

**Step 4: Verifier le typecheck**

Run: `npm run typecheck`
Expected: PASS (aucun changement fonctionnel, juste des ajouts optionnels)

**Step 5: Commit**

```bash
git add src/preload/index.d.ts src/preload/index.ts src/main/services/stampService.ts
git commit -m "feat: add VentilationLine types to IPC interfaces (backward-compatible)"
```

---

### Task 2: stampService multi-tampon

**Files:**
- Modify: `src/main/services/stampService.ts:33-141` (processDocument)

**Step 1: Extraire stampSingle (refactor sans changement fonctionnel)**

Extraire le code de tampon actuel (lignes 75-123) dans une fonction privee :

```typescript
interface StampParams {
  page: import('pdf-lib').PDFPage
  font: import('pdf-lib').PDFFont
  text: string
  stampX: number
  stampY: number
  stampRotation: number
  pageWidth: number
  pageHeight: number
}

function stampSingle({ page, font, text, stampX, stampY, stampRotation, pageWidth, pageHeight }: StampParams): void {
  const fontSize = Math.max(8, Math.min(12, pageWidth / 30))
  const textWidth = font.widthOfTextAtSize(text, fontSize)
  const padding = 4
  const boxW = textWidth + padding * 2
  const boxH = fontSize + padding * 2
  const x = Math.max(0, Math.min(stampX * pageWidth, pageWidth - boxW))
  const y = Math.max(0, Math.min(pageHeight - stampY * pageHeight - boxH, pageHeight - boxH))

  const rot = degrees(-stampRotation)
  const centerX = x + boxW / 2
  const centerY = y + boxH / 2
  const rad = (-stampRotation * Math.PI) / 180

  page.drawRectangle({
    x, y, width: boxW, height: boxH,
    color: rgb(1, 1, 1), opacity: 0.9,
    borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5,
    rotate: rot
  })

  const localTx = padding - boxW / 2
  const localTy = padding - boxH / 2
  const textX = centerX + localTx * Math.cos(rad) - localTy * Math.sin(rad)
  const textY = centerY + localTx * Math.sin(rad) + localTy * Math.cos(rad)

  page.drawText(text, {
    x: textX, y: textY, size: fontSize, font,
    color: rgb(0.8, 0, 0), rotate: rot
  })
}
```

**Step 2: Ajouter stampMultiple**

```typescript
function stampMultiple(
  page: import('pdf-lib').PDFPage,
  font: import('pdf-lib').PDFFont,
  ventilation: VentilationLine[],
  stampX: number,
  stampY: number,
  pageWidth: number,
  pageHeight: number
): string | undefined {
  const MAX_LINES = 8
  const lines = ventilation.slice(0, MAX_LINES)
  const N = lines.length

  // Taille de police adaptative
  const fontSizeByWidth = Math.max(8, Math.min(12, pageWidth / 30))
  const maxBlockHeight = pageHeight * 0.4
  const fontSizeByHeight = Math.floor(maxBlockHeight / (N * 1.6))
  const fontSize = Math.max(7, Math.min(fontSizeByWidth, fontSizeByHeight))

  const padding = 4
  const lineHeight = fontSize + padding * 2

  // Construire les textes et mesurer la largeur max
  const stampTexts = lines.map(l => {
    const label = l.accountLabel || ''
    return `${l.accountNumber} - ${label} -> ${l.amount}`
  })
  const maxTextWidth = Math.max(...stampTexts.map(t => font.widthOfTextAtSize(t, fontSize)))
  const boxW = maxTextWidth + padding * 2
  const totalBlockH = N * lineHeight

  // Position du bloc (coin haut-gauche en coords PDF)
  const blockX = Math.max(0, Math.min(stampX * pageWidth, pageWidth - boxW))
  const blockTopPdf = pageHeight - stampY * pageHeight
  const blockBottomPdf = blockTopPdf - totalBlockH
  const blockY = Math.max(0, blockBottomPdf)

  // Dessiner chaque ligne (ligne 0 = haut = Y le plus grand en PDF)
  lines.forEach((_, i) => {
    const lineY = blockY + (N - 1 - i) * lineHeight
    const x = blockX

    page.drawRectangle({
      x, y: lineY,
      width: boxW, height: lineHeight,
      color: rgb(1, 1, 1), opacity: 0.9,
      borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5
    })

    page.drawText(stampTexts[i], {
      x: x + padding,
      y: lineY + padding,
      size: fontSize,
      font,
      color: rgb(0.8, 0, 0)
    })
  })

  return ventilation.length > MAX_LINES
    ? `${ventilation.length - MAX_LINES} ligne(s) de ventilation omise(s) (max ${MAX_LINES})`
    : undefined
}
```

**Step 3: Brancher dans processDocument**

Remplacer le bloc de tampon dans `processDocument` par :

```typescript
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let warning: string | undefined

  if (data.ventilation && data.ventilation.length > 0) {
    // Mode ventile : N tampons empiles, pas de rotation
    warning = stampMultiple(firstPage, boldFont, data.ventilation, stampX, stampY, pageWidth, pageHeight)
  } else {
    // Mode simple : un seul tampon avec rotation
    const stampText = `${accountNumber}${accountLabel ? ' - ' + accountLabel : ''}`
    stampSingle({ page: firstPage, font: boldFont, text: stampText, stampX, stampY, stampRotation, pageWidth, pageHeight })
  }
```

Et modifier le return :
```typescript
  return { success: true, destinationPath: destPath, warning }
```

**Step 4: Verifier le typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/services/stampService.ts
git commit -m "feat: add multi-stamp support for ventilation mode in stampService"
```

---

### Task 3: Store Zustand -- state ventilation pour preview

**Files:**
- Modify: `src/renderer/src/store/useAppStore.ts`

**Step 1: Ajouter les champs ventilation au store**

Ajouter dans l'interface `AppState` :
```typescript
  // Ventilation
  ventilationEnabled: boolean
  setVentilationEnabled: (value: boolean) => void
  ventilationLines: { accountNumber: string; accountLabel: string; amount: string }[]
  setVentilationLines: (lines: { accountNumber: string; accountLabel: string; amount: string }[]) => void
```

Ajouter dans le create :
```typescript
  ventilationEnabled: false,
  setVentilationEnabled: (value) => set({ ventilationEnabled: value }),
  ventilationLines: [],
  setVentilationLines: (lines) => set({ ventilationLines: lines }),
```

Modifier `resetForm` pour aussi reset la ventilation :
```typescript
  resetForm: () =>
    set({
      currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) },
      aiExtractedSupplier: null,
      ventilationEnabled: false,
      ventilationLines: []
    }),
```

Modifier `nextFile` et `prevFile` pour aussi reset la ventilation :
```typescript
  // Dans nextFile et prevFile, ajouter dans le set() :
  ventilationEnabled: false,
  ventilationLines: []
```

**Step 2: Verifier le typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/src/store/useAppStore.ts
git commit -m "feat: add ventilation state to Zustand store for preview sync"
```

---

### Task 4: Composant SplitLines.tsx

**Files:**
- Create: `src/renderer/src/components/SplitLines.tsx`

**Step 1: Creer le composant**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { AccountCombobox } from '@/components/AccountCombobox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus, X } from 'lucide-react'

export interface SplitLine {
  id: string
  accountNumber: string
  accountLabel: string
  tvaRate: string
  amountHT: string
  amountTTC: string
  lastEdited: 'ht' | 'ttc'
}

interface SplitLinesProps {
  aiTotalTTC: string
  onChange: (lines: SplitLine[], isBalanced: boolean) => void
  initialAccount?: { number: string; label: string }
}

function emptyLine(): SplitLine {
  return {
    id: crypto.randomUUID(),
    accountNumber: '',
    accountLabel: '',
    tvaRate: '20',
    amountHT: '',
    amountTTC: '',
    lastEdited: 'ht'
  }
}

export function SplitLines({ aiTotalTTC, onChange, initialAccount }: SplitLinesProps): React.JSX.Element {
  const [lines, setLines] = useState<SplitLine[]>(() => {
    const first = emptyLine()
    if (initialAccount) {
      first.accountNumber = initialAccount.number
      first.accountLabel = initialAccount.label
    }
    return [first]
  })

  // Calculer les sommes et notifier le parent
  useEffect(() => {
    const sumHT = lines.reduce((acc, l) => acc + (parseFloat(l.amountHT) || 0), 0)
    const sumTTC = lines.reduce((acc, l) => acc + (parseFloat(l.amountTTC) || 0), 0)
    const aiTotal = parseFloat(aiTotalTTC) || 0
    const isBalanced = !aiTotalTTC || Math.abs(sumTTC - aiTotal) < 0.01
    onChange(lines, isBalanced)
  }, [lines, aiTotalTTC, onChange])

  const updateLine = useCallback((id: string, patch: Partial<SplitLine>): void => {
    setLines(prev => prev.map(line => {
      if (line.id !== id) return line
      const updated = { ...line, ...patch }

      const rate = parseFloat(updated.tvaRate) || 0
      const factor = 1 + rate / 100

      if (patch.amountHT !== undefined) {
        const ht = parseFloat(updated.amountHT)
        updated.amountTTC = isNaN(ht) ? '' : (ht * factor).toFixed(2)
        updated.lastEdited = 'ht'
      } else if (patch.amountTTC !== undefined) {
        const ttc = parseFloat(updated.amountTTC)
        updated.amountHT = isNaN(ttc) ? '' : (ttc / factor).toFixed(2)
        updated.lastEdited = 'ttc'
      } else if (patch.tvaRate !== undefined) {
        const f = 1 + (parseFloat(updated.tvaRate) || 0) / 100
        if (updated.lastEdited === 'ht') {
          const ht = parseFloat(updated.amountHT)
          updated.amountTTC = isNaN(ht) ? '' : (ht * f).toFixed(2)
        } else {
          const ttc = parseFloat(updated.amountTTC)
          updated.amountHT = isNaN(ttc) ? '' : (ttc / f).toFixed(2)
        }
      }

      return updated
    }))
  }, [])

  const addLine = (): void => {
    setLines(prev => [...prev, emptyLine()])
  }

  const removeLine = (id: string): void => {
    setLines(prev => {
      const next = prev.filter(l => l.id !== id)
      return next.length === 0 ? [emptyLine()] : next
    })
  }

  const handleSelectAccount = (id: string, numero: string, libelle: string): void => {
    updateLine(id, { accountNumber: numero, accountLabel: libelle })
  }

  // Sommes
  const sumHT = lines.reduce((acc, l) => acc + (parseFloat(l.amountHT) || 0), 0)
  const sumTTC = lines.reduce((acc, l) => acc + (parseFloat(l.amountTTC) || 0), 0)
  const aiTotal = parseFloat(aiTotalTTC) || 0
  const hasAiTotal = !!aiTotalTTC && !isNaN(aiTotal)
  const gap = hasAiTotal ? sumTTC - aiTotal : 0
  const isBalanced = !hasAiTotal || Math.abs(gap) < 0.01

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div key={line.id} className="relative rounded-md border border-border bg-muted/30 p-3 space-y-2">
          {/* Bouton supprimer */}
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => removeLine(line.id)}
              className="absolute top-2 right-2 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
              title="Supprimer cette ligne"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Numero de ligne */}
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Ligne {index + 1}
          </div>

          {/* Compte comptable pleine largeur */}
          <AccountCombobox
            accountNumber={line.accountNumber}
            accountLabel={line.accountLabel}
            onSelect={(numero, libelle) => handleSelectAccount(line.id, numero, libelle)}
          />

          {/* Grid 3 cols : TVA / HT / TTC */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">TVA %</Label>
              <Input
                className="h-7 text-xs"
                placeholder="20"
                value={line.tvaRate}
                onChange={(e) => updateLine(line.id, { tvaRate: e.target.value.replace(',', '.') })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">HT</Label>
              <Input
                className="h-7 text-xs"
                placeholder="0.00"
                value={line.amountHT}
                onChange={(e) => updateLine(line.id, { amountHT: e.target.value.replace(',', '.') })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">TTC</Label>
              <Input
                className="h-7 text-xs"
                placeholder="0.00"
                value={line.amountTTC}
                onChange={(e) => updateLine(line.id, { amountTTC: e.target.value.replace(',', '.') })}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Bouton ajouter */}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={addLine}
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une ligne
      </Button>

      {/* Zone recap */}
      <div className={`rounded-md p-3 text-sm space-y-1 ${
        isBalanced
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'bg-red-500/10 border border-red-500/20 gap-flash'
      }`}>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total HT</span>
          <span className="font-mono">{sumHT.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total TTC</span>
          <span className="font-mono font-semibold">{sumTTC.toFixed(2)}</span>
        </div>
        {hasAiTotal && (
          <div className="flex justify-between pt-1 border-t border-border/50">
            <span className="text-muted-foreground">Ecart avec estimation IA</span>
            <span className={`font-mono font-bold ${isBalanced ? 'text-emerald-500' : 'text-red-500'}`}>
              {gap > 0 ? '+' : ''}{gap.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Ajouter l'animation gap-flash dans main.css**

Dans `src/renderer/src/assets/main.css`, ajouter :

```css
@keyframes gap-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.gap-flash {
  animation: gap-flash 1s ease-in-out 2;
}
```

**Step 3: Verifier le typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/renderer/src/components/SplitLines.tsx src/renderer/src/assets/main.css
git commit -m "feat: add SplitLines component for multi-account ventilation cards"
```

---

### Task 5: Integration dans ComptaForm.tsx

**Files:**
- Modify: `src/renderer/src/components/ComptaForm.tsx`

**Step 1: Ajouter le toggle et le branchement**

Ajouter les imports :
```typescript
import { SplitLines, SplitLine } from '@/components/SplitLines'
```

Ajouter les etats locaux apres les useState existants :
```typescript
const [ventilationEnabled, setVentilationEnabled] = useState(false)
const splitLinesRef = useRef<SplitLine[]>([])
const [splitBalanced, setSplitBalanced] = useState(true)
```

Extraire du store :
```typescript
const { setVentilationEnabled: setStoreVentilation, setVentilationLines } = useAppStore()
```

Ajouter le handler toggle :
```typescript
const handleToggleVentilation = useCallback(async (enabled: boolean) => {
  setVentilationEnabled(enabled)
  setStoreVentilation(enabled)
  if (!enabled) {
    // Toggle OFF : reset + relance IA
    resetForm()
    setSupplierQuery('')
    splitLinesRef.current = []
    setVentilationLines([])
    if (currentPdfPath) {
      setAiProcessing(true)
      try {
        const suggestion = await window.api.aiPreProcess(currentPdfPath)
        if (suggestion) {
          setFormData({
            ...(suggestion.accountNumber && { accountNumber: suggestion.accountNumber }),
            ...(suggestion.accountLabel && { accountLabel: suggestion.accountLabel }),
            ...(suggestion.date && parseIsoDate(suggestion.date) && { date: suggestion.date }),
            ...(suggestion.fixedPart && { fixedPart: suggestion.fixedPart }),
            ...(suggestion.adjustablePart && { adjustablePart: suggestion.adjustablePart }),
            ...(suggestion.amount && { amount: suggestion.amount })
          })
          if (suggestion.fixedPart) setSupplierQuery(suggestion.fixedPart)
        }
      } catch { /* silent */ }
      finally { setAiProcessing(false) }
    }
  }
}, [currentPdfPath, resetForm, setFormData, setAiProcessing, setStoreVentilation, setVentilationLines])

const handleSplitChange = useCallback((lines: SplitLine[], isBalanced: boolean) => {
  splitLinesRef.current = lines
  setSplitBalanced(isBalanced)
  // Sync avec le store pour la preview canvas
  setVentilationLines(lines.filter(l => l.accountNumber && l.amountTTC).map(l => ({
    accountNumber: l.accountNumber,
    accountLabel: l.accountLabel,
    amount: l.amountTTC
  })))
}, [setVentilationLines])
```

**Step 2: Modifier canValidate**

Remplacer `canValidate` :
```typescript
const canValidate = useMemo(() => {
  if (!currentFormData.date || !currentFormData.fixedPart || !currentPdfPath || !destinationFolder || isProcessing) return false
  if (ventilationEnabled) {
    const lines = splitLinesRef.current
    return lines.length > 0 && lines.every(l => l.accountNumber && l.amountTTC) && splitBalanced
  }
  return !!currentFormData.accountNumber
}, [currentFormData.date, currentFormData.fixedPart, currentFormData.accountNumber, currentPdfPath, destinationFolder, isProcessing, ventilationEnabled, splitBalanced])
```

**Step 3: Modifier handleValidate pour le mode ventile**

Dans `handleValidate`, modifier l'appel `window.api.processDocument` :
```typescript
const { stampX, stampY, stampRotation } = useAppStore.getState()

const ventilation = ventilationEnabled
  ? splitLinesRef.current.filter(l => l.accountNumber && l.amountTTC).map(l => ({
      accountNumber: l.accountNumber,
      accountLabel: l.accountLabel,
      amount: l.amountTTC
    }))
  : undefined

const result = await window.api.processDocument({
  sourcePath: currentPdfPath,
  accountNumber: ventilationEnabled ? (ventilation?.[0]?.accountNumber ?? '') : currentFormData.accountNumber,
  accountLabel: ventilationEnabled ? (ventilation?.[0]?.accountLabel ?? '') : currentFormData.accountLabel,
  date: currentFormData.date,
  baseFolder: customDestFolder || destinationFolder,
  fileName,
  customDest: !!customDestFolder,
  useQuarterMode,
  stampX,
  stampY,
  stampRotation,
  ventilation
})

if (result.success) {
  if (result.warning) {
    setMessage({ type: 'warning', text: result.warning })
  } else {
    setMessage({ type: 'success', text: `Classe dans: ${result.destinationPath}` })
  }
  // ... reste du code existant ...
}
```

**Step 4: Ajouter le toggle et SplitLines dans le JSX**

Apres le bloc `{/* Date */}` et avant `{/* Adjustable part */}`, ajouter :

```tsx
{/* Toggle Ventilation */}
<div className="flex items-center justify-center py-1">
  <hr className="flex-1 border-border" />
  <button
    type="button"
    onClick={() => handleToggleVentilation(!ventilationEnabled)}
    className={`mx-3 px-3 py-1 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
      ventilationEnabled
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-muted text-muted-foreground border-border hover:bg-accent'
    }`}
  >
    Ventilation
  </button>
  <hr className="flex-1 border-border" />
</div>

{/* Mode ventile ou mode simple */}
{ventilationEnabled ? (
  <SplitLines
    aiTotalTTC={currentFormData.amount}
    onChange={handleSplitChange}
    initialAccount={currentFormData.accountNumber ? { number: currentFormData.accountNumber, label: currentFormData.accountLabel } : undefined}
  />
) : (
  <>
    {/* Account selector combobox (existant) */}
    <div className="space-y-2">
      <Label>Compte comptable</Label>
      <AccountCombobox
        accountNumber={currentFormData.accountNumber}
        accountLabel={currentFormData.accountLabel}
        onSelect={handleSelectAccount}
      />
    </div>

    {/* ... reste du mode simple (amount, etc.) ... */}
  </>
)}
```

Deplacer le bloc compte comptable et montant existant dans le `else` du ternaire (ils ne s'affichent qu'en mode simple).

**Step 5: Verifier le typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/renderer/src/components/ComptaForm.tsx
git commit -m "feat: integrate ventilation toggle and SplitLines into ComptaForm"
```

---

### Task 6: Preview multi-tampon dans PdfPreview.tsx

**Files:**
- Modify: `src/renderer/src/components/PdfPreview.tsx`

**Step 1: Modifier drawStamp pour supporter le mode ventile**

Dans `PdfPreview.tsx`, modifier `drawStamp` :

```typescript
const drawStamp = useCallback(
  (context: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
    const state = useAppStore.getState()
    const { accountNumber, accountLabel } = state.currentFormData
    const { ventilationEnabled, ventilationLines, stampX: sx, stampY: sy, stampRotation: rot } = state

    if (ventilationEnabled && ventilationLines.length > 0) {
      // Mode ventile : N tampons empiles, pas de rotation
      const pdfW = canvasW / scale
      const N = Math.min(ventilationLines.length, 8)
      const fontSizeByWidth = Math.max(8, Math.min(12, pdfW / 30))
      const maxBlockH = canvasH * 0.4
      const fontSizeByHeight = Math.floor(maxBlockH / (N * 1.6))
      const fontSize = Math.max(7, Math.min(fontSizeByWidth, fontSizeByHeight)) * scale
      const padding = 4 * scale

      context.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`

      const stampTexts = ventilationLines.slice(0, N).map(l =>
        `${l.accountNumber} - ${l.accountLabel || ''} -> ${l.amount}`
      )
      const maxTextWidth = Math.max(...stampTexts.map(t => context.measureText(t).width))
      const boxW = maxTextWidth + padding * 2
      const lineH = fontSize + padding * 2

      const blockX = sx * canvasW
      const blockY = sy * canvasH

      stampTexts.forEach((text, i) => {
        const y = blockY + i * lineH

        context.fillStyle = 'rgba(255, 255, 255, 0.9)'
        context.fillRect(blockX, y, boxW, lineH)
        context.strokeStyle = 'rgba(150, 150, 150, 0.8)'
        context.lineWidth = 0.5 * scale
        context.strokeRect(blockX, y, boxW, lineH)
        context.fillStyle = 'rgba(200, 0, 0, 1)'
        context.fillText(text, blockX + padding, y + padding + fontSize * 0.85)
      })

      // Stocker le bloc entier pour le drag
      const totalH = N * lineH
      lastStamp.current = {
        cx: blockX + boxW / 2,
        cy: blockY + totalH / 2,
        w: boxW,
        h: totalH,
        rad: 0
      }
      return
    }

    // Mode simple (code existant inchange)
    if (!accountNumber) {
      lastStamp.current = null
      return
    }
    // ... reste du code existant ...
  },
  [scale]
)
```

**Step 2: Bloquer la rotation molette en mode ventile**

Dans `wheelHandler.current`, ajouter au debut :

```typescript
if (useAppStore.getState().ventilationEnabled) return
```

**Step 3: Ajouter ventilationEnabled et ventilationLines aux deps de re-render**

Modifier le useEffect de re-render du tampon :

```typescript
useEffect(() => {
  if (pdfDoc && currentPage === 1) {
    renderPage(pdfDoc, 1)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentFormData.accountNumber, currentFormData.accountLabel, stampX, stampY, stampRotation, ventilationEnabled, ventilationLines])
```

Ajouter les extractions du store :
```typescript
const { currentPdfPath, currentFormData, stampX, stampY, stampRotation, setStampPosition, setStampRotation, ventilationEnabled, ventilationLines } = useAppStore()
```

**Step 4: Verifier le typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/src/components/PdfPreview.tsx
git commit -m "feat: add multi-stamp preview and disable rotation in ventilation mode"
```

---

### Task 7: Test manuel et polish

**Files:**
- Aucun nouveau fichier

**Step 1: Lancer l'app**

Run: `npm run dev`

**Step 2: Test mode simple**

- Charger un PDF
- Saisir fournisseur + compte + date + montant
- Verifier que le tampon unique fonctionne comme avant (drag, rotation, position)
- Valider et verifier le PDF genere

**Step 3: Test mode ventile**

- Charger un PDF
- Activer le toggle "Ventilation"
- Ajouter 2 lignes (ex: 601100/Fournitures/100HT/20%TVA + 602200/Outillage/50HT/20%TVA)
- Verifier la preview : 2 tampons empiles
- Verifier la zone recap : sommes HT/TTC + ecart avec IA
- Verifier que la molette ne tourne pas le bloc
- Verifier que le drag fonctionne sur le bloc
- Valider et verifier le PDF genere (2 tampons)

**Step 4: Test toggle OFF**

- Activer ventilation, saisir des lignes
- Desactiver le toggle
- Verifier que le form est reset et l'IA relancee

**Step 5: Test edge cases**

- Supprimer toutes les lignes (doit en recreer une)
- Montant IA absent : pas de controle d'ecart
- Ecart non nul : fond rouge, bouton Valider desactive
- 8+ lignes (si possible)

**Step 6: Fix et polish si necessaire**

Corriger les problemes trouves lors des tests.

**Step 7: Commit final**

```bash
git add -A
git commit -m "feat: ventilation multi-comptes -- polish and edge case fixes"
```
