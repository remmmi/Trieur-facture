import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { FolderOpen, FolderOutput, Settings, Copy, Check } from 'lucide-react'

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      title="Copier le chemin"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

interface WelcomeScreenProps {
  onOpenSettings: () => void
}

export function WelcomeScreen({ onOpenSettings }: WelcomeScreenProps): React.JSX.Element {
  const {
    sourceFolder,
    destinationFolder,
    setSourceFolder,
    setDestinationFolder,
    setFileQueue,
    setHasStarted,
    fileQueue
  } = useAppStore()

  const [useQuarterMode, setUseQuarterMode] = useState(false)

  // Load persisted settings on mount
  useEffect(() => {
    window.api.getUseQuarterMode().then(setUseQuarterMode)
  }, [])

  // Load persisted folders on mount
  useEffect(() => {
    const loadPersistedFolders = async (): Promise<void> => {
      const { source, destination } = await window.api.getLastFolders()
      if (source && !sourceFolder) {
        setSourceFolder(source)
        // Try to scan the folder (it may no longer exist)
        try {
          const files = await window.api.scanFolder(source)
          setFileQueue(files)
        } catch {
          // Folder doesn't exist anymore, clear it
          setSourceFolder(null)
        }
      }
      if (destination && !destinationFolder) {
        setDestinationFolder(destination)
      }
    }
    loadPersistedFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectSource = async (): Promise<void> => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setSourceFolder(folder)
      const files = await window.api.scanFolder(folder)
      setFileQueue(files)
      // Persist
      const { destinationFolder: dest } = useAppStore.getState()
      await window.api.setLastFolders(folder, dest)
    }
  }

  const handleSelectDestination = async (): Promise<void> => {
    const folder = await window.api.selectDestinationFolder()
    if (folder) {
      setDestinationFolder(folder)
      // Persist
      const { sourceFolder: src } = useAppStore.getState()
      await window.api.setLastFolders(src, folder)
    }
  }

  const handleStart = (): void => {
    setHasStarted(true)
  }

  const canStart = sourceFolder && destinationFolder && fileQueue.length > 0

  return (
    <div className="flex h-screen items-center justify-center relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={onOpenSettings}
      >
        <Settings className="h-5 w-5" />
      </Button>
      <div className="absolute bottom-2 left-2">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Trieur de Factures</h1>
          <p className="text-muted-foreground">Sélectionnez les dossiers pour commencer</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleSelectSource}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              {sourceFolder ? (
                <span className="truncate">{sourceFolder}</span>
              ) : (
                'Dossier source (factures)'
              )}
            </Button>
            {sourceFolder && (
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground pl-1 flex-1">
                  {fileQueue.length} fichier(s) trouve(s)
                </p>
                <CopyButton text={sourceFolder} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleSelectDestination}
            >
              <FolderOutput className="h-4 w-4 shrink-0" />
              {destinationFolder ? (
                <span className="truncate">{destinationFolder}</span>
              ) : (
                'Dossier destination (comptabilité)'
              )}
            </Button>
            {destinationFolder && (
              <div className="flex justify-end">
                <CopyButton text={destinationFolder} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 pl-1">
            <span className="text-sm text-muted-foreground">Granularite :</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="granularite-welcome"
                checked={!useQuarterMode}
                onChange={async () => {
                  setUseQuarterMode(false)
                  await window.api.setUseQuarterMode(false)
                }}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span className="text-sm text-muted-foreground">Mois</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="granularite-welcome"
                checked={useQuarterMode}
                onChange={async () => {
                  setUseQuarterMode(true)
                  await window.api.setUseQuarterMode(true)
                }}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span className="text-sm text-muted-foreground">Trimestre</span>
            </label>
          </div>

          <Button className="w-full" disabled={!canStart} onClick={handleStart}>
            Commencer le tri
          </Button>
        </div>
      </div>
    </div>
  )
}
