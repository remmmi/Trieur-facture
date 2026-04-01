import { ElectronAPI } from '@electron-toolkit/preload'

export interface FileInfo {
  name: string
  path: string
  extension: string
  size: number
}

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

export interface AiSuggestion {
  accountNumber?: string
  accountLabel?: string
  date?: string
  fixedPart?: string
  adjustablePart?: string
  confidence?: number
  rawText?: string
}

export interface Api {
  selectFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<FileInfo[]>
  selectDestinationFolder: () => Promise<string | null>
  ensurePdf: (filePath: string) => Promise<string>
  readFile: (filePath: string) => Promise<Uint8Array>
  processDocument: (data: ProcessData) => Promise<ProcessResult>
  aiPreProcess: (pdfPath: string) => Promise<AiSuggestion | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
