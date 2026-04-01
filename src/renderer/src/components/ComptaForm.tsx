import { useAppStore } from '@/store/useAppStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function ComptaForm(): React.JSX.Element {
  const { currentFormData, setFormData } = useAppStore()

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Informations comptables</h2>

      <div className="space-y-2">
        <Label htmlFor="account">Compte comptable</Label>
        <Input
          id="account"
          placeholder="Numéro de compte..."
          value={currentFormData.accountNumber}
          onChange={(e) => setFormData({ accountNumber: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={currentFormData.date}
          onChange={(e) => setFormData({ date: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fixedPart">Partie fixe (fournisseur)</Label>
        <Input
          id="fixedPart"
          placeholder="Ex: EDF, Orange..."
          value={currentFormData.fixedPart}
          onChange={(e) => setFormData({ fixedPart: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adjustablePart">Partie ajustable (n de facture)</Label>
        <Input
          id="adjustablePart"
          placeholder="Ex: FAC-2026-001"
          value={currentFormData.adjustablePart}
          onChange={(e) => setFormData({ adjustablePart: e.target.value })}
        />
      </div>

      <Button className="w-full" disabled>
        Valider (en construction)
      </Button>
    </div>
  )
}
