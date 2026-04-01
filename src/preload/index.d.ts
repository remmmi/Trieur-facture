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

export interface Api {
  selectFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<FileInfo[]>
  selectDestinationFolder: () => Promise<string | null>
  ensurePdf: (filePath: string) => Promise<string>
  processDocument: (data: ProcessData) => Promise<{ success: boolean; destinationPath: string }>
  readFile: (filePath: string) => Promise<Uint8Array>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
