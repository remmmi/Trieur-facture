import { PdfPreview } from './PdfPreview'
import { ComptaForm } from './ComptaForm'
import { FileQueue } from './FileQueue'

interface LayoutProps {
  onOpenSettings: () => void
}

export function Layout({ onOpenSettings }: LayoutProps): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen">
      <FileQueue onOpenSettings={onOpenSettings} />
      <div className="flex flex-1 min-h-0">
        <div className="w-[60%] border-r border-border p-4 overflow-auto">
          <PdfPreview />
        </div>
        <div className="w-[40%] p-4 overflow-auto">
          <ComptaForm />
        </div>
      </div>
    </div>
  )
}
