import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts, degrees } from 'pdf-lib'
import { sanitizeFileName, parseIsoDate } from '../utils/sanitize'

// Must match VentilationLine in preload/index.d.ts
export interface VentilationLine {
  accountNumber: string
  accountLabel: string
  amount: string
}

export interface ProcessData {
  sourcePath: string
  accountNumber: string
  accountLabel: string
  date: string
  baseFolder: string
  fileName: string
  stampX: number
  stampY: number
  stampRotation: number
  customDest?: boolean
  useQuarterMode?: boolean
  ventilation?: VentilationLine[]
  stampIncludeLabel?: boolean
}

function getQuarter(month: number): string {
  if (month <= 3) return 'T1'
  if (month <= 6) return 'T2'
  if (month <= 9) return 'T3'
  return 'T4'
}

export interface ProcessResult {
  success: boolean
  destinationPath: string
  warning?: string
}

// --- Stamp helpers ---

interface StampParams {
  page: PDFPage
  font: PDFFont
  text: string
  stampX: number
  stampY: number
  stampRotation: number
  pageWidth: number
  pageHeight: number
}

function stampSingle(params: StampParams): void {
  const { page, font, text, stampX, stampY, stampRotation, pageWidth, pageHeight } = params

  const fontSize = Math.max(10, Math.min(16, pageWidth / 22))
  const textWidth = font.widthOfTextAtSize(text, fontSize)
  const padding = 4

  const boxW = textWidth + padding * 2
  const boxH = fontSize + padding * 2
  const x = Math.max(0, Math.min(stampX * pageWidth, pageWidth - boxW))
  const y = Math.max(0, Math.min(pageHeight - stampY * pageHeight - boxH, pageHeight - boxH))

  const rot = degrees(-stampRotation)
  const centerX = x + boxW / 2
  const centerY = y + boxH / 2
  const rad = (-stampRotation * Math.PI) / 180

  page.drawRectangle({
    x,
    y,
    width: boxW,
    height: boxH,
    color: rgb(1, 1, 1),
    opacity: 0.9,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 0.5,
    rotate: rot
  })

  // pdf-lib drawText rotates around (x, y), so compute text position
  // relative to the stamp center then rotate
  const localTx = padding - boxW / 2
  const localTy = padding - boxH / 2
  const textX = centerX + localTx * Math.cos(rad) - localTy * Math.sin(rad)
  const textY = centerY + localTx * Math.sin(rad) + localTy * Math.cos(rad)

  page.drawText(text, {
    x: textX,
    y: textY,
    size: fontSize,
    font,
    color: rgb(0.8, 0, 0),
    rotate: rot
  })
}

const MAX_VENTILATION_LINES = 8

function stampMultiple(
  page: PDFPage,
  font: PDFFont,
  ventilation: VentilationLine[],
  stampX: number,
  stampY: number,
  pageWidth: number,
  pageHeight: number,
  includeLabel = false
): string | undefined {
  let warning: string | undefined

  const lines = ventilation.slice(0, MAX_VENTILATION_LINES)
  if (ventilation.length > MAX_VENTILATION_LINES) {
    warning = `Ventilation tronquee : ${ventilation.length} lignes, max ${MAX_VENTILATION_LINES}`
  }

  const n = lines.length
  if (n === 0) return warning

  // Adaptive font size : readable but fits the vertical block in 40% of page height
  const fontSize = Math.max(7, Math.min(16, Math.min(pageWidth / 22, (pageHeight * 0.4) / (n * 1.6))))
  const padding = 4
  const lineH = fontSize + padding * 2

  // Compute the width needed for the widest line
  const texts = lines.map((l) => {
    const label = includeLabel && l.accountLabel ? ` - ${l.accountLabel}` : ''
    return `${l.accountNumber}${label} -> ${l.amount}`
  })
  const maxTextWidth = texts.reduce(
    (acc, t) => Math.max(acc, font.widthOfTextAtSize(t, fontSize)),
    0
  )
  const boxW = maxTextWidth + padding * 2

  // blockTopPdf : Y=0 is bottom in PDF, stampY=0 means top of canvas
  const blockTopPdf = pageHeight - stampY * pageHeight

  // Clamp block so it stays within the page
  const clampedTop = Math.min(blockTopPdf, pageHeight)
  const originX = Math.max(0, Math.min(stampX * pageWidth, pageWidth - boxW))

  for (let i = 0; i < n; i++) {
    // Line 0 is at the top of the block, lines go downward (decreasing Y in PDF coords)
    const lineY = clampedTop - lineH * (i + 1)
    const clampedLineY = Math.max(0, lineY)

    page.drawRectangle({
      x: originX,
      y: clampedLineY,
      width: boxW,
      height: lineH,
      color: rgb(1, 1, 1),
      opacity: 0.9,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.5
    })

    page.drawText(texts[i], {
      x: originX + padding,
      y: clampedLineY + padding,
      size: fontSize,
      font,
      color: rgb(0.8, 0, 0)
    })
  }

  return warning
}

// --- Main export ---

export async function processDocument(data: ProcessData): Promise<ProcessResult> {
  const {
    sourcePath,
    accountNumber,
    accountLabel,
    date,
    baseFolder,
    fileName,
    stampX,
    stampY,
    stampRotation,
    customDest,
    useQuarterMode
  } = data

  // 1. Build destination path
  let destFolder: string
  if (customDest) {
    destFolder = baseFolder
  } else {
    const parsed = parseIsoDate(date)
    if (!parsed) throw new Error(`Date invalide: ${date}`)
    const { year, month: monthNum } = parsed
    const subFolder = useQuarterMode
      ? getQuarter(monthNum)
      : String(monthNum).padStart(2, '0')
    destFolder = join(baseFolder, String(year), subFolder)
  }
  await mkdir(destFolder, { recursive: true })

  const safeFileName = sanitizeFileName(fileName, { destFolderLength: destFolder.length })
  const destPath = join(destFolder, `${safeFileName}.pdf`)

  // 2. Stamp the PDF
  const pdfBytes = await readFile(sourcePath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  if (pages.length === 0) {
    throw new Error('Le PDF ne contient aucune page')
  }
  const firstPage = pages[0]
  const { width: pageWidth, height: pageHeight } = firstPage.getSize()

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let warning: string | undefined

  if (data.ventilation && data.ventilation.length > 0) {
    warning = stampMultiple(
      firstPage,
      boldFont,
      data.ventilation,
      stampX,
      stampY,
      pageWidth,
      pageHeight,
      data.stampIncludeLabel
    )
  } else {
    const stampText = data.stampIncludeLabel
      ? `${accountNumber}${accountLabel ? ' - ' + accountLabel : ''}`
      : accountNumber
    stampSingle({
      page: firstPage,
      font: boldFont,
      text: stampText,
      stampX,
      stampY,
      stampRotation,
      pageWidth,
      pageHeight
    })
  }

  // 3. Save stamped PDF with integrity check
  const modifiedPdfBytes = await pdfDoc.save()
  await writeFile(destPath, modifiedPdfBytes)

  // 4. Verify written file integrity
  const writtenBytes = await readFile(destPath)
  const expectedHash = createHash('sha256').update(Buffer.from(modifiedPdfBytes)).digest('hex')
  const actualHash = createHash('sha256').update(writtenBytes).digest('hex')
  if (expectedHash !== actualHash) {
    throw new Error('Verification du fichier echoue : checksum incorrect apres ecriture')
  }

  // 5. Delete original source file
  await unlink(sourcePath)

  return { success: true, destinationPath: destPath, warning }
}

// --- AI Processing Hooks ---

/**
 * Hook point: pre-process a document before stamping.
 * Can be used to extract text via OCR/AI, auto-detect account, date, etc.
 * Returns suggested form data that can be used to pre-fill the form.
 */
export interface AiSuggestion {
  accountNumber?: string
  accountLabel?: string
  date?: string
  fixedPart?: string
  adjustablePart?: string
  amount?: string
  amountType?: 'ht' | 'ttc'
  confidence?: number
  rawText?: string
}

export type AiPreProcessHook = (pdfPath: string) => Promise<AiSuggestion | null>
export type AiPostProcessHook = (data: ProcessData, result: ProcessResult) => Promise<void>

let preProcessHook: AiPreProcessHook | null = null
let postProcessHook: AiPostProcessHook | null = null

export function registerAiPreProcessHook(hook: AiPreProcessHook): void {
  preProcessHook = hook
}

export function registerAiPostProcessHook(hook: AiPostProcessHook): void {
  postProcessHook = hook
}

export async function runAiPreProcess(pdfPath: string): Promise<AiSuggestion | null> {
  if (!preProcessHook) return null
  return preProcessHook(pdfPath)
}

export async function runAiPostProcess(data: ProcessData, result: ProcessResult): Promise<void> {
  if (!postProcessHook) return
  await postProcessHook(data, result)
}
