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
  processDocument: (data: unknown): Promise<{ success: boolean; destinationPath: string }> =>
    ipcRenderer.invoke('process-document', data),

  // AI OCR
  aiPreProcess: (pdfPath: string): Promise<unknown> => ipcRenderer.invoke('ai-pre-process', pdfPath),

  // Settings
  getApiKey: (): Promise<string> => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey: string): Promise<boolean> => ipcRenderer.invoke('set-api-key', apiKey),
  isAiConfigured: (): Promise<boolean> => ipcRenderer.invoke('is-ai-configured'),

  // Supplier mappings
  getSupplierMappings: (): Promise<unknown[]> => ipcRenderer.invoke('get-supplier-mappings'),
  addSupplierMapping: (mapping: unknown): Promise<boolean> =>
    ipcRenderer.invoke('add-supplier-mapping', mapping),
  removeSupplierMapping: (invoiceName: string): Promise<boolean> =>
    ipcRenderer.invoke('remove-supplier-mapping', invoiceName),
  updateSupplierMapping: (oldInvoiceName: string, mapping: unknown): Promise<boolean> =>
    ipcRenderer.invoke('update-supplier-mapping', oldInvoiceName, mapping)
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
