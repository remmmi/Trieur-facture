import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { PdfPreview } from './PdfPreview'
import { ComptaForm } from './ComptaForm'
import { FileQueue } from './FileQueue'
import { FileSidebar } from './FileSidebar'
import { ThemeToggle } from './ThemeToggle'

interface LayoutProps {
  onOpenSettings: () => void
}

export function Layout({ onOpenSettings }: LayoutProps): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen relative">
      <FileQueue onOpenSettings={onOpenSettings} />
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={14} minSize={10} maxSize={22}>
          <FileSidebar />
        </Panel>
        <PanelResizeHandle className="w-1.5 bg-border/40 hover:bg-primary/60 transition-colors duration-150" />
        <Panel defaultSize={52} minSize={35} maxSize={65}>
          <div className="h-full p-4 overflow-auto">
            <PdfPreview />
          </div>
        </Panel>
        <PanelResizeHandle className="w-1.5 bg-border/40 hover:bg-primary/60 transition-colors duration-150" />
        <Panel defaultSize={34} minSize={28} maxSize={45}>
          <div className="h-full px-3 py-2 overflow-hidden flex flex-col">
            <ComptaForm />
          </div>
        </Panel>
      </PanelGroup>
      <div className="absolute bottom-2 left-2 z-10">
        <ThemeToggle />
      </div>
    </div>
  )
}
