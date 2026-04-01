import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { FolderOpen, FolderOutput } from 'lucide-react'

export function WelcomeScreen(): React.JSX.Element {
  const { sourceFolder, destinationFolder, setSourceFolder, setDestinationFolder, setFileQueue, setCurrentPdfPath } =
    useAppStore()

  const handleSelectSource = async (): Promise<void> => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setSourceFolder(folder)
      const files = await window.api.scanFolder(folder)
      setFileQueue(files)
    }
  }

  const handleSelectDestination = async (): Promise<void> => {
    const folder = await window.api.selectDestinationFolder()
    if (folder) {
      setDestinationFolder(folder)
    }
  }

  const handleStart = async (): Promise<void> => {
    const { fileQueue } = useAppStore.getState()
    if (fileQueue.length > 0) {
      const firstFile = fileQueue[0]
      const pdfPath = await window.api.ensurePdf(firstFile.path)
      setCurrentPdfPath(pdfPath)
    }
  }

  const canStart = sourceFolder && destinationFolder && useAppStore.getState().fileQueue.length > 0

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Trieur de Factures</h1>
          <p className="text-muted-foreground">Sélectionnez les dossiers pour commencer</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSelectSource}>
              <FolderOpen className="h-4 w-4" />
              {sourceFolder ? (
                <span className="truncate">{sourceFolder}</span>
              ) : (
                'Dossier source (factures)'
              )}
            </Button>
            {sourceFolder && (
              <p className="text-xs text-muted-foreground pl-1">
                {useAppStore.getState().fileQueue.length} fichier(s) trouvé(s)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSelectDestination}>
              <FolderOutput className="h-4 w-4" />
              {destinationFolder ? (
                <span className="truncate">{destinationFolder}</span>
              ) : (
                'Dossier destination (comptabilité)'
              )}
            </Button>
          </div>

          <Button className="w-full" disabled={!canStart} onClick={handleStart}>
            Commencer le tri
          </Button>
        </div>
      </div>
    </div>
  )
}
