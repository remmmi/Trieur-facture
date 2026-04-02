import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'

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
}

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
    const dateObj = new Date(date)
    const year = dateObj.getFullYear()
    const monthNum = dateObj.getMonth() + 1
    const subFolder = useQuarterMode
      ? getQuarter(monthNum)
      : String(monthNum).padStart(2, '0')
    destFolder = join(baseFolder, String(year), subFolder)
  }
  await mkdir(destFolder, { recursive: true })

  const destPath = join(destFolder, `${fileName}.pdf`)

  // 2. Stamp the PDF
  const pdfBytes = await readFile(sourcePath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const firstPage = pdfDoc.getPages()[0]

  const stampText = `${accountNumber}${accountLabel ? ' - ' + accountLabel : ''}`
  const { width: pageWidth, height: pageHeight } = firstPage.getSize()

  // Scale font size relative to page width (readable on both A4 and receipts)
  const fontSize = Math.max(8, Math.min(12, pageWidth / 30))
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const textWidth = boldFont.widthOfTextAtSize(stampText, fontSize)
  const padding = 4

  // Position from ratios (stampX/stampY are 0-1 ratios, Y is inverted: 0=top in canvas, but bottom in PDF)
  const boxW = textWidth + padding * 2
  const boxH = fontSize + padding * 2
  const x = Math.max(0, Math.min(stampX * pageWidth, pageWidth - boxW))
  const y = Math.max(0, Math.min(pageHeight - stampY * pageHeight - boxH, pageHeight - boxH))

  // Rotation around the center of the stamp
  const rot = degrees(-stampRotation)
  const centerX = x + boxW / 2
  const centerY = y + boxH / 2
  const rad = (-stampRotation * Math.PI) / 180

  // pdf-lib drawRectangle rotates around the rectangle's own center
  firstPage.drawRectangle({
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

  firstPage.drawText(stampText, {
    x: textX,
    y: textY,
    size: fontSize,
    font: boldFont,
    color: rgb(0.8, 0, 0),
    rotate: rot
  })

  // 3. Save stamped PDF
  const modifiedPdfBytes = await pdfDoc.save()
  await writeFile(destPath, modifiedPdfBytes)

  return { success: true, destinationPath: destPath }
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
