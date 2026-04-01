import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Key, Plus, Pencil, Trash2, Save, X, ArrowLeft } from 'lucide-react'

interface SupplierMapping {
  invoiceName: string
  shortName: string
  defaultAccount: string
  defaultAccountLabel: string
}

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyDisplay, setApiKeyDisplay] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
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

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Paramètres</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-3xl mx-auto w-full">
        {/* API Key Section */}
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

        {/* Supplier Mappings Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Mapping fournisseurs</h2>
            <Button variant="outline" size="sm" onClick={startAdding}>
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Associez un nom de fournisseur (tel qu'il apparaît sur les factures) à un nom court pour
            le fichier et un compte comptable par défaut.
          </p>

          {/* Add form */}
          {isAdding && (
            <div className="rounded-md border border-border p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-medium">Nouveau mapping</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nom sur la facture</Label>
                  <Input
                    placeholder="EDF Entreprises SA"
                    value={editForm.invoiceName}
                    onChange={(e) => setEditForm({ ...editForm, invoiceName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nom court (fichier)</Label>
                  <Input
                    placeholder="EDF"
                    value={editForm.shortName}
                    onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Compte comptable</Label>
                  <Input
                    placeholder="6061"
                    value={editForm.defaultAccount}
                    onChange={(e) => setEditForm({ ...editForm, defaultAccount: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Libellé du compte</Label>
                  <Input
                    placeholder="Fournitures non stockables"
                    value={editForm.defaultAccountLabel}
                    onChange={(e) =>
                      setEditForm({ ...editForm, defaultAccountLabel: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddMapping}
                  disabled={!editForm.invoiceName || !editForm.shortName}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Enregistrer
                </Button>
              </div>
            </div>
          )}

          {/* Mappings list */}
          {mappings.length === 0 && !isAdding ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aucun mapping configuré. Les mappings seront proposés automatiquement lors du
              traitement des factures.
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping, index) => (
                <div
                  key={mapping.invoiceName}
                  className="rounded-md border border-border p-3"
                >
                  {editingIndex === index ? (
                    // Editing mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nom sur la facture</Label>
                          <Input
                            value={editForm.invoiceName}
                            onChange={(e) =>
                              setEditForm({ ...editForm, invoiceName: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nom court (fichier)</Label>
                          <Input
                            value={editForm.shortName}
                            onChange={(e) =>
                              setEditForm({ ...editForm, shortName: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Compte comptable</Label>
                          <Input
                            value={editForm.defaultAccount}
                            onChange={(e) =>
                              setEditForm({ ...editForm, defaultAccount: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Libellé du compte</Label>
                          <Input
                            value={editForm.defaultAccountLabel}
                            onChange={(e) =>
                              setEditForm({ ...editForm, defaultAccountLabel: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Annuler
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateMapping(mapping.invoiceName)}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Sauvegarder
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(index)}
                        >
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
        </section>
      </div>
    </div>
  )
}
