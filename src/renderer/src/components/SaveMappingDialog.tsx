import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BookmarkPlus, X } from 'lucide-react'

interface SaveMappingDialogProps {
  supplierName: string
  shortName: string
  accountNumber: string
  accountLabel: string
  onSave: (mapping: {
    invoiceName: string
    shortName: string
    defaultAccount: string
    defaultAccountLabel: string
  }) => void
  onDismiss: () => void
}

export function SaveMappingDialog({
  supplierName,
  shortName,
  accountNumber,
  accountLabel,
  onSave,
  onDismiss
}: SaveMappingDialogProps): React.JSX.Element {
  const [form, setForm] = useState({
    invoiceName: supplierName,
    shortName: shortName,
    defaultAccount: accountNumber,
    defaultAccountLabel: accountLabel
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
    <div className="rounded-md border border-border bg-card p-4 space-y-3 shadow-lg w-full max-w-md mx-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkPlus className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Sauvegarder ce fournisseur ?</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Enregistrez ce mapping pour pré-remplir automatiquement le formulaire la prochaine fois.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nom sur la facture</Label>
          <Input
            className="h-8 text-xs"
            value={form.invoiceName}
            onChange={(e) => setForm({ ...form, invoiceName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nom court (fichier)</Label>
          <Input
            className="h-8 text-xs"
            value={form.shortName}
            onChange={(e) => setForm({ ...form, shortName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Compte</Label>
          <Input
            className="h-8 text-xs font-mono"
            value={form.defaultAccount}
            onChange={(e) => setForm({ ...form, defaultAccount: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Libellé</Label>
          <Input
            className="h-8 text-xs"
            value={form.defaultAccountLabel}
            onChange={(e) => setForm({ ...form, defaultAccountLabel: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" className="text-xs" onClick={onDismiss}>
          Non merci
        </Button>
        <Button
          size="sm"
          className="text-xs"
          onClick={() => onSave(form)}
          disabled={!form.invoiceName || !form.shortName}
        >
          Enregistrer
        </Button>
      </div>
    </div>
    </div>
  )
}
