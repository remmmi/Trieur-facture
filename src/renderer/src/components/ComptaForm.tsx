import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SaveMappingDialog } from '@/components/SaveMappingDialog'
import { searchComptes, type CompteComptable } from '@/data/planComptable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, FolderTree, Loader2 } from 'lucide-react'

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
    aiExtractedSupplier
  } = useAppStore()

  // Account autocomplete
  const [accountQuery, setAccountQuery] = useState('')
  const [showAccountSuggestions, setShowAccountSuggestions] = useState(false)
  const accountSuggestionsRef = useRef<HTMLDivElement>(null)
  const accountInputRef = useRef<HTMLInputElement>(null)

  // Supplier autocomplete
  const [supplierQuery, setSupplierQuery] = useState('')
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)
  const [supplierMappings, setSupplierMappings] = useState<SupplierMapping[]>([])
  const supplierSuggestionsRef = useRef<HTMLDivElement>(null)
  const supplierInputRef = useRef<HTMLInputElement>(null)

  // Messages & auto-learn
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSaveMapping, setShowSaveMapping] = useState(false)
  const [pendingSaveData, setPendingSaveData] = useState<{
    supplier: string
    shortName: string
    account: string
    accountLabel: string
  } | null>(null)

  const accountSuggestions = useMemo(() => searchComptes(accountQuery), [accountQuery])
  const currentFile = fileQueue[currentIndex]

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
        accountSuggestionsRef.current &&
        !accountSuggestionsRef.current.contains(target) &&
        accountInputRef.current &&
        !accountInputRef.current.contains(target)
      ) {
        setShowAccountSuggestions(false)
      }
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

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
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

  // --- Account handlers ---
  const handleSelectAccount = (compte: CompteComptable): void => {
    setFormData({ accountNumber: compte.numero, accountLabel: compte.libelle })
    setAccountQuery(`${compte.numero} - ${compte.libelle}`)
    setShowAccountSuggestions(false)
  }

  const handleAccountInputChange = (value: string): void => {
    setAccountQuery(value)
    setShowAccountSuggestions(true)
    const match = value.match(/^(\d+)\s*-?\s*(.*)$/)
    if (match) {
      setFormData({ accountNumber: match[1], accountLabel: match[2] || '' })
    } else {
      setFormData({ accountNumber: value, accountLabel: '' })
    }
  }

  // --- Supplier handlers ---
  const handleSelectSupplier = (mapping: SupplierMapping): void => {
    setSupplierQuery(mapping.shortName)
    setFormData({
      fixedPart: mapping.shortName,
      accountNumber: mapping.defaultAccount,
      accountLabel: mapping.defaultAccountLabel
    })
    setAccountQuery(
      mapping.defaultAccount
        ? `${mapping.defaultAccount}${mapping.defaultAccountLabel ? ' - ' + mapping.defaultAccountLabel : ''}`
        : ''
    )
    setShowSupplierSuggestions(false)
  }

  const handleSupplierInputChange = (value: string): void => {
    setSupplierQuery(value)
    setFormData({ fixedPart: value })
    setShowSupplierSuggestions(true)
  }

  // --- Path preview ---
  const pathPreview = useMemo(() => {
    if (!destinationFolder || !currentFormData.date) return null
    const date = new Date(currentFormData.date)
    if (isNaN(date.getTime())) return null

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const fileName = [currentFormData.fixedPart, currentFormData.adjustablePart]
      .filter(Boolean)
      .join(' - ')
    const fullFileName = fileName ? `${fileName}.pdf` : '(nom de fichier incomplet)'
    return { full: `${destinationFolder}/${year}/${month}/${fullFileName}` }
  }, [
    destinationFolder,
    currentFormData.date,
    currentFormData.fixedPart,
    currentFormData.adjustablePart
  ])

  const dateLabel = currentFormData.date
    ? (() => {
        const d = new Date(currentFormData.date)
        return isNaN(d.getTime()) ? '' : format(d, 'EEEE d MMMM yyyy', { locale: fr })
      })()
    : ''

  const canValidate =
    currentFormData.accountNumber &&
    currentFormData.date &&
    currentFormData.fixedPart &&
    currentPdfPath &&
    destinationFolder &&
    !isProcessing

  // --- Validate ---
  const handleValidate = useCallback(async () => {
    if (!canValidate || !currentPdfPath || !destinationFolder) return

    setIsProcessing(true)
    setMessage(null)

    try {
      const fileName = [currentFormData.fixedPart, currentFormData.adjustablePart]
        .filter(Boolean)
        .join(' - ')

      const result = await window.api.processDocument({
        sourcePath: currentPdfPath,
        accountNumber: currentFormData.accountNumber,
        accountLabel: currentFormData.accountLabel,
        date: currentFormData.date,
        baseFolder: destinationFolder,
        fileName
      })

      if (result.success) {
        setMessage({ type: 'success', text: `Classé dans: ${result.destinationPath}` })

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
            setPendingSaveData({
              supplier: aiExtractedSupplier || currentFormData.fixedPart,
              shortName: currentFormData.fixedPart,
              account: currentFormData.accountNumber,
              accountLabel: currentFormData.accountLabel
            })
            setShowSaveMapping(true)
          }
        }

        removeCurrentFile()
        resetForm()
        setAccountQuery('')
        setSupplierQuery('')

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
    setIsProcessing
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Informations comptables</h2>
        {currentFile && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {currentFile.name}
          </span>
        )}
      </div>

      {/* Success/Error message */}
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {message.text}
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

      {/* Account selector with autocomplete */}
      <div className="space-y-2 relative">
        <Label htmlFor="account">Compte comptable</Label>
        <Input
          id="account"
          ref={accountInputRef}
          placeholder="Tapez un numéro ou un libellé..."
          value={accountQuery}
          onChange={(e) => handleAccountInputChange(e.target.value)}
          onFocus={() => setShowAccountSuggestions(true)}
          autoComplete="off"
        />
        {showAccountSuggestions && accountSuggestions.length > 0 && (
          <div
            ref={accountSuggestionsRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-md"
          >
            {accountSuggestions.map((compte) => (
              <button
                key={compte.numero}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left cursor-pointer"
                onClick={() => handleSelectAccount(compte)}
              >
                <span className="font-mono font-medium text-primary min-w-[50px]">
                  {compte.numero}
                </span>
                <span className="text-muted-foreground truncate">{compte.libelle}</span>
                {currentFormData.accountNumber === compte.numero && (
                  <Check className="h-3 w-3 ml-auto text-success" />
                )}
              </button>
            ))}
          </div>
        )}
        {currentFormData.accountNumber && (
          <p className="text-xs text-muted-foreground">
            Compte: <span className="font-mono">{currentFormData.accountNumber}</span>
            {currentFormData.accountLabel && ` - ${currentFormData.accountLabel}`}
          </p>
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

      {/* Adjustable part */}
      <div className="space-y-2">
        <Label htmlFor="adjustablePart">Partie ajustable (n° de facture, mois...)</Label>
        <Input
          id="adjustablePart"
          placeholder="Ex: FAC-2026-001, Janvier..."
          value={currentFormData.adjustablePart}
          onChange={(e) => setFormData({ adjustablePart: e.target.value })}
        />
      </div>

      {/* Path preview */}
      {pathPreview && (
        <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FolderTree className="h-3 w-3" />
            Aperçu du chemin de destination
          </div>
          <p className="text-xs font-mono break-all">{pathPreview.full}</p>
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
