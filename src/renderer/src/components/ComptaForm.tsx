import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SaveMappingDialog } from '@/components/SaveMappingDialog'
import { AccountCombobox } from '@/components/AccountCombobox'
import { SplitLines } from '@/components/SplitLines'
import type { SplitLine } from '@/components/SplitLines'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, FolderTree, Loader2, Sparkles, X } from 'lucide-react'
import { sanitizeFileName, parseIsoDate } from '@/lib/sanitize'

interface SupplierMapping {
  invoiceName: string
  shortName: string
  defaultAccount: string
  defaultAccountLabel: string
}

export function ComptaForm(): React.JSX.Element {
  const {
    currentFormData,
    setFormData,
    destinationFolder,
    isProcessing,
    setIsProcessing,
    fileQueue,
    currentIndex,
    removeCurrentFile,
    resetForm,
    currentPdfPath,
    setCurrentPdfPath,
    aiExtractedSupplier,
    aiProcessing,
    setAiProcessing,
    setVentilationEnabled: setStoreVentilation,
    setVentilationLines
  } = useAppStore()

  // Supplier autocomplete
  const [supplierQuery, setSupplierQuery] = useState('')
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)
  const [supplierMappings, setSupplierMappings] = useState<SupplierMapping[]>([])
  const supplierSuggestionsRef = useRef<HTMLDivElement>(null)
  const supplierInputRef = useRef<HTMLInputElement>(null)
  const adjustableRef = useRef<HTMLInputElement>(null)
  const [highlightAdjustable, setHighlightAdjustable] = useState(false)

  // Messages & auto-learn
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [showSaveMapping, setShowSaveMapping] = useState(false)
  const [pendingSaveData, setPendingSaveData] = useState<{
    supplier: string
    shortName: string
    account: string
    accountLabel: string
  } | null>(null)

  const [includeAmount, setIncludeAmount] = useState(false)
  const [stampIncludeLabel, setStampIncludeLabel] = useState(false)
  const [useQuarterMode, setUseQuarterMode] = useState(false)
  const processingGuard = useRef(false)
  const [customDestFolder, setCustomDestFolder] = useState<string | null>(null)
  const currentFile = fileQueue[currentIndex]

  // Ventilation state
  const [ventilationEnabled, setVentilationLocalEnabled] = useState(false)
  const splitLinesRef = useRef<SplitLine[]>([])
  const [splitBalanced, setSplitBalanced] = useState(true)
  const [splitLinesValid, setSplitLinesValid] = useState(false)
  const [aiAmountType, setAiAmountType] = useState<'ht' | 'ttc'>('ttc')
  const lastAiSuggestionRef = useRef<Record<string, string> | null>(null)

  // Load settings
  useEffect(() => {
    window.api.getIncludeAmount().then(setIncludeAmount)
    window.api.getStampIncludeLabel().then(setStampIncludeLabel)
    window.api.getUseQuarterMode().then(setUseQuarterMode)
  }, [])

  // Load supplier mappings
  useEffect(() => {
    window.api.getSupplierMappings().then(setSupplierMappings)
  }, [])

  // Reload mappings after saving one
  const reloadMappings = useCallback(async () => {
    const m = await window.api.getSupplierMappings()
    setSupplierMappings(m)
  }, [])

  // Filter supplier suggestions
  const supplierSuggestions = useMemo(() => {
    if (!supplierQuery) return supplierMappings.slice(0, 10)
    const q = supplierQuery.toLowerCase()
    return supplierMappings.filter(
      (m) =>
        m.shortName.toLowerCase().includes(q) ||
        m.invoiceName.toLowerCase().includes(q) ||
        m.defaultAccount.startsWith(q)
    )
  }, [supplierQuery, supplierMappings])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      const target = e.target as Node
      if (
        supplierSuggestionsRef.current &&
        !supplierSuggestionsRef.current.contains(target) &&
        supplierInputRef.current &&
        !supplierInputRef.current.contains(target)
      ) {
        setShowSupplierSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Clear message after timeout
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 9000)
      return (): void => clearTimeout(timer)
    }
    return undefined
  }, [message])

  // Sync supplierQuery when form fixedPart changes externally (e.g. from AI)
  useEffect(() => {
    if (currentFormData.fixedPart && supplierQuery !== currentFormData.fixedPart) {
      setSupplierQuery(currentFormData.fixedPart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormData.fixedPart])

  // --- Account handler ---
  const handleSelectAccount = (numero: string, libelle: string): void => {
    setFormData({ accountNumber: numero, accountLabel: libelle })
  }

  // --- Supplier handlers ---
  const handleSelectSupplier = (mapping: SupplierMapping): void => {
    setSupplierQuery(mapping.shortName)
    setFormData({
      fixedPart: mapping.shortName,
      accountNumber: mapping.defaultAccount,
      accountLabel: mapping.defaultAccountLabel
    })
    setShowSupplierSuggestions(false)
  }

  const handleSupplierInputChange = (value: string): void => {
    setSupplierQuery(value)
    setFormData({ fixedPart: value })
    setShowSupplierSuggestions(true)
  }

  // --- Quarter helper ---
  const getQuarterLabel = (monthNum: number): string => {
    if (monthNum <= 3) return 'T1'
    if (monthNum <= 6) return 'T2'
    if (monthNum <= 9) return 'T3'
    return 'T4'
  }

  // --- Path preview ---
  const pathPreview = useMemo(() => {
    if (!destinationFolder || !currentFormData.date) return null
    const parsed = parseIsoDate(currentFormData.date)
    if (!parsed) return null

    const { year, month: monthNum } = parsed
    const period = useQuarterMode
      ? getQuarterLabel(monthNum)
      : String(monthNum).padStart(2, '0')
    const parts = [currentFormData.fixedPart, currentFormData.adjustablePart]
    if (includeAmount && currentFormData.amount) {
      parts.push(currentFormData.amount)
    }
    const effectiveBase = (customDestFolder || destinationFolder).replace(/\/+$/, '')
    const fileName = sanitizeFileName(parts.filter(Boolean).join(' - '), {
      destFolderLength: effectiveBase.length + (customDestFolder ? 0 : `/${year}/${period}`.length)
    })
    const fullFileName = fileName ? `${fileName}.pdf` : '(nom de fichier incomplet)'
    const lastDir = effectiveBase.split(/[/\\]/).pop() || effectiveBase
    const subPath = customDestFolder ? '' : `${year}/${period}`
    const full = subPath
      ? `${effectiveBase}/${subPath}/${fullFileName}`
      : `${effectiveBase}/${fullFileName}`
    const short = subPath
      ? `${lastDir}/${subPath}/${fullFileName}`
      : `${lastDir}/${fullFileName}`
    return { full, short, isCustom: !!customDestFolder }
  }, [
    destinationFolder,
    customDestFolder,
    currentFormData.date,
    currentFormData.fixedPart,
    currentFormData.adjustablePart,
    currentFormData.amount,
    includeAmount,
    useQuarterMode
  ])

  const dateLabel = currentFormData.date
    ? (() => {
        const p = parseIsoDate(currentFormData.date)
        if (!p) return ''
        return format(new Date(p.year, p.month - 1, p.day), 'EEEE d MMMM yyyy', { locale: fr })
      })()
    : ''

  const canValidate =
    currentFormData.date &&
    currentFormData.fixedPart &&
    currentPdfPath &&
    destinationFolder &&
    !isProcessing &&
    (ventilationEnabled ? splitLinesValid && splitBalanced : !!currentFormData.accountNumber)

  // --- Toggle ventilation ---
  const handleToggleVentilation = useCallback((enabled: boolean) => {
    setVentilationLocalEnabled(enabled)
    setStoreVentilation(enabled)
    if (!enabled) {
      // Toggle OFF : reset + restaurer la derniere suggestion IA (sans refaire l'appel API)
      splitLinesRef.current = []
      setVentilationLines([])
      setSplitBalanced(true)
      setSplitLinesValid(false)
      resetForm()
      setSupplierQuery('')
      // Restaurer la derniere suggestion IA si disponible
      if (lastAiSuggestionRef.current) {
        const s = lastAiSuggestionRef.current
        setFormData({
          ...(s.accountNumber && { accountNumber: s.accountNumber }),
          ...(s.accountLabel && { accountLabel: s.accountLabel }),
          ...(s.date && { date: s.date }),
          ...(s.fixedPart && { fixedPart: s.fixedPart }),
          ...(s.adjustablePart && { adjustablePart: s.adjustablePart }),
          ...(s.amount && { amount: s.amount })
        })
        if (s.fixedPart) setSupplierQuery(s.fixedPart)
      }
    }
  }, [resetForm, setFormData, setStoreVentilation, setVentilationLines])

  // --- SplitLines onChange ---
  const handleSplitChange = useCallback((lines: SplitLine[], isBalanced: boolean) => {
    splitLinesRef.current = lines
    setSplitBalanced(isBalanced)
    setSplitLinesValid(lines.length > 0 && lines.every(l => l.accountNumber && l.amountTTC))
    setVentilationLines(lines.filter(l => l.accountNumber && l.amountTTC).map(l => ({
      accountNumber: l.accountNumber,
      accountLabel: l.accountLabel,
      amount: l.amountTTC
    })))
  }, [setVentilationLines])

  // --- Validate ---
  const handleValidate = useCallback(async () => {
    if (!canValidate || !currentPdfPath || !destinationFolder) return
    if (processingGuard.current) return
    processingGuard.current = true

    setIsProcessing(true)
    setMessage(null)

    try {
      const nameParts = [currentFormData.fixedPart, currentFormData.adjustablePart]
      if (includeAmount && currentFormData.amount) {
        nameParts.push(currentFormData.amount)
      }
      const effectiveBase = (customDestFolder || destinationFolder).replace(/\/+$/, '')
      let destPath: string
      let fileName: string
      if (customDestFolder) {
        fileName = sanitizeFileName(nameParts.filter(Boolean).join(' - '), {
          destFolderLength: effectiveBase.length
        })
        destPath = `${effectiveBase}/${fileName}.pdf`
      } else {
        const parsed = parseIsoDate(currentFormData.date)
        if (!parsed) {
          setIsProcessing(false)
          processingGuard.current = false
          setMessage({ type: 'error', text: 'Date invalide' })
          return
        }
        const { year, month: monthNum } = parsed
        const period = useQuarterMode
          ? getQuarterLabel(monthNum)
          : String(monthNum).padStart(2, '0')
        fileName = sanitizeFileName(nameParts.filter(Boolean).join(' - '), {
          destFolderLength: `${effectiveBase}/${year}/${period}`.length
        })
        destPath = `${effectiveBase}/${year}/${period}/${fileName}.pdf`

        // Detect folder mode conflict
        const folderMode = await window.api.checkFolderMode(effectiveBase, String(year))
        if (folderMode === 'month' && useQuarterMode) {
          setIsProcessing(false)
          processingGuard.current = false
          setMessage({
            type: 'warning',
            text: `Le dossier ${year}/ contient des sous-dossiers mensuels (01, 02...) mais le mode trimestre est actif. Desactivez le mode trimestre dans les parametres ou forcez en cliquant a nouveau sur Valider.`
          })
          return
        }
        if (folderMode === 'quarter' && !useQuarterMode) {
          setIsProcessing(false)
          processingGuard.current = false
          setMessage({
            type: 'warning',
            text: `Le dossier ${year}/ contient des sous-dossiers trimestriels (T1, T2...) mais le mode mensuel est actif. Activez le mode trimestre dans les parametres ou forcez en cliquant a nouveau sur Valider.`
          })
          return
        }
      }

      // Check if destination file already exists
      const exists = await window.api.checkFileExists(destPath)
      if (exists) {
        setIsProcessing(false)
        processingGuard.current = false
        setMessage({
          type: 'warning',
          text: `Un fichier "${fileName}.pdf" existe deja a cette destination. Modifiez la partie ajustable pour eviter l'ecrasement.`
        })
        setHighlightAdjustable(true)
        setTimeout(() => adjustableRef.current?.focus(), 50)
        return
      }

      const ventilation = ventilationEnabled
        ? splitLinesRef.current.filter(l => l.accountNumber && l.amountTTC).map(l => ({
            accountNumber: l.accountNumber,
            accountLabel: l.accountLabel,
            amount: l.amountTTC
          }))
        : undefined

      const { stampX, stampY, stampRotation } = useAppStore.getState()
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
        ventilation,
        stampIncludeLabel
      })

      if (result.success) {
        if (result.warning) {
          setMessage({ type: 'warning', text: result.warning })
        } else {
          setMessage({ type: 'success', text: `Classe dans: ${result.destinationPath}` })
        }

        // Auto-learn: propose saving mapping if it doesn't exist yet
        const supplierName = aiExtractedSupplier || currentFormData.fixedPart
        if (supplierName && currentFormData.fixedPart) {
          const mappings = await window.api.getSupplierMappings()
          const exists = mappings.some(
            (m) =>
              m.shortName.toLowerCase() === currentFormData.fixedPart.toLowerCase() ||
              m.invoiceName.toLowerCase() === supplierName.toLowerCase()
          )
          if (!exists) {
            const accountForMapping = ventilationEnabled
              ? (ventilation?.[0]?.accountNumber ?? '')
              : currentFormData.accountNumber
            const accountLabelForMapping = ventilationEnabled
              ? (ventilation?.[0]?.accountLabel ?? '')
              : currentFormData.accountLabel
            setPendingSaveData({
              supplier: aiExtractedSupplier || currentFormData.fixedPart,
              shortName: currentFormData.fixedPart,
              account: accountForMapping,
              accountLabel: accountLabelForMapping
            })
            setShowSaveMapping(true)
          }
        }

        removeCurrentFile()
        resetForm()
        setSupplierQuery('')
        setCustomDestFolder(null)
        setVentilationLocalEnabled(false)
        splitLinesRef.current = []
        setSplitBalanced(true)
        setSplitLinesValid(false)

        const state = useAppStore.getState()
        if (state.fileQueue.length > 0) {
          const nextFile = state.fileQueue[state.currentIndex]
          if (nextFile) {
            const pdfPath = await window.api.ensurePdf(nextFile.path)
            setCurrentPdfPath(pdfPath)
          }
        } else {
          setCurrentPdfPath(null)
        }
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Erreur: ${err instanceof Error ? err.message : String(err)}`
      })
    } finally {
      setIsProcessing(false)
      processingGuard.current = false
    }
  }, [
    canValidate,
    currentPdfPath,
    destinationFolder,
    currentFormData,
    aiExtractedSupplier,
    removeCurrentFile,
    resetForm,
    setCurrentPdfPath,
    setIsProcessing,
    ventilationEnabled,
    splitBalanced,
    splitLinesValid,
    includeAmount,
    useQuarterMode
  ])

  const handleSaveMapping = async (mapping: {
    invoiceName: string
    shortName: string
    defaultAccount: string
    defaultAccountLabel: string
  }): Promise<void> => {
    await window.api.addSupplierMapping(mapping)
    setShowSaveMapping(false)
    setPendingSaveData(null)
    reloadMappings()
  }

  const handleAiReread = useCallback(async () => {
    if (!currentPdfPath || aiProcessing) return
    setAiProcessing(true)
    try {
      const suggestion = await window.api.aiPreProcess(currentPdfPath)
      if (suggestion) {
        lastAiSuggestionRef.current = {
          accountNumber: suggestion.accountNumber || '',
          accountLabel: suggestion.accountLabel || '',
          date: suggestion.date || '',
          fixedPart: suggestion.fixedPart || '',
          adjustablePart: suggestion.adjustablePart || '',
          amount: suggestion.amount || ''
        }
        if (suggestion.amountType) setAiAmountType(suggestion.amountType)
        setFormData({
          ...(suggestion.accountNumber && { accountNumber: suggestion.accountNumber }),
          ...(suggestion.accountLabel && { accountLabel: suggestion.accountLabel }),
          ...(suggestion.date && parseIsoDate(suggestion.date) && { date: suggestion.date }),
          ...(suggestion.fixedPart && { fixedPart: suggestion.fixedPart }),
          ...(suggestion.adjustablePart && { adjustablePart: suggestion.adjustablePart }),
          ...(suggestion.amount && { amount: suggestion.amount })
        })
        if (suggestion.fixedPart) setSupplierQuery(suggestion.fixedPart)
        if (suggestion.rawText) {
          try {
            const parsed = JSON.parse(suggestion.rawText)
            if (parsed.supplierName) {
              useAppStore.getState().setAiExtractedSupplier(parsed.supplierName)
            }
          } catch {
            // not JSON
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('AI_NO_CREDIT')) {
        setMessage({ type: 'error', text: 'Credit API Claude epuise. Rechargez votre compte sur console.anthropic.com' })
      } else if (msg.includes('AI_RATE_LIMIT')) {
        setMessage({ type: 'error', text: 'Trop de requetes IA. Reessayez dans quelques secondes.' })
      } else if (msg.includes('AI_AUTH_ERROR')) {
        setMessage({ type: 'error', text: 'Cle API Claude invalide. Verifiez dans les parametres.' })
      } else if (msg.includes('AI_NETWORK_ERROR')) {
        setMessage({ type: 'error', text: 'Impossible de contacter l\'API Claude. Verifiez votre connexion.' })
      } else if (msg.includes('AI_API_ERROR')) {
        setMessage({ type: 'error', text: 'Erreur de l\'API Claude. Reessayez.' })
      }
    } finally {
      setAiProcessing(false)
    }
  }, [currentPdfPath, aiProcessing, setAiProcessing, setFormData])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Informations comptables</h2>
          <button
            type="button"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
            onClick={handleAiReread}
            disabled={aiProcessing || !currentPdfPath}
            title="Relecture IA"
          >
            <Sparkles className={`h-4 w-4 ${aiProcessing ? 'ai-pulse' : 'text-fuchsia-500'}`} />
          </button>
        </div>
        {currentFile && (
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {currentFile.name}
          </span>
        )}
      </div>

      {/* Success/Warning/Error message (sauf fichier existant, affiche sous partie ajustable) */}
      {message && !(highlightAdjustable && message.type === 'warning' && message.text.includes('existe deja')) && (
        <div
          className={`rounded-md p-3 text-sm flex items-start gap-2 ${
            message.type === 'success'
              ? 'bg-success/10 text-success border border-success/20'
              : message.type === 'warning'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="shrink-0 hover:opacity-70 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Auto-learn dialog */}
      {showSaveMapping && pendingSaveData && (
        <SaveMappingDialog
          supplierName={pendingSaveData.supplier}
          shortName={pendingSaveData.shortName}
          accountNumber={pendingSaveData.account}
          accountLabel={pendingSaveData.accountLabel}
          onSave={handleSaveMapping}
          onDismiss={() => {
            setShowSaveMapping(false)
            setPendingSaveData(null)
          }}
        />
      )}

      {/* Supplier selector with autocomplete from mappings */}
      <div className="space-y-2 relative">
        <Label htmlFor="fixedPart">Fournisseur / tiers</Label>
        <Input
          id="fixedPart"
          ref={supplierInputRef}
          placeholder="Tapez un nom de fournisseur..."
          value={supplierQuery}
          onChange={(e) => handleSupplierInputChange(e.target.value)}
          onFocus={() => {
            if (supplierMappings.length > 0) setShowSupplierSuggestions(true)
          }}
          autoComplete="off"
        />
        {showSupplierSuggestions && supplierSuggestions.length > 0 && (
          <div
            ref={supplierSuggestionsRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-md"
          >
            {supplierSuggestions.map((mapping) => (
              <button
                key={mapping.invoiceName}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left cursor-pointer"
                onClick={() => handleSelectSupplier(mapping)}
              >
                <span className="font-medium min-w-[60px]">{mapping.shortName}</span>
                <span className="text-muted-foreground truncate">{mapping.invoiceName}</span>
                {mapping.defaultAccount && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {mapping.defaultAccount}
                  </span>
                )}
                {currentFormData.fixedPart === mapping.shortName && (
                  <Check className="h-3 w-3 text-success" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date">Date du document</Label>
        <Input
          id="date"
          type="date"
          value={currentFormData.date}
          onChange={(e) => setFormData({ date: e.target.value })}
        />
        {dateLabel && <p className="text-xs text-muted-foreground capitalize">{dateLabel}</p>}
      </div>

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

      {ventilationEnabled ? (
        <SplitLines
          aiTotalTTC={currentFormData.amount}
          aiAmountType={aiAmountType}
          onChange={handleSplitChange}
          initialAccount={
            currentFormData.accountNumber
              ? { number: currentFormData.accountNumber, label: currentFormData.accountLabel }
              : undefined
          }
        />
      ) : (
        <>
          {/* Account selector combobox */}
          <div className="space-y-2">
            <Label>Compte comptable</Label>
            <AccountCombobox
              accountNumber={currentFormData.accountNumber}
              accountLabel={currentFormData.accountLabel}
              onSelect={handleSelectAccount}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Montant TTC</Label>
            <Input
              id="amount"
              placeholder="Ex: 186.57"
              value={currentFormData.amount}
              onChange={(e) => setFormData({ amount: e.target.value.replace(',', '.') })}
            />
          </div>
        </>
      )}

      {/* Adjustable part */}
      <div className="space-y-2">
        <Label htmlFor="adjustablePart">Partie ajustable (n° de facture, mois...)</Label>
        <Input
          id="adjustablePart"
          ref={adjustableRef}
          placeholder="Ex: FAC-2026-001, Janvier..."
          value={currentFormData.adjustablePart}
          onChange={(e) => {
            setFormData({ adjustablePart: e.target.value })
            if (highlightAdjustable) {
              setHighlightAdjustable(false)
              if (message?.type === 'warning' && message.text.includes('existe deja')) setMessage(null)
            }
          }}
          className={highlightAdjustable ? 'border-amber-500 ring-2 ring-amber-500/30' : ''}
        />
        {highlightAdjustable && message?.type === 'warning' && message.text.includes('existe deja') && (
          <p className="text-xs text-amber-500">{message.text}</p>
        )}
      </div>

      {/* Path preview - clickable to change destination */}
      {pathPreview && (
        <div
          className="rounded-md border border-border bg-muted/50 p-3 space-y-1 cursor-pointer hover:bg-muted/80 transition-colors"
          onClick={async () => {
            const folder = await window.api.selectDestinationFolder()
            if (folder) {
              setCustomDestFolder(folder)
            }
          }}
          title="Cliquer pour choisir un autre dossier de destination"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FolderTree className="h-3.5 w-3.5" />
              Destination
            </div>
            {pathPreview.isCustom && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  setCustomDestFolder(null)
                }}
              >
                Reinitialiser
              </button>
            )}
          </div>
          <p className="text-sm font-mono break-all">{pathPreview.short}</p>
        </div>
      )}

      {/* Validate button */}
      <Button className="w-full" disabled={!canValidate} onClick={handleValidate}>
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Traitement en cours...
          </>
        ) : (
          'Valider et classer'
        )}
      </Button>
    </div>
  )
}
