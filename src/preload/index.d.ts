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

export interface SupplierMapping {
  invoiceName: string
  shortName: string
  defaultAccount: string
  defaultAccountLabel: string
}

export interface Api {
  // File operations
  selectFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<FileInfo[]>
  selectDestinationFolder: () => Promise<string | null>
  ensurePdf: (filePath: string) => Promise<string>
  readFile: (filePath: string) => Promise<Uint8Array>

  // Document processing
  processDocument: (data: ProcessData) => Promise<ProcessResult>

  // AI OCR
  aiPreProcess: (pdfPath: string) => Promise<AiSuggestion | null>

  // Settings
  getApiKey: () => Promise<string>
  setApiKey: (apiKey: string) => Promise<boolean>
  isAiConfigured: () => Promise<boolean>

  // Supplier mappings
  getSupplierMappings: () => Promise<SupplierMapping[]>
  addSupplierMapping: (mapping: SupplierMapping) => Promise<boolean>
  removeSupplierMapping: (invoiceName: string) => Promise<boolean>
  updateSupplierMapping: (oldInvoiceName: string, mapping: SupplierMapping) => Promise<boolean>

  // Persisted folders
  getLastFolders: () => Promise<{ source: string | null; destination: string | null }>
  setLastFolders: (source: string | null, destination: string | null) => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
