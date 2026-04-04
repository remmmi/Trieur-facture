import { Group, Panel, Separator } from 'react-resizable-panels'
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
      <Group orientation="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={14} minSize={10} maxSize={22}>
          <FileSidebar />
        </Panel>
        <Separator className="w-1 bg-border/40 hover:bg-primary/60 transition-colors duration-150 cursor-col-resize" />
        <Panel defaultSize={52} minSize={35} maxSize={65}>
          <div className="h-full p-4 overflow-auto">
            <PdfPreview />
          </div>
        </Panel>
        <Separator className="w-1 bg-border/40 hover:bg-primary/60 transition-colors duration-150 cursor-col-resize" />
        <Panel defaultSize={34} minSize={28} maxSize={45}>
          <div className="h-full p-4 overflow-auto">
            <ComptaForm />
          </div>
        </Panel>
      </Group>
      <div className="absolute bottom-2 left-2 z-10">
        <ThemeToggle />
      </div>
    </div>
  )
}
