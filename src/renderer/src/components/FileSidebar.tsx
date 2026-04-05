import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

export function FileSidebar(): React.JSX.Element {
  const { fileQueue, currentIndex, setCurrentIndex, isProcessing } = useAppStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null)

  const handleClick = (index: number): void => {
    if (index === currentIndex || isProcessing) return
    setCurrentIndex(index)
    // Le useEffect de App.tsx gere le reste :
    // resetForm (via setCurrentIndex du store), setFileLoading, ensurePdf,
    // setCurrentPdfPath, applyAiSuggestion
  }

  const handleIgnoreFromMenu = async (index: number): Promise<void> => {
    setContextMenu(null)
    setCurrentIndex(index)
    setTimeout(() => {
      useAppStore.getState().ignoreCurrentFile()
      const state = useAppStore.getState()
      if (state.fileQueue.length > 0) {
        const file = state.fileQueue[state.currentIndex]
        if (file) {
          window.api.ensurePdf(file.path).then(pdfPath => {
            state.setCurrentPdfPath(pdfPath)
          })
        }
      } else {
        useAppStore.getState().setCurrentPdfPath(null)
      }
    }, 0)
  }

  if (fileQueue.length === 0) return <></>

  return (
    <div className="h-full border-r border-border overflow-auto bg-card/50">
      <ul className="py-1">
        {fileQueue.map((file, index) => (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => handleClick(index)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, index })
              }}
              disabled={isProcessing}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs truncate transition-colors cursor-pointer',
                'hover:bg-accent disabled:cursor-not-allowed',
                index === currentIndex
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground'
              )}
              title={file.name}
            >
              {file.name}
            </button>
          </li>
        ))}
      </ul>
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-32 rounded-md border border-border bg-popover shadow-md py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
              onClick={() => handleIgnoreFromMenu(contextMenu.index)}
            >
              Ignorer
            </button>
          </div>
        </>
      )}
    </div>
  )
}
