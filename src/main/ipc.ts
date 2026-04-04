import { ipcMain, BrowserWindow } from 'electron'
import { readFile, writeFile, access, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import {
  selectFolder,
  scanFolder,
  selectDestinationFolder,
  setLastPaths,
  checkFolderMode
} from './services/fileService'
import { ensurePdf } from './services/convertService'
import { processDocument, runAiPostProcess, type ProcessData } from './services/stampService'
import {
  extractInvoiceData,
  initializeAiService,
  isAiConfigured,
  validateApiKey,
  abortCurrentExtraction
} from './services/aiService'
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
  getIncludeAmountInFilename,
  setIncludeAmountInFilename,
  getStampIncludeLabel,
  setStampIncludeLabel,
  getUseQuarterMode,
  setUseQuarterMode,
  getPrefixAccountInFilename,
  setPrefixAccountInFilename,
  getLargeFileThreshold,
  setLargeFileThreshold,
  importPlanComptable,
  getPlanComptable,
  resetPlanComptable,
  addPlanComptableEntry,
  type PlanComptableEntry,
  type SupplierMapping
} from './services/supplierMappingService'

export async function registerIpcHandlers(): Promise<void> {
  // Initialize AI service if API key is configured
  const apiKey = await getApiKey()
  if (apiKey) {
    initializeAiService(apiKey)
  }

  // Initialize last paths from persisted folders
  const lastFolders = await getLastFolders()
  setLastPaths(lastFolders.source, lastFolders.destination)

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

    // Cleanup temp file from DOCX conversion
    if (data.sourcePath.startsWith(tmpdir()) && data.sourcePath.includes('trieur-facture-')) {
      unlink(data.sourcePath).catch(() => {})
    }

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

  ipcMain.handle('validate-api-key', async (_event, key: string) => validateApiKey(key))

  ipcMain.handle('ai-abort', async () => {
    abortCurrentExtraction()
    return true
  })

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

  // --- Plan comptable ---
  ipcMain.handle('import-plan-comptable', async (_event, csvContent: string) => {
    return importPlanComptable(csvContent)
  })

  ipcMain.handle('get-plan-comptable', async () => getPlanComptable())

  ipcMain.handle(
    'add-plan-comptable-entry',
    async (_event, entry: PlanComptableEntry, currentPlan: PlanComptableEntry[]) => {
      return addPlanComptableEntry(entry, currentPlan)
    }
  )

  ipcMain.handle('reset-plan-comptable', async () => {
    await resetPlanComptable()
    return true
  })

  // --- Screenshot ---
  ipcMain.handle('capture-screenshot', async (_event, filePath: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return false
    const image = await win.webContents.capturePage()
    await writeFile(filePath, image.toPNG())
    return true
  })

  // --- File existence check ---
  ipcMain.handle('check-file-exists', async (_event, filePath: string) => {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  })

  // --- Settings ---
  ipcMain.handle('get-include-amount', async () => getIncludeAmountInFilename())
  ipcMain.handle('set-include-amount', async (_event, value: boolean) => {
    await setIncludeAmountInFilename(value)
    return true
  })
  ipcMain.handle('get-stamp-include-label', async () => getStampIncludeLabel())
  ipcMain.handle('set-stamp-include-label', async (_event, value: boolean) => {
    await setStampIncludeLabel(value)
    return true
  })

  ipcMain.handle('get-use-quarter-mode', async () => getUseQuarterMode())
  ipcMain.handle('set-use-quarter-mode', async (_event, value: boolean) => {
    await setUseQuarterMode(value)
    return true
  })

  ipcMain.handle('get-prefix-account', async () => getPrefixAccountInFilename())
  ipcMain.handle('set-prefix-account', async (_event, value: boolean) => {
    await setPrefixAccountInFilename(value)
    return true
  })

  ipcMain.handle('get-large-file-threshold', async () => getLargeFileThreshold())
  ipcMain.handle('set-large-file-threshold', async (_event, value: number) => {
    await setLargeFileThreshold(value)
    return true
  })
  ipcMain.handle('get-page-count', async (_event, filePath: string) => {
    const { PDFDocument } = await import('pdf-lib')
    const bytes = await readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return doc.getPageCount()
  })

  // --- Folder mode detection ---
  ipcMain.handle(
    'check-folder-mode',
    async (_event, basePath: string, year: string) => checkFolderMode(basePath, year)
  )

  // --- Persisted folders ---
  ipcMain.handle('get-last-folders', async () => getLastFolders())

  ipcMain.handle(
    'set-last-folders',
    async (_event, source: string | null, destination: string | null) => {
      await setLastFolders(source, destination)
      setLastPaths(source, destination)
      return true
    }
  )
}
