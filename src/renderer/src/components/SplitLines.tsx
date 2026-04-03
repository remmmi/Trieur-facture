import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { AccountCombobox } from '@/components/AccountCombobox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
  aiAmountType?: 'ht' | 'ttc'
  onChange: (lines: SplitLine[], isBalanced: boolean) => void
  initialAccount?: { number: string; label: string }
}

const TVA_RATES = ['20', '10', '5.5', '2.1', '0']

function emptyLine(accountNumber = '', accountLabel = ''): SplitLine {
  return {
    id: crypto.randomUUID(),
    accountNumber,
    accountLabel,
    tvaRate: '20',
    amountHT: '',
    amountTTC: '',
    lastEdited: 'ttc'
  }
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(',', '.')) || 0
}

export function SplitLines({ aiTotalTTC, aiAmountType = 'ttc', onChange, initialAccount }: SplitLinesProps): React.JSX.Element {
  const [lines, setLines] = useState<SplitLine[]>([
    emptyLine(initialAccount?.number ?? '', initialAccount?.label ?? '')
  ])

  const notifyParent = useCallback(
    (nextLines: SplitLine[]) => {
      const sumTTC = nextLines.reduce((acc, l) => acc + parseAmount(l.amountTTC), 0)
      const aiTotal = parseAmount(aiTotalTTC)
      const balanced = !aiTotalTTC || Math.abs(sumTTC - aiTotal) < 0.01
      onChange(nextLines, balanced)
    },
    [aiTotalTTC, onChange]
  )

  const updateLine = (id: string, field: keyof SplitLine, rawValue: string): void => {
    const value = typeof rawValue === 'string' ? rawValue.replace(',', '.') : rawValue

    const next = lines.map((line) => {
      if (line.id !== id) return line

      const updated = { ...line, [field]: value }

      if (field === 'amountHT') {
        updated.lastEdited = 'ht'
        const ht = parseFloat(value) || 0
        const rate = parseFloat(updated.tvaRate) || 0
        updated.amountTTC = value === '' ? '' : round2(ht * (1 + rate / 100))
      } else if (field === 'amountTTC') {
        updated.lastEdited = 'ttc'
        const ttc = parseFloat(value) || 0
        const rate = parseFloat(updated.tvaRate) || 0
        updated.amountHT = value === '' ? '' : round2(ttc / (1 + rate / 100))
      } else if (field === 'tvaRate') {
        const rate = parseFloat(value) || 0
        if (line.lastEdited === 'ht' && updated.amountHT !== '') {
          const ht = parseAmount(updated.amountHT)
          updated.amountTTC = round2(ht * (1 + rate / 100))
        } else if (updated.amountTTC !== '') {
          const ttc = parseAmount(updated.amountTTC)
          updated.amountHT = round2(ttc / (1 + rate / 100))
        }
      }

      return updated
    })

    setLines(next)
    notifyParent(next)
  }

  const updateAccount = (id: string, number: string, label: string): void => {
    const next = lines.map((line) =>
      line.id === id ? { ...line, accountNumber: number, accountLabel: label } : line
    )
    setLines(next)
    notifyParent(next)
  }

  const addLine = (): void => {
    const next = [...lines, emptyLine()]
    setLines(next)
    notifyParent(next)
  }

  const removeLine = (id: string): void => {
    if (lines.length === 1) return
    let next = lines.filter((l) => l.id !== id)
    if (next.length === 0) next = [emptyLine()]
    setLines(next)
    notifyParent(next)
  }

  const fillRemainder = (): void => {
    if (lines.length < 2) return
    const aiTotal = parseAmount(aiTotalTTC)
    if (!aiTotal) return

    const lastIndex = lines.length - 1
    const lastLine = lines[lastIndex]
    // Somme des cards precedentes (toutes sauf la derniere)
    const previousSum = aiAmountType === 'ht'
      ? lines.slice(0, lastIndex).reduce((acc, l) => acc + parseAmount(l.amountHT), 0)
      : lines.slice(0, lastIndex).reduce((acc, l) => acc + parseAmount(l.amountTTC), 0)
    const remainder = Math.max(0, aiTotal - previousSum)

    // Utiliser le taux TVA de la card precedente si la derniere n'en a pas de custom
    const prevRate = lines.length >= 2 ? lines[lastIndex - 1].tvaRate : lastLine.tvaRate
    const rate = parseFloat(prevRate) || 0
    const factor = 1 + rate / 100

    let updatedLine: SplitLine
    if (aiAmountType === 'ht') {
      const ht = remainder
      updatedLine = { ...lastLine, tvaRate: prevRate, amountHT: round2(ht), amountTTC: round2(ht * factor), lastEdited: 'ht' }
    } else {
      const ttc = remainder
      updatedLine = { ...lastLine, tvaRate: prevRate, amountHT: round2(ttc / factor), amountTTC: round2(ttc), lastEdited: 'ttc' }
    }

    const next = [...lines.slice(0, lastIndex), updatedLine]
    setLines(next)
    notifyParent(next)
  }

  const sumHT = lines.reduce((acc, l) => acc + parseAmount(l.amountHT), 0)
  const sumTTC = lines.reduce((acc, l) => acc + parseAmount(l.amountTTC), 0)
  const aiTotal = parseAmount(aiTotalTTC)
  const compareSum = aiAmountType === 'ht' ? sumHT : sumTTC
  const gap = aiTotalTTC ? compareSum - aiTotal : null
  const isBalanced = gap !== null ? Math.abs(gap) < 0.01 : true
  const isLastLine = lines.length >= 2
  const canFillRemainder = isLastLine && !!aiTotalTTC && !isBalanced

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, index) => (
        <div key={line.id} className="relative bg-muted/30 rounded-md border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Ligne {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeLine(line.id)}
              disabled={lines.length === 1}
              className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Supprimer cette ligne"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-2">
            <AccountCombobox
              accountNumber={line.accountNumber}
              accountLabel={line.accountLabel}
              onSelect={(number, label) => updateAccount(line.id, number, label)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                TVA %
              </Label>
              <select
                value={line.tvaRate}
                onChange={(e) => updateLine(line.id, 'tvaRate', e.target.value)}
                className={cn(
                  'h-7 w-full rounded-md border border-input bg-background px-2 text-xs',
                  'text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'cursor-pointer'
                )}
              >
                {TVA_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r} %
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Montant HT
              </Label>
              <Input
                className="h-7 text-xs"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={line.amountHT}
                onChange={(e) => updateLine(line.id, 'amountHT', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Montant TTC
              </Label>
              <Input
                className="h-7 text-xs"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={line.amountTTC}
                onChange={(e) => updateLine(line.id, 'amountTTC', e.target.value)}
              />
            </div>
          </div>

          {/* Bouton "le reste" sur la derniere card uniquement */}
          {index === lines.length - 1 && canFillRemainder && (
            <button
              type="button"
              onClick={fillRemainder}
              className="mt-2 w-full text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded px-2 py-1 transition-colors cursor-pointer border border-border/50"
            >
              Le reste ({round2(Math.abs(gap ?? 0))} {aiAmountType.toUpperCase()})
            </button>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addLine}
        className="w-full border-dashed text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter une ligne
      </Button>

      <div
        className={cn(
          'rounded-md px-3 py-2 text-xs flex flex-col gap-0.5',
          isBalanced
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-red-500/10 border border-red-500/20'
        )}
      >
        <div className="flex justify-between text-muted-foreground">
          <span className="uppercase tracking-wide text-[10px]">Total HT</span>
          <span className="font-mono">{round2(sumHT)}</span>
        </div>
        <div className="flex justify-between">
          <span className="uppercase tracking-wide text-[10px] text-muted-foreground">Total TTC</span>
          <span className="font-mono font-medium">{round2(sumTTC)}</span>
        </div>
        {gap !== null && (
          <div className="flex justify-between mt-0.5 pt-0.5 border-t border-border/50">
            <span className="uppercase tracking-wide text-[10px] text-muted-foreground">
              Ecart vs IA ({aiAmountType.toUpperCase()})
            </span>
            <span
              className={cn(
                'font-mono text-[10px]',
                isBalanced ? 'text-emerald-500' : 'text-red-400 gap-flash'
              )}
            >
              {gap >= 0 ? '+' : ''}{round2(gap)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
