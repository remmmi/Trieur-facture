import { ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { selectFolder, scanFolder, selectDestinationFolder } from './services/fileService'
import { ensurePdf } from './services/convertService'

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
}
