import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { loadPlanComptable } from '@/data/planComptable'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { Layout } from '@/components/Layout'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Sparkles } from 'lucide-react'
import { parseIsoDate } from '@/lib/sanitize'

function App(): React.JSX.Element {
  const { currentPdfPath, fileQueue, currentIndex, setCurrentPdfPath, hasStarted, setFileLoading } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showLargeFileModal, setShowLargeFileModal] = useState(false)
  const [pendingAiPath, setPendingAiPath] = useState<string | null>(null)
  const [largeFilePageCount, setLargeFilePageCount] = useState(0)

  const applyAiSuggestion = useCallback(async (pdfPath: string): Promise<void> => {
    useAppStore.getState().setAiProcessing(true)
    try {
      const suggestion = await window.api.aiPreProcess(pdfPath)
      if (suggestion) {
        const { setFormData, setAiExtractedSupplier } = useAppStore.getState()
        setFormData({
          ...(suggestion.accountNumber && { accountNumber: suggestion.accountNumber }),
          ...(suggestion.accountLabel && { accountLabel: suggestion.accountLabel }),
          ...(suggestion.date && parseIsoDate(suggestion.date) && { date: suggestion.date }),
          ...(suggestion.fixedPart && { fixedPart: suggestion.fixedPart }),
          ...(suggestion.adjustablePart && { adjustablePart: suggestion.adjustablePart }),
          ...(suggestion.amount && { amount: suggestion.amount })
        })
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
      useAppStore.getState().setAiProcessing(false)
    }
  }, [])

  // Warn on close if there are ignored files
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent): void => {
      const { ignoredFiles } = useAppStore.getState()
      if (ignoredFiles.length > 0) {
        e.preventDefault()
        e.returnValue = `${ignoredFiles.length} fichier(s) ignore(s) restent dans le dossier source.`
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

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
      setFileLoading(true)
      try {
        const pdfPath = await window.api.ensurePdf(currentFile.path)
        if (cancelled) return
        setCurrentPdfPath(pdfPath)

        // Check page count before triggering AI
        try {
          const pageCount = await window.api.getPageCount(pdfPath)
          const threshold = await window.api.getLargeFileThreshold()
          if (pageCount > threshold) {
            setLargeFilePageCount(pageCount)
            setPendingAiPath(pdfPath)
            setShowLargeFileModal(true)
            return
          }
        } catch {
          // getPageCount failed (encrypted, etc.) - proceed normally
        }

        if (!cancelled) {
          await applyAiSuggestion(pdfPath)
        }
      } finally {
        if (!cancelled) setFileLoading(false)
      }
    }
    loadPdf()
    return () => {
      cancelled = true
    }
  }, [fileQueue, currentIndex, setCurrentPdfPath, hasStarted, applyAiSuggestion])

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

  return (
    <>
      <Layout onOpenSettings={() => setShowSettings(true)} />
      {showLargeFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-sm w-full mx-4 rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-amber-500/10 p-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <h2 className="text-base font-semibold">Fichier volumineux</h2>
              <p className="text-sm text-muted-foreground">
                Ce document fait {largeFilePageCount} pages. L'analyse IA peut prendre du temps et
                consommer des tokens.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowLargeFileModal(false)
                  setPendingAiPath(null)
                }}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                onClick={async () => {
                  setShowLargeFileModal(false)
                  if (pendingAiPath) {
                    await applyAiSuggestion(pendingAiPath)
                    setPendingAiPath(null)
                  }
                }}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Analyser
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
