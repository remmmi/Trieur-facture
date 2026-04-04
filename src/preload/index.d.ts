import { ElectronAPI } from '@electron-toolkit/preload'

export interface FileInfo {
  name: string
  path: string
  extension: string
  size: number
}

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
  paid?: string
}

export interface ProcessResult {
  success: boolean
  destinationPath: string
  warning?: string
}

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
  aiAbort: () => Promise<boolean>

  // Settings
  getApiKey: () => Promise<string>
  setApiKey: (apiKey: string) => Promise<boolean>
  isAiConfigured: () => Promise<boolean>
  validateApiKey: (key: string) => Promise<{ valid: boolean; error?: string }>

  // Supplier mappings
  getSupplierMappings: () => Promise<SupplierMapping[]>
  addSupplierMapping: (mapping: SupplierMapping) => Promise<boolean>
  removeSupplierMapping: (invoiceName: string) => Promise<boolean>
  updateSupplierMapping: (oldInvoiceName: string, mapping: SupplierMapping) => Promise<boolean>

  // File check
  checkFileExists: (filePath: string) => Promise<boolean>

  // Settings
  getIncludeAmount: () => Promise<boolean>
  setIncludeAmount: (value: boolean) => Promise<boolean>
  getStampIncludeLabel: () => Promise<boolean>
  setStampIncludeLabel: (value: boolean) => Promise<boolean>
  getUseQuarterMode: () => Promise<boolean>
  setUseQuarterMode: (value: boolean) => Promise<boolean>
  getPrefixAccount: () => Promise<boolean>
  setPrefixAccount: (value: boolean) => Promise<boolean>
  getLargeFileThreshold: () => Promise<number>
  setLargeFileThreshold: (value: number) => Promise<boolean>
  getPageCount: (filePath: string) => Promise<number>
  checkFolderMode: (basePath: string, year: string) => Promise<'month' | 'quarter' | 'unknown'>

  // Plan comptable
  importPlanComptable: (csvContent: string) => Promise<{ numero: string; libelle: string }[]>
  getPlanComptable: () => Promise<{ numero: string; libelle: string }[] | null>
  addPlanComptableEntry: (
    entry: { numero: string; libelle: string },
    currentPlan: { numero: string; libelle: string }[]
  ) => Promise<{ numero: string; libelle: string }[]>
  resetPlanComptable: () => Promise<boolean>

  // Screenshot
  captureScreenshot: (filePath: string) => Promise<boolean>

  // Persisted folders
  getLastFolders: () => Promise<{ source: string | null; destination: string | null }>
  setLastFolders: (source: string | null, destination: string | null) => Promise<boolean>

  // Window close
  onCloseRequested: (callback: () => void) => void
  forceQuit: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
