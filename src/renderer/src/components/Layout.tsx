import { PdfPreview } from './PdfPreview'
import { ComptaForm } from './ComptaForm'
import { FileQueue } from './FileQueue'
import { ThemeToggle } from './ThemeToggle'

interface LayoutProps {
  onOpenSettings: () => void
}

export function Layout({ onOpenSettings }: LayoutProps): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen relative">
      <FileQueue onOpenSettings={onOpenSettings} />
      <div className="flex flex-1 min-h-0">
        <div className="w-[60%] border-r border-border p-4 overflow-auto">
          <PdfPreview />
        </div>
        <div className="w-[40%] p-4 overflow-auto">
          <ComptaForm />
        </div>
      </div>
      <div className="absolute bottom-2 left-2">
        <ThemeToggle />
      </div>
    </div>
  )
}
