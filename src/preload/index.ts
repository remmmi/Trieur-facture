import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // File operations
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath: string): Promise<unknown[]> => ipcRenderer.invoke('scan-folder', folderPath),
  selectDestinationFolder: (): Promise<string | null> => ipcRenderer.invoke('select-destination-folder'),
  ensurePdf: (filePath: string): Promise<string> => ipcRenderer.invoke('ensure-pdf', filePath),
  readFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('read-file', filePath),

  // Document processing
  processDocument: (data: unknown): Promise<{ success: boolean; destinationPath: string; warning?: string }> =>
    ipcRenderer.invoke('process-document', data),

  // AI OCR
  aiPreProcess: (pdfPath: string): Promise<unknown> => ipcRenderer.invoke('ai-pre-process', pdfPath),
  aiAbort: (): Promise<boolean> => ipcRenderer.invoke('ai-abort'),

  // Settings
  getApiKey: (): Promise<string> => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey: string): Promise<boolean> => ipcRenderer.invoke('set-api-key', apiKey),
  isAiConfigured: (): Promise<boolean> => ipcRenderer.invoke('is-ai-configured'),
  validateApiKey: (key: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('validate-api-key', key),

  // Supplier mappings
  getSupplierMappings: (): Promise<unknown[]> => ipcRenderer.invoke('get-supplier-mappings'),
  addSupplierMapping: (mapping: unknown): Promise<boolean> =>
    ipcRenderer.invoke('add-supplier-mapping', mapping),
  removeSupplierMapping: (invoiceName: string): Promise<boolean> =>
    ipcRenderer.invoke('remove-supplier-mapping', invoiceName),
  updateSupplierMapping: (oldInvoiceName: string, mapping: unknown): Promise<boolean> =>
    ipcRenderer.invoke('update-supplier-mapping', oldInvoiceName, mapping),

  // File check
  checkFileExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('check-file-exists', filePath),

  // Settings
  getIncludeAmount: (): Promise<boolean> => ipcRenderer.invoke('get-include-amount'),
  setIncludeAmount: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-include-amount', value),
  getStampIncludeLabel: (): Promise<boolean> => ipcRenderer.invoke('get-stamp-include-label'),
  setStampIncludeLabel: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-stamp-include-label', value),
  getUseQuarterMode: (): Promise<boolean> => ipcRenderer.invoke('get-use-quarter-mode'),
  setUseQuarterMode: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-use-quarter-mode', value),
  checkFolderMode: (basePath: string, year: string): Promise<'month' | 'quarter' | 'unknown'> =>
    ipcRenderer.invoke('check-folder-mode', basePath, year),

  // Plan comptable
  importPlanComptable: (csvContent: string): Promise<{ numero: string; libelle: string }[]> =>
    ipcRenderer.invoke('import-plan-comptable', csvContent),
  getPlanComptable: (): Promise<{ numero: string; libelle: string }[] | null> =>
    ipcRenderer.invoke('get-plan-comptable'),
  addPlanComptableEntry: (
    entry: { numero: string; libelle: string },
    currentPlan: { numero: string; libelle: string }[]
  ): Promise<{ numero: string; libelle: string }[]> =>
    ipcRenderer.invoke('add-plan-comptable-entry', entry, currentPlan),
  resetPlanComptable: (): Promise<boolean> => ipcRenderer.invoke('reset-plan-comptable'),

  // Screenshot
  captureScreenshot: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('capture-screenshot', filePath),

  // Persisted folders
  getLastFolders: (): Promise<{ source: string | null; destination: string | null }> =>
    ipcRenderer.invoke('get-last-folders'),
  setLastFolders: (source: string | null, destination: string | null): Promise<boolean> =>
    ipcRenderer.invoke('set-last-folders', source, destination)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
