import { useState, useRef, useEffect, useMemo } from 'react'
import { searchComptes, planComptable, setPlanComptable, type CompteComptable } from '@/data/planComptable'
import { Check, ChevronDown, Search, Plus, X as XIcon } from 'lucide-react'

interface AccountComboboxProps {
  accountNumber: string
  accountLabel: string
  onSelect: (numero: string, libelle: string) => void
}

export function AccountCombobox({
  accountNumber,
  accountLabel,
  onSelect
}: AccountComboboxProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [addingLibelle, setAddingLibelle] = useState(false)
  const [newLibelle, setNewLibelle] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const libelleRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => searchComptes(query), [query])

  // Check if query is a number that doesn't match any existing account exactly
  const isNewNumero = useMemo(() => {
    if (!query || !/^\d+$/.test(query.trim())) return false
    return !planComptable.some((c) => c.numero === query.trim())
  }, [query])

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setAddingLibelle(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleOpen = (): void => {
    setQuery('')
    setAddingLibelle(false)
    setOpen((prev) => !prev)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  const handleSelect = (compte: CompteComptable): void => {
    onSelect(compte.numero, compte.libelle)
    setQuery('')
    setOpen(false)
    setAddingLibelle(false)
  }

  const handleStartAdding = (): void => {
    setNewLibelle('')
    setAddingLibelle(true)
    setTimeout(() => libelleRef.current?.focus(), 0)
  }

  const handleClearQuery = (): void => {
    setQuery('')
    setAddingLibelle(false)
    searchRef.current?.focus()
  }

  const handleConfirmAdd = async (): Promise<void> => {
    const numero = query.trim()
    const libelle = newLibelle.trim()
    if (!numero || !libelle) return

    const entry = { numero, libelle }
    const updated = await window.api.addPlanComptableEntry(entry, planComptable)
    setPlanComptable(updated)
    onSelect(numero, libelle)
    setQuery('')
    setNewLibelle('')
    setAddingLibelle(false)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center justify-between w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleOpen}
      >
        {accountNumber ? (
          <span>
            <span className="font-mono font-medium">{accountNumber}</span>
            {accountLabel && (
              <span className="text-muted-foreground"> - {accountLabel}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Selectionner un compte...</span>
        )}
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Rechercher un compte..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setAddingLibelle(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isNewNumero && !addingLibelle) {
                  handleStartAdding()
                }
              }}
              autoComplete="off"
            />
            {isNewNumero && !addingLibelle && (
              <>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-accent text-success cursor-pointer"
                  onClick={handleStartAdding}
                  title="Ajouter ce compte"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-accent text-destructive cursor-pointer"
                  onClick={handleClearQuery}
                  title="Effacer"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {addingLibelle && (
            <div className="px-3 py-2 border-b border-border bg-muted/30 space-y-2">
              <p className="text-xs text-muted-foreground">
                Nouveau compte <span className="font-mono font-medium">{query.trim()}</span>
              </p>
              <div className="flex gap-2">
                <input
                  ref={libelleRef}
                  className="flex-1 bg-background rounded-md border border-input px-2 py-1 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  placeholder="Libelle du compte..."
                  value={newLibelle}
                  onChange={(e) => setNewLibelle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmAdd()
                    if (e.key === 'Escape') setAddingLibelle(false)
                  }}
                />
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-accent text-success cursor-pointer disabled:opacity-40"
                  onClick={handleConfirmAdd}
                  disabled={!newLibelle.trim()}
                  title="Confirmer"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-accent text-destructive cursor-pointer"
                  onClick={() => setAddingLibelle(false)}
                  title="Annuler"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-auto">
            {suggestions.length > 0 ? (
              suggestions.map((compte) => (
                <button
                  key={compte.numero}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left cursor-pointer"
                  onClick={() => handleSelect(compte)}
                >
                  <span className="font-mono font-medium text-primary min-w-[50px]">
                    {compte.numero}
                  </span>
                  <span className="text-muted-foreground truncate">{compte.libelle}</span>
                  {accountNumber === compte.numero && (
                    <Check className="h-3 w-3 ml-auto text-success" />
                  )}
                </button>
              ))
            ) : (
              !addingLibelle && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Aucun compte trouve
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
