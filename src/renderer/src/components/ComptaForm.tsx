import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SaveMappingDialog } from '@/components/SaveMappingDialog'
import { OrphanAccountDialog } from '@/components/OrphanAccountDialog'
import { AccountCombobox } from '@/components/AccountCombobox'
import { SplitLines } from '@/components/SplitLines'
import type { SplitLine } from '@/components/SplitLines'
import { format, parse } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Check, FolderTree, Loader2, Sparkles, X } from 'lucide-react'
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
    setVentilationLines,
    ignoreCurrentFile
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
  const [filingGranularity, setFilingGranularity] = useState<'month' | 'quarter' | 'quarter-month'>('month')
  const [prefixAccount, setPrefixAccount] = useState(false)
  const [paymentModeOptions, setPaymentModeOptions] = useState<string[]>(['CB', 'Virement', 'Prelevement'])
  const [usePaymentDateFiling, setUsePaymentDateFiling] = useState(false)
  const processingGuard = useRef(false)
  const [customDestFolder, setCustomDestFolder] = useState<string | null>(null)
  const currentFile = fileQueue[currentIndex]

  // Orphan account dialog
  const [orphanDialog, setOrphanDialog] = useState<{
    mapping: SupplierMapping
  } | null>(null)

  // Ventilation state
  const [ventilationEnabled, setVentilationLocalEnabled] = useState(false)
  const splitLinesRef = useRef<SplitLine[]>([])
  const [splitBalanced, setSplitBalanced] = useState(true)
  const [splitLinesValid, setSplitLinesValid] = useState(false)
  const [aiAmountType, setAiAmountType] = useState<'ht' | 'ttc'>('ttc')
  const lastAiSuggestionRef = useRef<Record<string, string> | null>(null)

  // Plan comptable reactif via IPC
  const [currentPlan, setCurrentPlan] = useState<{ numero: string; libelle: string }[]>([])

  useEffect(() => {
    const loadPlan = async (): Promise<void> => {
      const custom = await window.api.getPlanComptable()
      if (custom && custom.length > 0) {
        setCurrentPlan(custom)
      } else {
        const { planComptable: defaultPlan } = await import('@/data/planComptable')
        setCurrentPlan(defaultPlan)
      }
    }
    loadPlan()
  }, [])

  // Load settings
  useEffect(() => {
    window.api.getIncludeAmount().then(setIncludeAmount)
    window.api.getStampIncludeLabel().then(setStampIncludeLabel)
    window.api.getUseQuarterMode().then(setUseQuarterMode)
    window.api.getFilingGranularity().then(setFilingGranularity)
    window.api.getPrefixAccount().then(setPrefixAccount)
    window.api.getPaymentModes().then((modes) => {
      const list = modes.split('|').map((m) => m.trim()).filter(Boolean)
      if (list.length > 0) setPaymentModeOptions(list)
    })
    window.api.getUsePaymentDateFiling().then(setUsePaymentDateFiling)
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

  // --- Orphan account helpers ---
  const isOrphanAccount = (accountNumber: string): boolean => {
    if (!accountNumber) return false
    return !currentPlan.some((c) => c.numero === accountNumber)
  }

  const checkAndShowOrphanDialog = (mapping: SupplierMapping): void => {
    if (mapping.defaultAccount && isOrphanAccount(mapping.defaultAccount)) {
      setOrphanDialog({ mapping })
    }
  }

  // Detect orphan account when AI auto-fills the form at document load
  // Runs when accountNumber arrives from an external source (App.tsx via store)
  const prevAutoFillKey = useRef<string>('')

  // Reset la cle de deduplication a chaque changement de document
  useEffect(() => {
    prevAutoFillKey.current = ''
  }, [currentPdfPath])

  // Reset complet de l'etat local ventilation au changement de document
  useEffect(() => {
    setVentilationLocalEnabled(false)
    setStoreVentilation(false)
    splitLinesRef.current = []
    setSplitBalanced(true)
    setSplitLinesValid(false)
    setVentilationLines([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPdfPath])

  useEffect(() => {
    const { accountNumber, fixedPart } = currentFormData
    if (!accountNumber || !fixedPart || supplierMappings.length === 0) return
    // Build a key to avoid re-triggering on the same values
    const key = `${fixedPart}::${accountNumber}`
    if (key === prevAutoFillKey.current) return
    prevAutoFillKey.current = key
    // Only act when the account is orphan and came from a known mapping
    if (!isOrphanAccount(accountNumber)) return
    const matchedMapping = supplierMappings.find(
      (m) =>
        m.shortName.toLowerCase() === fixedPart.toLowerCase() ||
        m.invoiceName.toLowerCase() === fixedPart.toLowerCase()
    )
    if (matchedMapping) {
      setOrphanDialog({ mapping: matchedMapping })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormData.accountNumber, currentFormData.fixedPart, supplierMappings])

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
    checkAndShowOrphanDialog(mapping)
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

  // --- Filing date: emission or payment depending on mode ---
  const filingDate = usePaymentDateFiling && currentFormData.paymentDate
    ? currentFormData.paymentDate
    : currentFormData.date

  // --- Path preview ---
  const pathPreview = useMemo(() => {
    if (!destinationFolder || !filingDate) return null
    const parsed = parseIsoDate(filingDate)
    if (!parsed) return null

    const { year, month: monthNum } = parsed
    const monthStr = String(monthNum).padStart(2, '0')
    const quarterStr = getQuarterLabel(monthNum)
    const period = filingGranularity === 'quarter-month'
      ? `${quarterStr}/${monthStr}`
      : filingGranularity === 'quarter'
        ? quarterStr
        : monthStr
    const parts: string[] = []
    if (prefixAccount) {
      if (ventilationEnabled) {
        const lines = splitLinesRef.current.filter(l => l.accountNumber)
        if (lines.length > 0) parts.push(lines.map(l => l.accountNumber).join('+'))
      } else if (currentFormData.accountNumber) {
        parts.push(currentFormData.accountNumber)
      }
    }
    parts.push(currentFormData.fixedPart, currentFormData.adjustablePart)
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
    filingDate,
    currentFormData.fixedPart,
    currentFormData.adjustablePart,
    currentFormData.amount,
    currentFormData.accountNumber,
    includeAmount,
    prefixAccount,
    ventilationEnabled,
    useQuarterMode,
    filingGranularity
  ])

  const formatDateLabel = (isoDate: string): string => {
    if (!isoDate) return ''
    const p = parseIsoDate(isoDate)
    if (!p) return ''
    return format(new Date(p.year, p.month - 1, p.day), 'EEEE d MMMM yyyy', { locale: fr })
  }

  const dateLabel = formatDateLabel(currentFormData.date)
  const paymentDateLabel = formatDateLabel(currentFormData.paymentDate)

  const canValidate =
    filingDate &&
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
          ...(s.paymentDate && { paymentDate: s.paymentDate }),
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
      const nameParts: string[] = []
      if (prefixAccount) {
        if (ventilationEnabled) {
          const lines = splitLinesRef.current.filter(l => l.accountNumber)
          nameParts.push(lines.map(l => l.accountNumber).join('+'))
        } else if (currentFormData.accountNumber) {
          nameParts.push(currentFormData.accountNumber)
        }
      }
      nameParts.push(currentFormData.fixedPart, currentFormData.adjustablePart)
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
        const parsed = parseIsoDate(filingDate)
        if (!parsed) {
          setIsProcessing(false)
          processingGuard.current = false
          setMessage({ type: 'error', text: 'Date invalide' })
          return
        }
        const { year, month: monthNum } = parsed
        const mStr = String(monthNum).padStart(2, '0')
        const qStr = getQuarterLabel(monthNum)
        const period = filingGranularity === 'quarter-month'
          ? `${qStr}/${mStr}`
          : filingGranularity === 'quarter'
            ? qStr
            : mStr
        fileName = sanitizeFileName(nameParts.filter(Boolean).join(' - '), {
          destFolderLength: `${effectiveBase}/${year}/${period}`.length
        })
        destPath = `${effectiveBase}/${year}/${period}/${fileName}.pdf`

        // Detect folder mode conflict (skip if user already saw the warning and clicked again)
        const isForcing = message?.type === 'warning' && message.text.includes('Changez la granularite')
        if (!isForcing) {
          const folderMode = await window.api.checkFolderMode(effectiveBase, String(year))
          const usesQuarters = filingGranularity === 'quarter' || filingGranularity === 'quarter-month'
          if (folderMode === 'month' && usesQuarters) {
            setIsProcessing(false)
            processingGuard.current = false
            setMessage({
              type: 'warning',
              text: `Le dossier ${year}/ contient des sous-dossiers mensuels (01, 02...) mais le mode trimestre est actif. Changez la granularite dans les parametres ou forcez en cliquant a nouveau sur Valider.`
            })
            return
          }
          if (folderMode === 'quarter' && filingGranularity === 'month') {
            setIsProcessing(false)
            processingGuard.current = false
            setMessage({
              type: 'warning',
              text: `Le dossier ${year}/ contient des sous-dossiers trimestriels (T1, T2...) mais le mode mensuel est actif. Changez la granularite dans les parametres ou forcez en cliquant a nouveau sur Valider.`
            })
            return
          }
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
        date: filingDate,
        baseFolder: customDestFolder || destinationFolder,
        fileName,
        customDest: !!customDestFolder,
        useQuarterMode,
        filingGranularity,
        stampX,
        stampY,
        stampRotation,
        ventilation,
        stampIncludeLabel,
        paid: (() => {
          const mode = currentFormData.paymentMode
          const text = currentFormData.paid
          if (mode && text) return `${mode} ${text}`
          if (mode) return mode
          return text || undefined
        })()
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

  const handleOrphanSave = async (updatedMapping: SupplierMapping): Promise<void> => {
    await window.api.updateSupplierMapping(updatedMapping.invoiceName, updatedMapping)
    setFormData({
      accountNumber: updatedMapping.defaultAccount,
      accountLabel: updatedMapping.defaultAccountLabel
    })
    setOrphanDialog(null)
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
          paymentDate: suggestion.paymentDate || '',
          fixedPart: suggestion.fixedPart || '',
          adjustablePart: suggestion.adjustablePart || '',
          amount: suggestion.amount || ''
        }
        if (suggestion.amountType) setAiAmountType(suggestion.amountType)
        setFormData({
          ...(suggestion.accountNumber && { accountNumber: suggestion.accountNumber }),
          ...(suggestion.accountLabel && { accountLabel: suggestion.accountLabel }),
          ...(suggestion.date && parseIsoDate(suggestion.date) && { date: suggestion.date }),
          ...(suggestion.paymentDate && parseIsoDate(suggestion.paymentDate) && { paymentDate: suggestion.paymentDate }),
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

  const handleIgnore = useCallback(async () => {
    ignoreCurrentFile()
    setSupplierQuery('')
    setCustomDestFolder(null)
    setMessage(null)
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
  }, [ignoreCurrentFile, setCurrentPdfPath])

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Informations comptables</h2>
          <button
            type="button"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
            onClick={handleAiReread}
            disabled={aiProcessing || !currentPdfPath}
            title="Relecture IA"
          >
            <Sparkles className={`h-4 w-4 ${aiProcessing ? 'ai-pulse' : 'text-fuchsia-500'}`} />
          </button>
          {aiProcessing && (
            <button
              type="button"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              onClick={async () => {
                await window.api.aiAbort()
                setAiProcessing(false)
              }}
              title="Arreter l'analyse IA"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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

      {/* Orphan account dialog */}
      {orphanDialog && (
        <OrphanAccountDialog
          mapping={orphanDialog.mapping}
          onSave={handleOrphanSave}
          onDismiss={() => setOrphanDialog(null)}
        />
      )}

      {/* Supplier selector with autocomplete from mappings */}
      <div className="space-y-1 relative">
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

      {/* Date picker with calendar */}
      <div className="space-y-1">
        <Label>Date du document</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {dateLabel ? (
                <span className="capitalize">{dateLabel}</span>
              ) : (
                <span className="text-muted-foreground">Choisir une date...</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentFormData.date ? parse(currentFormData.date, 'yyyy-MM-dd', new Date()) : undefined}
              onSelect={(day) => {
                if (day) {
                  setFormData({ date: format(day, 'yyyy-MM-dd') })
                }
              }}
              defaultMonth={currentFormData.date ? parse(currentFormData.date, 'yyyy-MM-dd', new Date()) : undefined}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Toggle Ventilation */}
      <div className="flex items-center justify-center py-0.5">
        <hr className="flex-1 border-border" />
        <button
          type="button"
          onClick={() => handleToggleVentilation(!ventilationEnabled)}
          className={`mx-3 px-2 py-0.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
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
          <div className="space-y-1">
            <Label>Compte comptable</Label>
            <AccountCombobox
              accountNumber={currentFormData.accountNumber}
              accountLabel={currentFormData.accountLabel}
              onSelect={handleSelectAccount}
            />
          </div>

          {/* Amount */}
          <div className="space-y-1">
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
      <div className="space-y-1">
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

      {/* Payment date picker */}
      <div className="space-y-1">
        <Label>
          Date de paiement
          {usePaymentDateFiling && (
            <span className="ml-2 text-xs font-normal text-primary">(utilisee pour le classement)</span>
          )}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {paymentDateLabel ? (
                <span className="capitalize">{paymentDateLabel}</span>
              ) : (
                <span className="text-muted-foreground">Date de paiement...</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentFormData.paymentDate ? parse(currentFormData.paymentDate, 'yyyy-MM-dd', new Date()) : undefined}
              onSelect={(day) => {
                if (day) {
                  setFormData({ paymentDate: format(day, 'yyyy-MM-dd') })
                }
              }}
              defaultMonth={currentFormData.paymentDate ? parse(currentFormData.paymentDate, 'yyyy-MM-dd', new Date()) : undefined}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Payment mode + Paid stamp */}
      <div className="space-y-1">
        <Label>{"Pay\u00e9 (tampon bleu optionnel)"}</Label>
        <div className="flex gap-2">
          <Select
            value={currentFormData.paymentMode || '__none__'}
            onValueChange={(value) => {
              setFormData({ paymentMode: value === '__none__' ? '' : value })
            }}
          >
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">&nbsp;</SelectItem>
              {paymentModeOptions.map((mode) => (
                <SelectItem key={mode} value={mode}>{mode}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="paid"
            placeholder="Ex: 04/2026, Cheque 12345..."
            value={currentFormData.paid}
            onChange={(e) => setFormData({ paid: e.target.value })}
            className="flex-1"
          />
        </div>
      </div>

      {/* Path preview - clickable to change destination */}
      {pathPreview && (
        <div
          className="rounded-md border border-border bg-muted/50 px-3 py-1.5 space-y-0.5 cursor-pointer hover:bg-muted/80 transition-colors"
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
      <Button className="w-full h-8 text-sm" disabled={!canValidate} onClick={handleValidate}>
        {isProcessing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Traitement...
          </>
        ) : (
          'Valider et classer'
        )}
      </Button>

      {/* Ignore button */}
      <Button
        variant="outline"
        className="w-full h-8 text-sm border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
        onClick={handleIgnore}
        disabled={!currentPdfPath || isProcessing}
      >
        Ignorer ce document
      </Button>
    </div>
  )
}
