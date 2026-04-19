import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const { currentPdfPath, currentFormData, stampX, stampY, stampRotation, setStampPosition, setStampRotation, ventilationEnabled, ventilationLines, fileLoading } = useAppStore()
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [visiblePage, setVisiblePage] = useState(1)
  const [scale, setScale] = useState(1)
  const hasAutoFit = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stampIncludeLabel, setStampIncludeLabel] = useState(false)

  // Canvas refs for all pages
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const activeRenderTasks = useRef<Map<number, { cancel: () => void }>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Drag state
  const dragging = useRef(false)
  const dragOffset = useRef({ dx: 0, dy: 0 })
  const lastStamp = useRef<StampInfo | null>(null)

  useEffect(() => {
    window.api.getStampIncludeLabel().then(setStampIncludeLabel)
  }, [])

  const setCanvasRef = useCallback((pageNum: number) => (el: HTMLCanvasElement | null) => {
    if (el) {
      canvasRefs.current.set(pageNum, el)
    } else {
      canvasRefs.current.delete(pageNum)
    }
  }, [])

  // --- Draw stamp on page 1 canvas ---
  const drawStamp = useCallback(
    (context: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
      const state = useAppStore.getState()
      const { ventilationEnabled: vEnabled, ventilationLines: vLines } = state

      if (vEnabled && vLines.length > 0) {
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
          const amount = l.amount ? `${l.amount.replace('.', ',')}\u20ac` : ''
          return `${l.accountNumber}${label} : ${amount}`
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

        const { paid, paymentMode } = state.currentFormData
        const composedPaid = paymentMode && paid ? `${paymentMode} ${paid}` : paymentMode || paid
        if (composedPaid) {
          const paidText = `Paye : ${composedPaid}`
          const paidY = blockY + N * lineH
          context.fillStyle = 'rgba(255, 255, 255, 0.9)'
          context.fillRect(blockX, paidY, boxW, lineH)
          context.strokeStyle = 'rgba(100, 100, 200, 0.8)'
          context.lineWidth = 0.5 * scale
          context.strokeRect(blockX, paidY, boxW, lineH)
          context.fillStyle = 'rgba(0, 0, 200, 1)'
          context.fillText(paidText, blockX + padding, paidY + padding + fontSize * 0.85)
        }

        const totalH = (N + (composedPaid ? 1 : 0)) * lineH
        lastStamp.current = { cx: blockX + boxW / 2, cy: blockY + totalH / 2, w: boxW, h: totalH, rad: 0 }
        return
      }

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
      const centerX = cx + boxW / 2
      const centerY = cy + boxH / 2
      const rad = (rot * Math.PI) / 180

      context.save()
      context.translate(centerX, centerY)
      context.rotate(rad)
      context.translate(-boxW / 2, -boxH / 2)
      context.fillStyle = 'rgba(255, 255, 255, 0.9)'
      context.fillRect(0, 0, boxW, boxH)
      context.strokeStyle = 'rgba(150, 150, 150, 0.8)'
      context.lineWidth = 0.5 * scale
      context.strokeRect(0, 0, boxW, boxH)
      context.fillStyle = 'rgba(200, 0, 0, 1)'
      context.fillText(stampText, padding, padding + fontSize * 0.85)
      context.restore()

      const { paid, paymentMode } = state.currentFormData
      const composedPaid = paymentMode && paid ? `${paymentMode} ${paid}` : paymentMode || paid
      if (composedPaid) {
        const paidText = `Paye : ${composedPaid}`
        context.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`
        const paidTextWidth = context.measureText(paidText).width
        const paidBoxW = paidTextWidth + padding * 2
        const paidBoxH = fontSize + padding * 2
        const paidY = cy + boxH

        context.save()
        context.translate(cx + paidBoxW / 2, paidY + paidBoxH / 2)
        context.rotate(rad)
        context.translate(-paidBoxW / 2, -paidBoxH / 2)
        context.fillStyle = 'rgba(255, 255, 255, 0.9)'
        context.fillRect(0, 0, paidBoxW, paidBoxH)
        context.strokeStyle = 'rgba(100, 100, 200, 0.8)'
        context.lineWidth = 0.5 * scale
        context.strokeRect(0, 0, paidBoxW, paidBoxH)
        context.fillStyle = 'rgba(0, 0, 200, 1)'
        context.fillText(paidText, padding, padding + fontSize * 0.85)
        context.restore()

        lastStamp.current = { cx: centerX, cy: centerY + paidBoxH / 2, w: Math.max(boxW, paidBoxW), h: boxH + paidBoxH, rad }
        return
      }

      lastStamp.current = { cx: centerX, cy: centerY, w: boxW, h: boxH, rad }
    },
    [scale, stampIncludeLabel]
  )

  // --- Render a single page to its canvas ---
  const renderPage = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      const canvas = canvasRefs.current.get(pageNum)
      if (!canvas) return

      const existing = activeRenderTasks.current.get(pageNum)
      if (existing) {
        existing.cancel()
        activeRenderTasks.current.delete(pageNum)
      }

      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height

      const context = canvas.getContext('2d')
      if (!context) return

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      const renderTask = page.render({ canvasContext: context, viewport, canvas } as never)
      activeRenderTasks.current.set(pageNum, renderTask)

      try {
        await renderTask.promise
      } catch {
        return
      }
      activeRenderTasks.current.delete(pageNum)

      if (pageNum === 1) {
        drawStamp(context, viewport.width, viewport.height)
      }
    },
    [scale, drawStamp]
  )

  // --- Render all pages ---
  const renderAllPages = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy) => {
      for (let i = 1; i <= doc.numPages; i++) {
        await renderPage(doc, i)
      }
    },
    [renderPage]
  )

  // --- Load PDF ---
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
        hasAutoFit.current = false
        setPdfDoc(doc)
        setTotalPages(doc.numPages)
        setVisiblePage(1)
        if (doc.numPages === 0) {
          setError('Le document PDF est vide (0 pages)')
        }
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

  // Auto-fit zoom
  useEffect(() => {
    if (!pdfDoc || hasAutoFit.current) return
    const container = containerRef.current
    if (!container) return
    pdfDoc.getPage(1).then(page => {
      const unscaledViewport = page.getViewport({ scale: 1 })
      const containerWidth = container.clientWidth - 32
      if (containerWidth > 0) {
        const fitScale = containerWidth / unscaledViewport.width
        setScale(Math.max(0.5, Math.min(3, fitScale)))
        hasAutoFit.current = true
      }
    })
  }, [pdfDoc])

  // Render all pages when doc/scale changes
  useEffect(() => {
    if (pdfDoc && totalPages > 0) {
      renderAllPages(pdfDoc)
    }
  }, [pdfDoc, totalPages, renderAllPages])

  // Re-render stamp on page 1 only when stamp-related state changes
  useEffect(() => {
    if (pdfDoc) {
      renderPage(pdfDoc, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormData.accountNumber, currentFormData.accountLabel, currentFormData.paid, currentFormData.paymentMode, stampX, stampY, stampRotation, ventilationEnabled, ventilationLines, stampIncludeLabel])

  // Track visible page via scroll position
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || totalPages <= 1) return
    const handleScroll = (): void => {
      const containerTop = scrollEl.getBoundingClientRect().top
      let closestPage = 1
      let closestDist = Infinity
      for (let i = 1; i <= totalPages; i++) {
        const canvas = canvasRefs.current.get(i)
        if (!canvas) continue
        const rect = canvas.getBoundingClientRect()
        const dist = Math.abs(rect.top - containerTop)
        if (dist < closestDist) {
          closestDist = dist
          closestPage = i
        }
      }
      setVisiblePage(closestPage)
    }
    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [totalPages])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let resizeTimer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (pdfDoc) renderAllPages(pdfDoc)
      }, 100)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(resizeTimer)
    }
  }, [pdfDoc, renderAllPages])

  // --- Drag handlers (page 1 only) ---
  const getCanvasPos = (e: React.MouseEvent): { cx: number; cy: number } | null => {
    const canvas = canvasRefs.current.get(1)
    if (!canvas) return null
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
    const dx = px - s.cx
    const dy = py - s.cy
    const cos = Math.cos(-s.rad)
    const sin = Math.sin(-s.rad)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    return Math.abs(lx) <= s.w / 2 + 4 && Math.abs(ly) <= s.h / 2 + 4
  }

  const handleMouseDown = (e: React.MouseEvent): void => {
    const pos = getCanvasPos(e)
    if (!pos) return
    if (isInsideStamp(pos.cx, pos.cy)) {
      dragging.current = true
      const s = lastStamp.current!
      const topLeftX = s.cx - s.w / 2
      const topLeftY = s.cy - s.h / 2
      dragOffset.current = { dx: pos.cx - topLeftX, dy: pos.cy - topLeftY }
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    const canvas = canvasRefs.current.get(1)
    if (!dragging.current) {
      if (canvas) {
        const pos = getCanvasPos(e)
        canvas.style.cursor = pos && isInsideStamp(pos.cx, pos.cy) ? 'grab' : ''
      }
      return
    }
    if (!canvas) return
    canvas.style.cursor = 'grabbing'
    const pos = getCanvasPos(e)
    if (!pos) return
    const newX = (pos.cx - dragOffset.current.dx) / canvas.width
    const newY = (pos.cy - dragOffset.current.dy) / canvas.height
    setStampPosition(Math.max(0, Math.min(1, newX)), Math.max(0, Math.min(1, newY)))
  }

  const handleMouseUp = (): void => {
    if (dragging.current) {
      dragging.current = false
      const canvas = canvasRefs.current.get(1)
      if (canvas) canvas.style.cursor = ''
    }
  }

  // --- Wheel handler for stamp rotation (page 1 only) ---
  const wheelHandler = useRef<((e: WheelEvent) => void) | null>(null)
  const scrollNodeRef = useRef<HTMLDivElement | null>(null)

  wheelHandler.current = (e: WheelEvent): void => {
    if (useAppStore.getState().ventilationEnabled) return
    const canvas = canvasRefs.current.get(1)
    const s = lastStamp.current
    if (!canvas || !s) return

    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    const px = (e.clientX - rect.left) * sx
    const py = (e.clientY - rect.top) * sy

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

  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (scrollNodeRef.current) {
      scrollNodeRef.current.removeEventListener('wheel', (scrollNodeRef.current as unknown as Record<string, EventListener>).__wheelFn)
    }
    if (node) {
      const fn = (e: WheelEvent): void => wheelHandler.current?.(e)
      ;(node as unknown as Record<string, unknown>).__wheelFn = fn
      node.addEventListener('wheel', fn, { passive: false })
    }
    scrollNodeRef.current = node
    scrollRef.current = node
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
    <div className="flex flex-col h-full relative">
      {fileLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
        <span className="text-sm min-w-[80px] text-center text-muted-foreground">
          Page {visiblePage} / {totalPages}
        </span>
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

      <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
        <div ref={scrollContainerRef} className="flex-1 overflow-auto flex flex-col items-center gap-2 bg-neutral-800 dark:bg-neutral-900 rounded-md p-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <canvas
              key={pageNum}
              ref={setCanvasRef(pageNum)}
              className="shrink-0"
              onMouseDown={pageNum === 1 ? handleMouseDown : undefined}
              onMouseMove={pageNum === 1 ? handleMouseMove : undefined}
              onMouseUp={pageNum === 1 ? handleMouseUp : undefined}
              onMouseLeave={pageNum === 1 ? handleMouseUp : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
