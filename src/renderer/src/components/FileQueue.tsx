import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, FolderOpen, RefreshCw, Settings } from 'lucide-react'

interface FileQueueProps {
  onOpenSettings: () => void
}

export function FileQueue({ onOpenSettings }: FileQueueProps): React.JSX.Element {
  const { fileQueue, currentIndex, nextFile, prevFile, sourceFolder, isProcessing, setFileQueue, setCurrentPdfPath, resetForm } = useAppStore()
  const [reloading, setReloading] = useState(false)

  const currentFile = fileQueue[currentIndex]
  const total = fileQueue.length

  const handleReload = async (): Promise<void> => {
    if (!sourceFolder || reloading) return
    setReloading(true)
    try {
      const files = await window.api.scanFolder(sourceFolder)
      setFileQueue(files as typeof fileQueue)
      resetForm()
      if (files.length > 0) {
        const pdfPath = await window.api.ensurePdf((files[0] as typeof fileQueue[0]).path)
        setCurrentPdfPath(pdfPath)
      } else {
        setCurrentPdfPath(null)
      }
    } finally {
      setReloading(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        <span className="truncate max-w-[300px]">{sourceFolder || 'Aucun dossier'}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={prevFile} disabled={currentIndex <= 0 || total === 0 || isProcessing}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium min-w-[80px] text-center">
          {total > 0 ? `${currentIndex + 1} / ${total}` : 'Aucun fichier'}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleReload}
          disabled={!sourceFolder || reloading || isProcessing}
          title="Recharger les fichiers du dossier source"
          className="h-6 w-6"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${reloading ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={nextFile}
          disabled={currentIndex >= total - 1 || total === 0 || isProcessing}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground truncate max-w-[250px]">
          {currentFile ? currentFile.name : ''}
        </span>
        <Button variant="ghost" size="icon" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
