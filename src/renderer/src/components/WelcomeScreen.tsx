import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { FolderOpen, FolderOutput, Settings } from 'lucide-react'

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
              <p className="text-xs text-muted-foreground pl-1">
                {fileQueue.length} fichier(s) trouvé(s)
              </p>
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
          </div>

          <label className="flex items-center gap-2 cursor-pointer pl-1">
            <input
              type="checkbox"
              checked={useQuarterMode}
              onChange={async (e) => {
                setUseQuarterMode(e.target.checked)
                await window.api.setUseQuarterMode(e.target.checked)
              }}
              className="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              Classement par trimestre (T1-T4)
            </span>
          </label>

          <Button className="w-full" disabled={!canStart} onClick={handleStart}>
            Commencer le tri
          </Button>
        </div>
      </div>
    </div>
  )
}
