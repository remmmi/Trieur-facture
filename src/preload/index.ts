import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath: string): Promise<unknown[]> => ipcRenderer.invoke('scan-folder', folderPath),
  selectDestinationFolder: (): Promise<string | null> => ipcRenderer.invoke('select-destination-folder'),
  ensurePdf: (filePath: string): Promise<string> => ipcRenderer.invoke('ensure-pdf', filePath),
  readFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('read-file', filePath),
  processDocument: (data: unknown): Promise<{ success: boolean; destinationPath: string }> =>
    ipcRenderer.invoke('process-document', data),
  aiPreProcess: (pdfPath: string): Promise<unknown> => ipcRenderer.invoke('ai-pre-process', pdfPath)
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
