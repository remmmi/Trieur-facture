import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface StampInfo {
  cx: number
  cy: number
  w: number
  h: number
  rad: number
}

export function PdfPreview(): React.JSX.Element {
  const { currentPdfPath, currentFormData, stampX, stampY, stampRotation, setStampPosition, setStampRotation, ventilationEnabled, ventilationLines } = useAppStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stampIncludeLabel, setStampIncludeLabel] = useState(false)

  useEffect(() => {
    window.api.getStampIncludeLabel().then(setStampIncludeLabel)
  }, [])

  // Drag state (not in store, local only)
  const dragging = useRef(false)
  const dragOffset = useRef({ dx: 0, dy: 0 })
  const lastStamp = useRef<StampInfo | null>(null)
  const viewportRef = useRef<{ width: number; height: number }>({ width: 1, height: 1 })

  const drawStamp = useCallback(
    (context: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
      const state = useAppStore.getState()
      const { ventilationEnabled: vEnabled, ventilationLines: vLines } = state

      if (vEnabled && vLines.length > 0) {
        // Mode ventile : N tampons empiles, pas de rotation
        const pdfW = canvasW / scale
        const N = Math.min(vLines.length, 8)
        const fontSizeByWidth = Math.max(8, Math.min(16, pdfW / 22))
        const maxBlockH = canvasH * 0.4
        const fontSizeByHeight = Math.floor(maxBlockH / (N * 1.6))
        const fontSize = Math.max(7, Math.min(fontSizeByWidth, fontSizeByHeight)) * scale
        const padding = 4 * scale

        context.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`

        const stampTexts = vLines.slice(0, N).map(l => {
          const label = stampIncludeLabel && l.accountLabel ? ` - ${l.accountLabel}` : ''
          return `${l.accountNumber}${label} -> ${l.amount}`
        })
        const maxTextWidth = Math.max(...stampTexts.map(t => context.measureText(t).width))
        const boxW = maxTextWidth + padding * 2
        const lineH = fontSize + padding * 2

        const { stampX: sx, stampY: sy } = state
        const blockX = sx * canvasW
        const blockY = sy * canvasH

        stampTexts.forEach((text, i) => {
          const y = blockY + i * lineH

          context.fillStyle = 'rgba(255, 255, 255, 0.9)'
          context.fillRect(blockX, y, boxW, lineH)
          context.strokeStyle = 'rgba(150, 150, 150, 0.8)'
          context.lineWidth = 0.5 * scale
          context.strokeRect(blockX, y, boxW, lineH)
          context.fillStyle = 'rgba(200, 0, 0, 1)'
          context.fillText(text, blockX + padding, y + padding + fontSize * 0.85)
        })

        // Stocker le bloc entier pour le drag (hit-test)
        const totalH = N * lineH
        lastStamp.current = {
          cx: blockX + boxW / 2,
          cy: blockY + totalH / 2,
          w: boxW,
          h: totalH,
          rad: 0
        }
        return
      }

      // --- Mode simple (code existant) ---
      const { accountNumber, accountLabel } = state.currentFormData
      if (!accountNumber) {
        lastStamp.current = null
        return
      }

      const stampText = stampIncludeLabel
        ? `${accountNumber}${accountLabel ? ' - ' + accountLabel : ''}`
        : accountNumber
      const pdfW = canvasW / scale
      const fontSize = Math.max(10, Math.min(16, pdfW / 22)) * scale
      const padding = 4 * scale

      context.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`
      const textWidth = context.measureText(stampText).width
      const boxW = textWidth + padding * 2
      const boxH = fontSize + padding * 2

      const { stampX: sx, stampY: sy, stampRotation: rot } = state
      const cx = sx * canvasW
      const cy = sy * canvasH

      // Center of the stamp box for rotation
      const centerX = cx + boxW / 2
      const centerY = cy + boxH / 2
      const rad = (rot * Math.PI) / 180

      context.save()
      context.translate(centerX, centerY)
      context.rotate(rad)
      context.translate(-boxW / 2, -boxH / 2)

      // White background with border
      context.fillStyle = 'rgba(255, 255, 255, 0.9)'
      context.fillRect(0, 0, boxW, boxH)
      context.strokeStyle = 'rgba(150, 150, 150, 0.8)'
      context.lineWidth = 0.5 * scale
      context.strokeRect(0, 0, boxW, boxH)

      // Red text
      context.fillStyle = 'rgba(200, 0, 0, 1)'
      context.fillText(stampText, padding, padding + fontSize * 0.85)

      context.restore()

      lastStamp.current = { cx: centerX, cy: centerY, w: boxW, h: boxH, rad }
    },
    [scale, stampIncludeLabel]
  )

  const activeRenderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const renderPage = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Cancel any in-flight render before starting a new one
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel()
        activeRenderTaskRef.current = null
      }

      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height
      viewportRef.current = { width: viewport.width, height: viewport.height }

      const context = canvas.getContext('2d')
      if (!context) return

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      const renderTask = page.render({ canvasContext: context, viewport, canvas } as never)
      activeRenderTaskRef.current = renderTask

      try {
        await renderTask.promise
      } catch {
        return // cancelled
      }
      activeRenderTaskRef.current = null

      if (pageNum === 1) {
        drawStamp(context, viewport.width, viewport.height)
      }
    },
    [scale, drawStamp]
  )

  useEffect(() => {
    if (!currentPdfPath) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const loadPdf = async (): Promise<void> => {
      try {
        const data = await window.api.readFile(currentPdfPath)
        const doc = await pdfjsLib.getDocument({ data }).promise
        if (cancelled) {
          doc.destroy()
          return
        }
        // Auto-fit: calculate scale to fill container width
        const firstPage = await doc.getPage(1)
        const unscaledViewport = firstPage.getViewport({ scale: 1 })
        const container = containerRef.current
        if (container) {
          const containerWidth = container.clientWidth - 32 // padding
          const fitScale = containerWidth / unscaledViewport.width
          setScale(Math.max(0.5, Math.min(3, fitScale)))
        }
        setPdfDoc(doc)
        setTotalPages(doc.numPages)
        if (doc.numPages === 0) {
          setError('Le document PDF est vide (0 pages)')
          return
        }
        setCurrentPage(1)
        await renderPage(doc, 1)
      } catch (err) {
        if (!cancelled) {
          setError(`Erreur de chargement: ${err instanceof Error ? err.message : String(err)}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPdf()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPdfPath])

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(pdfDoc, currentPage)
    }
  }, [pdfDoc, currentPage, renderPage])

  // Re-render stamp preview when account or position changes
  useEffect(() => {
    if (pdfDoc && currentPage === 1) {
      renderPage(pdfDoc, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormData.accountNumber, currentFormData.accountLabel, stampX, stampY, stampRotation, ventilationEnabled, ventilationLines, stampIncludeLabel])

  // --- Drag handlers ---
  const getCanvasPos = (e: React.MouseEvent): { cx: number; cy: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { cx: 0, cy: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      cx: (e.clientX - rect.left) * scaleX,
      cy: (e.clientY - rect.top) * scaleY
    }
  }

  const isInsideStamp = (px: number, py: number): boolean => {
    const s = lastStamp.current
    if (!s) return false
    // Rotate point back into stamp's local space
    const dx = px - s.cx
    const dy = py - s.cy
    const cos = Math.cos(-s.rad)
    const sin = Math.sin(-s.rad)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    return Math.abs(lx) <= s.w / 2 + 4 && Math.abs(ly) <= s.h / 2 + 4
  }

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (currentPage !== 1) return
    const { cx, cy } = getCanvasPos(e)
    if (isInsideStamp(cx, cy)) {
      dragging.current = true
      const s = lastStamp.current!
      // Offset from stamp's top-left (in canvas coords, before rotation)
      const topLeftX = s.cx - s.w / 2
      const topLeftY = s.cy - s.h / 2
      dragOffset.current = { dx: cx - topLeftX, dy: cy - topLeftY }
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (!dragging.current) {
      // Change cursor when hovering stamp
      const canvas = canvasRef.current
      if (canvas && currentPage === 1) {
        const { cx, cy } = getCanvasPos(e)
        canvas.style.cursor = isInsideStamp(cx, cy) ? 'grab' : ''
      }
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.cursor = 'grabbing'
    const { cx, cy } = getCanvasPos(e)
    const newX = (cx - dragOffset.current.dx) / canvas.width
    const newY = (cy - dragOffset.current.dy) / canvas.height
    setStampPosition(Math.max(0, Math.min(1, newX)), Math.max(0, Math.min(1, newY)))
  }

  const handleMouseUp = (): void => {
    if (dragging.current) {
      dragging.current = false
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = ''
    }
  }

  // Callback ref: attach wheel listener as soon as the scroll container mounts
  const wheelHandler = useRef<((e: WheelEvent) => void) | null>(null)
  const scrollNodeRef = useRef<HTMLDivElement | null>(null)

  // Keep the handler fresh
  wheelHandler.current = (e: WheelEvent): void => {
    if (useAppStore.getState().ventilationEnabled) return
    if (currentPage !== 1) return
    const canvas = canvasRef.current
    const s = lastStamp.current
    if (!canvas || !s) return

    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    const px = (e.clientX - rect.left) * sx
    const py = (e.clientY - rect.top) * sy

    // Hit test: rotate point into stamp's local space
    const dx = px - s.cx
    const dy = py - s.cy
    const cos = Math.cos(-s.rad)
    const sin = Math.sin(-s.rad)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    if (Math.abs(lx) > s.w / 2 + 8 || Math.abs(ly) > s.h / 2 + 8) return

    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? 5 : -5
    setStampRotation(useAppStore.getState().stampRotation + delta)
  }

  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let resizeTimer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (pdfDoc && currentPage > 0) {
          renderPage(pdfDoc, currentPage)
        }
      }, 100)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(resizeTimer)
    }
  }, [pdfDoc, currentPage, renderPage])

  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    // Detach from previous node
    if (scrollNodeRef.current) {
      scrollNodeRef.current.removeEventListener('wheel', (scrollNodeRef.current as unknown as Record<string, EventListener>).__wheelFn)
    }
    if (node) {
      const fn = (e: WheelEvent): void => wheelHandler.current?.(e)
      ;(node as unknown as Record<string, unknown>).__wheelFn = fn
      node.addEventListener('wheel', fn, { passive: false })
    }
    scrollNodeRef.current = node
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!currentPdfPath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Aucun document selectionne
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Chargement du document...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[80px] text-center">
            Page {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-auto flex justify-center items-start">
          <canvas
            ref={canvasRef}
            className="shrink-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </div>
  )
}
