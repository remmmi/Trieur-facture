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
  RotateCcw
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
  const [includeAmount, setIncludeAmount] = useState(false)
  const [useQuarterMode, setUseQuarterMode] = useState(false)
  const [mappings, setMappings] = useState<SupplierMapping[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<SupplierMapping>({
    invoiceName: '',
    shortName: '',
    defaultAccount: '',
    defaultAccountLabel: ''
  })
  const [isAdding, setIsAdding] = useState(false)

  const loadData = useCallback(async () => {
    const [key, supplierMappings] = await Promise.all([
      window.api.getApiKey(),
      window.api.getSupplierMappings()
    ])
    setApiKeyDisplay(key)
    setMappings(supplierMappings)
    window.api.getIncludeAmount().then(setIncludeAmount)
    window.api.getUseQuarterMode().then(setUseQuarterMode)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveApiKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    await window.api.setApiKey(apiKey.trim())
    setApiKeySaved(true)
    setApiKey('')
    const key = await window.api.getApiKey()
    setApiKeyDisplay(key)
    setTimeout(() => setApiKeySaved(false), 2000)
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
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                />
                <Button onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
                  {apiKeySaved ? 'Sauvegardé !' : 'Sauvegarder'}
                </Button>
              </div>
              {apiKeyDisplay && (
                <p className="text-xs text-muted-foreground font-mono">
                  Clé actuelle : {apiKeyDisplay}
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
            </section>

            {/* Classement mode */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Classement</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useQuarterMode}
                  onChange={async (e) => {
                    setUseQuarterMode(e.target.checked)
                    await window.api.setUseQuarterMode(e.target.checked)
                  }}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm">
                  Classer par trimestre (T1, T2, T3, T4) au lieu du mois
                </span>
              </label>
              <p className="text-xs text-muted-foreground pl-7">
                {useQuarterMode
                  ? 'Exemple : Comptabilite/2026/T2/Fournisseur - FAC-001.pdf'
                  : 'Exemple : Comptabilite/2026/04/Fournisseur - FAC-001.pdf'}
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
              <Button variant="outline" size="sm" onClick={startAdding}>
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            </div>

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
                            <span className="text-xs text-muted-foreground block">Facture</span>
                            <span className="truncate block">{mapping.invoiceName}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Fichier</span>
                            <span className="font-medium">{mapping.shortName}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Compte</span>
                            <span className="font-mono">{mapping.defaultAccount || '—'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Libellé</span>
                            <span className="truncate block">
                              {mapping.defaultAccountLabel || '—'}
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
        <div className="grid grid-cols-[100px_1fr] text-xs font-medium bg-muted/50 px-3 py-2 border-b border-border">
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
          <Label className="text-xs">Dossier source (factures)</Label>
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
          <Label className="text-xs">Dossier destination (comptabilite)</Label>
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
