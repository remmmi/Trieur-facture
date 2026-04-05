import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { AccountCombobox } from '@/components/AccountCombobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Key,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ArrowLeft,
  Users,
  Settings2,
  FolderOpen,
  FolderOutput,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  FileUp,
  Loader2
} from 'lucide-react'

interface SupplierMapping {
  invoiceName: string
  shortName: string
  defaultAccount: string
  defaultAccountLabel: string
}

interface SettingsPanelProps {
  onClose: () => void
}

type Tab = 'general' | 'mappings' | 'plancomptable'

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyDisplay, setApiKeyDisplay] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [apiKeyValidating, setApiKeyValidating] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<{ valid: boolean; error?: string } | null>(null)
  const [includeAmount, setIncludeAmount] = useState(false)
  const [stampIncludeLabel, setStampIncludeLabel] = useState(false)
  const [useQuarterMode, setUseQuarterMode] = useState(false)
  const [prefixAccount, setPrefixAccount] = useState(false)
  const [largeFileThreshold, setLargeFileThreshold] = useState(8)
  const [mappings, setMappings] = useState<SupplierMapping[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<SupplierMapping>({
    invoiceName: '',
    shortName: '',
    defaultAccount: '',
    defaultAccountLabel: ''
  })
  const [isAdding, setIsAdding] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvImportMessage, setCsvImportMessage] = useState<{
    text: string
    type: 'success' | 'warn' | 'error'
  } | null>(null)
  const csvFileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    const [key, supplierMappings] = await Promise.all([
      window.api.getApiKey(),
      window.api.getSupplierMappings()
    ])
    setApiKeyDisplay(key)
    setMappings(supplierMappings)
    window.api.getIncludeAmount().then(setIncludeAmount)
    window.api.getStampIncludeLabel().then(setStampIncludeLabel)
    window.api.getUseQuarterMode().then(setUseQuarterMode)
    window.api.getPrefixAccount().then(setPrefixAccount)
    window.api.getLargeFileThreshold().then(setLargeFileThreshold)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveApiKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    const trimmedKey = apiKey.trim()

    // Validate first
    setApiKeyValidating(true)
    setApiKeyStatus(null)
    const result = await window.api.validateApiKey(trimmedKey)
    setApiKeyValidating(false)
    setApiKeyStatus(result)

    if (!result.valid) return

    // Save only if valid
    await window.api.setApiKey(trimmedKey)
    setApiKeySaved(true)
    setApiKey('')
    const key = await window.api.getApiKey()
    setApiKeyDisplay(key)
    setTimeout(() => {
      setApiKeySaved(false)
      setApiKeyStatus(null)
    }, 3000)
  }

  const handleAddMapping = async (): Promise<void> => {
    if (!editForm.invoiceName || !editForm.shortName) return
    await window.api.addSupplierMapping(editForm)
    setIsAdding(false)
    setEditForm({ invoiceName: '', shortName: '', defaultAccount: '', defaultAccountLabel: '' })
    loadData()
  }

  const handleUpdateMapping = async (oldName: string): Promise<void> => {
    await window.api.updateSupplierMapping(oldName, editForm)
    setEditingIndex(null)
    loadData()
  }

  const handleDeleteMapping = async (invoiceName: string): Promise<void> => {
    await window.api.removeSupplierMapping(invoiceName)
    loadData()
  }

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvImporting(true)
    setCsvImportMessage(null)

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/)

      // Charger le plan comptable actuel via IPC, fallback sur le plan par defaut
      const customPlan = await window.api.getPlanComptable()
      const { planComptable: defaultPlan } = await import('@/data/planComptable')
      const effectivePlan = customPlan && customPlan.length > 0 ? customPlan : defaultPlan

      // Construire une map numero -> libelle pour lookup rapide
      const planMap = new Map<string, string>(effectivePlan.map((c) => [c.numero, c.libelle]))

      let ignored = 0
      const toImport: SupplierMapping[] = []

      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim()
        if (!raw) continue

        // Heuristique header : skip la 1ere ligne si la 2e colonne n'est pas un numero
        if (i === 0) {
          const cols = raw.split(';')
          const secondCol = (cols[1] || '').trim().replace(/^["']|["']$/g, '')
          // C'est un header si la 2e colonne n'est pas un numero de compte
          if (secondCol && !/^\d+$/.test(secondCol)) continue
        }

        // Parser la ligne : separateur point-virgule, gestion des guillemets
        // Format attendu : nom_fournisseur;numero_compte (compte optionnel)
        const sep = ';'
        const firstSep = raw.indexOf(sep)
        const rawName = (firstSep === -1 ? raw : raw.slice(0, firstSep))
          .trim()
          .replace(/^["']|["']$/g, '')
        const rawAccount = firstSep === -1
          ? ''
          : raw.slice(firstSep + 1).trim().replace(/^["']|["']$/g, '')

        if (!rawName) {
          ignored++
          continue
        }

        // Valider le compte dans le plan comptable
        const accountLibelle = planMap.get(rawAccount)
        const validAccount = accountLibelle !== undefined

        toImport.push({
          invoiceName: rawName,
          shortName: rawName,
          defaultAccount: validAccount ? rawAccount : '',
          defaultAccountLabel: validAccount ? accountLibelle! : ''
        })
      }

      const result = await window.api.importSupplierMappings(toImport)
      const imported = result.imported
      const updated = result.updated

      await loadData()

      const parts: string[] = []
      if (imported > 0) parts.push(`${imported} importe${imported > 1 ? 's' : ''}`)
      if (updated > 0) parts.push(`${updated} mis a jour`)
      if (ignored > 0) parts.push(`${ignored} ignore${ignored > 1 ? 's' : ''} (lignes invalides)`)

      const total = imported + updated
      if (total === 0) {
        setCsvImportMessage({ text: 'Aucun fournisseur importe.', type: 'warn' })
      } else {
        setCsvImportMessage({ text: parts.join(', '), type: 'success' })
      }
    } catch (err) {
      setCsvImportMessage({
        text: `Erreur : ${err instanceof Error ? err.message : String(err)}`,
        type: 'error'
      })
    } finally {
      setCsvImporting(false)
      if (csvFileInputRef.current) csvFileInputRef.current.value = ''
    }
  }

  const startEditing = (index: number): void => {
    setEditingIndex(index)
    setEditForm({ ...mappings[index] })
    setIsAdding(false)
  }

  const startAdding = (): void => {
    setIsAdding(true)
    setEditingIndex(null)
    setEditForm({ invoiceName: '', shortName: '', defaultAccount: '', defaultAccountLabel: '' })
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Général', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'mappings', label: 'Fournisseurs', icon: <Users className="h-4 w-4" /> },
    {
      id: 'plancomptable',
      label: 'Plan comptable',
      icon: <FileSpreadsheet className="h-4 w-4" />
    }
  ]

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Paramètres</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full">
        {activeTab === 'general' && (
          <div className="space-y-8">
            {/* Dossiers */}
            <FolderSettings />

            {/* API Key */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Clé API Anthropic (Claude)</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Nécessaire pour l'extraction automatique des données de facture via Claude Sonnet 4.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={apiKeyDisplay || 'sk-ant-...'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setApiKeyStatus(null)
                    setApiKeySaved(false)
                  }}
                  className="font-mono"
                />
                <Button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim() || apiKeyValidating}
                >
                  {apiKeyValidating
                    ? 'Test...'
                    : apiKeySaved
                      ? 'OK'
                      : 'Sauvegarder'}
                </Button>
              </div>
              {apiKeyStatus && (
                <p
                  className={`text-xs font-medium ${apiKeyStatus.valid ? 'text-success' : 'text-destructive'}`}
                >
                  {apiKeyStatus.valid
                    ? '[OK] Cle valide, sauvegardee'
                    : `[ERREUR] ${apiKeyStatus.error}`}
                </p>
              )}
              {apiKeyDisplay && !apiKeyStatus && (
                <p className="text-xs text-muted-foreground font-mono">
                  Cle actuelle : {apiKeyDisplay}
                </p>
              )}
            </section>

            {/* Filename options */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Nommage des fichiers</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAmount}
                  onChange={async (e) => {
                    setIncludeAmount(e.target.checked)
                    await window.api.setIncludeAmount(e.target.checked)
                  }}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm">
                  Integrer le montant TTC dans le nom du fichier (en derniere position)
                </span>
              </label>
              <p className="text-xs text-muted-foreground pl-7">
                Exemple : Fournisseur - FAC-001 - 186.57.pdf
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefixAccount}
                  onChange={async (e) => {
                    setPrefixAccount(e.target.checked)
                    await window.api.setPrefixAccount(e.target.checked)
                  }}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm">
                  Prefixer le nom du fichier par le numero de compte
                </span>
              </label>
              <p className="text-xs text-muted-foreground pl-7">
                Exemple : 601100 - Fournisseur - FAC-001.pdf
              </p>
            </section>

            {/* Stamp label option */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Tampon PDF</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stampIncludeLabel}
                  onChange={async (e) => {
                    setStampIncludeLabel(e.target.checked)
                    await window.api.setStampIncludeLabel(e.target.checked)
                  }}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm">
                  Afficher le libelle du compte dans le tampon
                </span>
              </label>
              <p className="text-xs text-muted-foreground pl-7">
                Desactive : 601100 -- Active : 601100 - Achats fournitures
              </p>
            </section>

            {/* Classement mode */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Granularite temporelle</h2>
              <div className="flex flex-col gap-2 pl-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="granularite"
                    checked={!useQuarterMode}
                    onChange={async () => {
                      setUseQuarterMode(false)
                      await window.api.setUseQuarterMode(false)
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">Mois (01-12)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="granularite"
                    checked={useQuarterMode}
                    onChange={async () => {
                      setUseQuarterMode(true)
                      await window.api.setUseQuarterMode(true)
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">Trimestre (T1-T4)</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground pl-7">
                {useQuarterMode
                  ? 'Exemple : Comptabilite/2026/T2/Fournisseur - FAC-001.pdf'
                  : 'Exemple : Comptabilite/2026/04/Fournisseur - FAC-001.pdf'}
              </p>
            </section>

            {/* Gros fichiers */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Gros fichiers</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm">Seuil d'avertissement (pages)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={largeFileThreshold}
                  onChange={async (e) => {
                    const v = parseInt(e.target.value) || 8
                    setLargeFileThreshold(v)
                    await window.api.setLargeFileThreshold(v)
                  }}
                  className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Un avertissement s'affiche pour les fichiers depassant ce nombre de pages.
              </p>
            </section>
          </div>
        )}

        {activeTab === 'mappings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Mapping fournisseurs</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Associez un nom de fournisseur à un nom court et un compte comptable par défaut.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvImport}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCsvImportMessage(null)
                    csvFileInputRef.current?.click()
                  }}
                  disabled={csvImporting}
                >
                  {csvImporting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Import...
                    </>
                  ) : (
                    <>
                      <FileUp className="h-3 w-3 mr-1" />
                      Importer CSV
                    </>
                  )}
                </Button>
                <Button size="sm" onClick={startAdding}>
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>

            {csvImportMessage && (
              <p
                className={`text-sm font-medium ${
                  csvImportMessage.type === 'success'
                    ? 'text-green-400'
                    : csvImportMessage.type === 'warn'
                      ? 'text-amber-400'
                      : 'text-destructive'
                }`}
              >
                {csvImportMessage.text}
              </p>
            )}

            {/* Add form */}
            {isAdding && (
              <MappingForm
                form={editForm}
                onChange={setEditForm}
                onSave={handleAddMapping}
                onCancel={() => setIsAdding(false)}
                title="Nouveau mapping"
              />
            )}

            {/* List */}
            {mappings.length === 0 && !isAdding ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aucun mapping configuré. Les mappings seront proposés automatiquement lors du
                traitement des factures.
              </div>
            ) : (
              <div className="space-y-2">
                {mappings.map((mapping, index) => (
                  <div key={mapping.invoiceName} className="rounded-md border border-border p-3">
                    {editingIndex === index ? (
                      <MappingForm
                        form={editForm}
                        onChange={setEditForm}
                        onSave={() => handleUpdateMapping(mapping.invoiceName)}
                        onCancel={() => setEditingIndex(null)}
                        title="Modifier"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-sm text-muted-foreground block">Facture</span>
                            <span className="truncate block">{mapping.invoiceName}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground block">Fichier</span>
                            <span className="font-medium">{mapping.shortName}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground block">Compte</span>
                            <span className="font-mono">{mapping.defaultAccount || '---'}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground block">Libelle</span>
                            <span className="truncate block">
                              {mapping.defaultAccountLabel || '---'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-3">
                          <Button variant="ghost" size="icon" onClick={() => startEditing(index)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMapping(mapping.invoiceName)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'plancomptable' && <PlanComptableTab />}
      </div>
    </div>
  )
}

/** Sous-composant pour l'import du plan comptable */
function PlanComptableTab(): React.JSX.Element {
  const [entries, setEntries] = useState<{ numero: string; libelle: string }[]>([])
  const [isCustom, setIsCustom] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCurrent = useCallback(async () => {
    const custom = await window.api.getPlanComptable()
    if (custom && custom.length > 0) {
      setEntries(custom)
      setIsCustom(true)
    } else {
      const { planComptable } = await import('@/data/planComptable')
      setEntries(planComptable)
      setIsCustom(false)
    }
  }, [])

  useEffect(() => {
    loadCurrent()
  }, [loadCurrent])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage(null)
    try {
      const text = await file.text()
      const imported = await window.api.importPlanComptable(text)
      const { setPlanComptable } = await import('@/data/planComptable')
      setPlanComptable(imported)
      setEntries(imported)
      setIsCustom(true)
      setMessage(`${imported.length} comptes importes`)
    } catch (err) {
      setMessage(`Erreur: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReset = async (): Promise<void> => {
    await window.api.resetPlanComptable()
    const { resetToDefaultPlan, planComptable } = await import('@/data/planComptable')
    resetToDefaultPlan()
    setEntries(planComptable)
    setIsCustom(false)
    setMessage('Plan comptable par defaut restaure')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Plan comptable</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Importez votre plan comptable au format CSV.
          Colonnes attendues : <span className="font-mono">numero</span>,{' '}
          <span className="font-mono">libelle</span> (separateur : virgule, point-virgule ou
          tabulation).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <Upload className="h-4 w-4 mr-2" />
          {importing ? 'Import en cours...' : 'Importer un CSV'}
        </Button>
        {isCustom && (
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurer le plan par defaut
          </Button>
        )}
      </div>

      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}

      <div className="text-sm text-muted-foreground">
        {isCustom ? 'Plan comptable personnalise' : 'Plan comptable par defaut'} --{' '}
        {entries.length} comptes
      </div>

      {/* Preview table */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-[100px_1fr] text-sm font-medium bg-muted/50 px-3 py-2 border-b border-border">
          <span>Numero</span>
          <span>Libelle</span>
        </div>
        <div className="max-h-64 overflow-auto">
          {entries.map((e) => (
            <div
              key={e.numero}
              className="grid grid-cols-[100px_1fr] text-sm px-3 py-1.5 border-b border-border last:border-0"
            >
              <span className="font-mono">{e.numero}</span>
              <span className="text-muted-foreground">{e.libelle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Sous-composant pour la gestion des dossiers source/destination */
function FolderSettings(): React.JSX.Element {
  const { sourceFolder, destinationFolder, setSourceFolder, setDestinationFolder, setFileQueue } =
    useAppStore()

  const handleSelectSource = async (): Promise<void> => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setSourceFolder(folder)
      const files = await window.api.scanFolder(folder)
      setFileQueue(files)
      const { destinationFolder: dest } = useAppStore.getState()
      await window.api.setLastFolders(folder, dest)
    }
  }

  const handleSelectDestination = async (): Promise<void> => {
    const folder = await window.api.selectDestinationFolder()
    if (folder) {
      setDestinationFolder(folder)
      const { sourceFolder: src } = useAppStore.getState()
      await window.api.setLastFolders(src, folder)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Dossiers</h2>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-sm">Dossier source (factures)</Label>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleSelectSource}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            {sourceFolder ? (
              <span className="truncate">{sourceFolder}</span>
            ) : (
              <span className="text-muted-foreground">Aucun dossier selectionne</span>
            )}
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Dossier destination (comptabilite)</Label>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleSelectDestination}
          >
            <FolderOutput className="h-4 w-4 shrink-0" />
            {destinationFolder ? (
              <span className="truncate">{destinationFolder}</span>
            ) : (
              <span className="text-muted-foreground">Aucun dossier selectionne</span>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Sous-composant réutilisable pour le formulaire d'ajout/édition de mapping */
function MappingForm({
  form,
  onChange,
  onSave,
  onCancel,
  title
}: {
  form: SupplierMapping
  onChange: (f: SupplierMapping) => void
  onSave: () => void
  onCancel: () => void
  title: string
}): React.JSX.Element {
  return (
    <div className="space-y-3 bg-muted/30 rounded-md p-4 border border-border">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nom sur la facture</Label>
          <Input
            placeholder="EDF Entreprises SA"
            value={form.invoiceName}
            onChange={(e) => onChange({ ...form, invoiceName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom court (fichier)</Label>
          <Input
            placeholder="EDF"
            value={form.shortName}
            onChange={(e) => onChange({ ...form, shortName: e.target.value })}
          />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Compte comptable</Label>
          <AccountCombobox
            accountNumber={form.defaultAccount}
            accountLabel={form.defaultAccountLabel}
            onSelect={(numero, libelle) =>
              onChange({ ...form, defaultAccount: numero, defaultAccountLabel: libelle })
            }
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" />
          Annuler
        </Button>
        <Button size="sm" onClick={onSave} disabled={!form.invoiceName || !form.shortName}>
          <Save className="h-3 w-3 mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  )
}
