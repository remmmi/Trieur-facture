import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { Layout } from '@/components/Layout'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

function App(): React.JSX.Element {
  const { currentPdfPath, fileQueue, currentIndex, setCurrentPdfPath, sourceFolder } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)

  // Load PDF when current file changes
  useEffect(() => {
    const currentFile = fileQueue[currentIndex]
    if (!currentFile) return

    let cancelled = false
    const loadPdf = async (): Promise<void> => {
      const pdfPath = await window.api.ensurePdf(currentFile.path)
      if (!cancelled) {
        setCurrentPdfPath(pdfPath)

        // Try AI pre-processing if available
        try {
          const suggestion = await window.api.aiPreProcess(pdfPath)
          if (suggestion && !cancelled) {
            const { setFormData, setAiExtractedSupplier } = useAppStore.getState()
            setFormData({
              ...(suggestion.accountNumber && { accountNumber: suggestion.accountNumber }),
              ...(suggestion.accountLabel && { accountLabel: suggestion.accountLabel }),
              ...(suggestion.date && { date: suggestion.date }),
              ...(suggestion.fixedPart && { fixedPart: suggestion.fixedPart }),
              ...(suggestion.adjustablePart && { adjustablePart: suggestion.adjustablePart })
            })
            // Store the raw supplier name from AI for potential mapping save
            if (suggestion.rawText) {
              try {
                const parsed = JSON.parse(suggestion.rawText)
                if (parsed.supplierName) {
                  setAiExtractedSupplier(parsed.supplierName)
                }
              } catch {
                // rawText might not be JSON
              }
            }
          }
        } catch {
          // AI pre-process is optional, ignore errors
        }
      }
    }
    loadPdf()
    return () => {
      cancelled = true
    }
  }, [fileQueue, currentIndex, setCurrentPdfPath])

  // Settings panel
  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} />
  }

  // Welcome screen: no source folder selected yet
  if (!sourceFolder) {
    return <WelcomeScreen onOpenSettings={() => setShowSettings(true)} />
  }

  // All files processed
  if (fileQueue.length === 0 && currentPdfPath === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold">Tous les fichiers ont été traités !</h1>
          <p className="text-muted-foreground">
            Tous les documents ont été classés avec succès.
          </p>
          <Button
            onClick={() => {
              useAppStore.getState().setSourceFolder(null)
              useAppStore.getState().setCurrentPdfPath(null)
            }}
          >
            Traiter un autre dossier
          </Button>
        </div>
      </div>
    )
  }

  return <Layout onOpenSettings={() => setShowSettings(true)} />
}

export default App
