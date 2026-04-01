import { ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { selectFolder, scanFolder, selectDestinationFolder } from './services/fileService'
import { ensurePdf } from './services/convertService'
import { processDocument, runAiPostProcess, type ProcessData } from './services/stampService'
import { extractInvoiceData, initializeAiService, isAiConfigured } from './services/aiService'
import {
  getSupplierMappings,
  addSupplierMapping,
  removeSupplierMapping,
  updateSupplierMapping,
  findSupplierMapping,
  getApiKey,
  setApiKey,
  getLastFolders,
  setLastFolders,
  type SupplierMapping
} from './services/supplierMappingService'

export async function registerIpcHandlers(): Promise<void> {
  // Initialize AI service if API key is configured
  const apiKey = await getApiKey()
  if (apiKey) {
    initializeAiService(apiKey)
  }

  // --- File operations ---
  ipcMain.handle('select-folder', async () => selectFolder())
  ipcMain.handle('scan-folder', async (_event, folderPath: string) => scanFolder(folderPath))
  ipcMain.handle('select-destination-folder', async () => selectDestinationFolder())
  ipcMain.handle('ensure-pdf', async (_event, filePath: string) => ensurePdf(filePath))

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    const buffer = await readFile(filePath)
    return new Uint8Array(buffer)
  })

  // --- Document processing ---
  ipcMain.handle('process-document', async (_event, data: ProcessData) => {
    const result = await processDocument(data)
    await runAiPostProcess(data, result)
    return result
  })

  // --- AI OCR ---
  ipcMain.handle('ai-pre-process', async (_event, pdfPath: string) => {
    if (!isAiConfigured()) return null

    // Extract data from PDF via Claude
    const aiResult = await extractInvoiceData(pdfPath)
    if (!aiResult) return null

    // Look up supplier mapping
    const mappings = await getSupplierMappings()
    if (aiResult.fixedPart) {
      const mapping = findSupplierMapping(aiResult.fixedPart, mappings)
      if (mapping) {
        aiResult.fixedPart = mapping.shortName
        aiResult.accountNumber = mapping.defaultAccount
        aiResult.accountLabel = mapping.defaultAccountLabel
      }
    }

    return aiResult
  })

  // --- Settings: API key ---
  ipcMain.handle('get-api-key', async () => {
    const key = await getApiKey()
    // Mask the key for display (show last 4 chars only)
    if (!key) return ''
    return key.length > 8 ? '•'.repeat(key.length - 4) + key.slice(-4) : key
  })

  ipcMain.handle('set-api-key', async (_event, apiKey: string) => {
    await setApiKey(apiKey)
    if (apiKey) {
      initializeAiService(apiKey)
    }
    return true
  })

  ipcMain.handle('is-ai-configured', async () => isAiConfigured())

  // --- Supplier mappings ---
  ipcMain.handle('get-supplier-mappings', async () => getSupplierMappings())

  ipcMain.handle('add-supplier-mapping', async (_event, mapping: SupplierMapping) => {
    await addSupplierMapping(mapping)
    return true
  })

  ipcMain.handle('remove-supplier-mapping', async (_event, invoiceName: string) => {
    await removeSupplierMapping(invoiceName)
    return true
  })

  ipcMain.handle(
    'update-supplier-mapping',
    async (_event, oldInvoiceName: string, mapping: SupplierMapping) => {
      await updateSupplierMapping(oldInvoiceName, mapping)
      return true
    }
  )

  // --- Persisted folders ---
  ipcMain.handle('get-last-folders', async () => getLastFolders())

  ipcMain.handle(
    'set-last-folders',
    async (_event, source: string | null, destination: string | null) => {
      await setLastFolders(source, destination)
      return true
    }
  )
}
