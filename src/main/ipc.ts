import { ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { selectFolder, scanFolder, selectDestinationFolder } from './services/fileService'
import { ensurePdf } from './services/convertService'
import { processDocument, runAiPreProcess, runAiPostProcess, type ProcessData } from './services/stampService'

export function registerIpcHandlers(): void {
  ipcMain.handle('select-folder', async () => {
    return selectFolder()
  })

  ipcMain.handle('scan-folder', async (_event, folderPath: string) => {
    return scanFolder(folderPath)
  })

  ipcMain.handle('select-destination-folder', async () => {
    return selectDestinationFolder()
  })

  ipcMain.handle('ensure-pdf', async (_event, filePath: string) => {
    return ensurePdf(filePath)
  })

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    const buffer = await readFile(filePath)
    return new Uint8Array(buffer)
  })

  ipcMain.handle('process-document', async (_event, data: ProcessData) => {
    const result = await processDocument(data)
    // Run AI post-process hook if registered
    await runAiPostProcess(data, result)
    return result
  })

  // AI hook: pre-process a PDF to get suggestions
  ipcMain.handle('ai-pre-process', async (_event, pdfPath: string) => {
    return runAiPreProcess(pdfPath)
  })
}
