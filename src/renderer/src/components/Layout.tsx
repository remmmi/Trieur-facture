import { PdfPreview } from './PdfPreview'
import { ComptaForm } from './ComptaForm'
import { FileQueue } from './FileQueue'

export function Layout(): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen">
      <FileQueue />
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
