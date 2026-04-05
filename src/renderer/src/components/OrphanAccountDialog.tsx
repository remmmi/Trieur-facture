import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AccountCombobox } from '@/components/AccountCombobox'
import { AlertTriangle, X } from 'lucide-react'

interface SupplierMapping {
  invoiceName: string
  shortName: string
  defaultAccount: string
  defaultAccountLabel: string
}

interface OrphanAccountDialogProps {
  mapping: SupplierMapping
  onSave: (updatedMapping: SupplierMapping) => Promise<void>
  onDismiss: () => void
}

export function OrphanAccountDialog({
  mapping,
  onSave,
  onDismiss
}: OrphanAccountDialogProps): React.JSX.Element {
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    if (!selectedAccount) return
    setSaving(true)
    try {
      await onSave({
        ...mapping,
        defaultAccount: selectedAccount,
        defaultAccountLabel: selectedLabel
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div className="rounded-md border border-border bg-card p-4 space-y-4 shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Compte comptable introuvable</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Le fournisseur{' '}
          <span className="font-medium text-foreground">{mapping.shortName}</span> est lie au
          compte{' '}
          <span className="font-mono font-medium text-amber-500">{mapping.defaultAccount}</span>{' '}
          qui n&apos;existe pas dans votre plan comptable. Choisissez un nouveau compte :
        </p>

        <div className="space-y-2">
          <Label className="text-xs">Nouveau compte</Label>
          <AccountCombobox
            accountNumber={selectedAccount}
            accountLabel={selectedLabel}
            onSelect={(numero, libelle) => {
              setSelectedAccount(numero)
              setSelectedLabel(libelle)
            }}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" className="text-xs" onClick={onDismiss}>
            Annuler
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={handleSave}
            disabled={!selectedAccount || saving}
          >
            Sauvegarder
          </Button>
        </div>
      </div>
    </div>
  )
}
