import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react'

export function FileQueue(): React.JSX.Element {
  const { fileQueue, currentIndex, nextFile, prevFile, sourceFolder } = useAppStore()

  const currentFile = fileQueue[currentIndex]
  const total = fileQueue.length

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        <span className="truncate max-w-[300px]">{sourceFolder || 'Aucun dossier'}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={prevFile} disabled={currentIndex <= 0 || total === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium min-w-[80px] text-center">
          {total > 0 ? `${currentIndex + 1} / ${total}` : 'Aucun fichier'}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={nextFile}
          disabled={currentIndex >= total - 1 || total === 0}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground truncate max-w-[300px]">
        {currentFile ? currentFile.name : ''}
      </div>
    </div>
  )
}
