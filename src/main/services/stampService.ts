import { readFile, writeFile, mkdir, copyFile } from 'fs/promises'
import { join, dirname } from 'path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface ProcessData {
  sourcePath: string
  accountNumber: string
  accountLabel: string
  date: string
  baseFolder: string
  fileName: string
}

export interface ProcessResult {
  success: boolean
  destinationPath: string
}

export async function processDocument(data: ProcessData): Promise<ProcessResult> {
  const { sourcePath, accountNumber, accountLabel, date, baseFolder, fileName } = data

  // 1. Build destination path based on date
  const dateObj = new Date(date)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const destFolder = join(baseFolder, String(year), month)
  await mkdir(destFolder, { recursive: true })

  const destPath = join(destFolder, `${fileName}.pdf`)

  // 2. Stamp the PDF
  const pdfBytes = await readFile(sourcePath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const firstPage = pdfDoc.getPages()[0]

  const stampText = `${accountNumber}${accountLabel ? ' - ' + accountLabel : ''}`
  const fontSize = 10
  const textWidth = font.widthOfTextAtSize(stampText, fontSize)
  const { width: pageWidth, height: pageHeight } = firstPage.getSize()

  // Draw stamp background (white rect) + text in top-right corner
  const margin = 10
  const padding = 4
  const x = pageWidth - textWidth - margin - padding * 2
  const y = pageHeight - fontSize - margin - padding

  firstPage.drawRectangle({
    x,
    y: y - padding,
    width: textWidth + padding * 2,
    height: fontSize + padding * 2,
    color: rgb(1, 1, 1),
    opacity: 0.85
  })

  firstPage.drawText(stampText, {
    x: x + padding,
    y,
    size: fontSize,
    font,
    color: rgb(0.1, 0.1, 0.8)
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
