import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { loadPlanComptable } from '@/data/planComptable'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { Layout } from '@/components/Layout'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import { parseIsoDate } from '@/lib/sanitize'

function App(): React.JSX.Element {
  const { currentPdfPath, fileQueue, currentIndex, setCurrentPdfPath, hasStarted } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)

  // Load custom plan comptable on startup
  useEffect(() => {
    loadPlanComptable()
  }, [])

  // Load PDF when current file changes (only after user started)
  useEffect(() => {
    if (!hasStarted) return
    const currentFile = fileQueue[currentIndex]
    if (!currentFile) return

    let cancelled = false
    const loadPdf = async (): Promise<void> => {
      const pdfPath = await window.api.ensurePdf(currentFile.path)
      if (!cancelled) {
        setCurrentPdfPath(pdfPath)

        // Try AI pre-processing if available
        try {
          useAppStore.getState().setAiProcessing(true)
          const suggestion = await window.api.aiPreProcess(pdfPath)
          if (suggestion && !cancelled) {
            const { setFormData, setAiExtractedSupplier } = useAppStore.getState()
            setFormData({
              ...(suggestion.accountNumber && { accountNumber: suggestion.accountNumber }),
              ...(suggestion.accountLabel && { accountLabel: suggestion.accountLabel }),
              ...(suggestion.date && parseIsoDate(suggestion.date) && { date: suggestion.date }),
              ...(suggestion.fixedPart && { fixedPart: suggestion.fixedPart }),
              ...(suggestion.adjustablePart && { adjustablePart: suggestion.adjustablePart }),
              ...(suggestion.amount && { amount: suggestion.amount })
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes('AI_NO_CREDIT') || msg.includes('AI_AUTH_ERROR')) {
            console.warn('AI disabled:', msg)
          }
        } finally {
          if (!cancelled) useAppStore.getState().setAiProcessing(false)
        }
      }
    }
    loadPdf()
    return () => {
      cancelled = true
    }
  }, [fileQueue, currentIndex, setCurrentPdfPath, hasStarted])

  // Settings panel
  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} />
  }

  // Welcome screen: user hasn't started yet
  if (!hasStarted) {
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
              useAppStore.getState().setHasStarted(false)
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
