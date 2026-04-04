import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

export function FileSidebar(): React.JSX.Element {
  const { fileQueue, currentIndex, setCurrentIndex, setCurrentPdfPath, isProcessing } = useAppStore()

  const handleClick = async (index: number): Promise<void> => {
    if (index === currentIndex || isProcessing) return
    setCurrentIndex(index)
    const file = fileQueue[index]
    if (file) {
      const pdfPath = await window.api.ensurePdf(file.path)
      setCurrentPdfPath(pdfPath)
    }
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
    </div>
  )
}
