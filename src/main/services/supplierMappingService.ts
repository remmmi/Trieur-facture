import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import Fuse from 'fuse.js'

export interface SupplierMapping {
  /** Le nom tel qu'il apparaît sur les factures (ex: "EDF Entreprises SA") */
  invoiceName: string
  /** Le nom court pour le fichier (ex: "EDF") */
  shortName: string
  /** Le compte comptable par défaut (ex: "6061") */
  defaultAccount: string
  /** Le libellé du compte (ex: "Fournitures non stockables") */
  defaultAccountLabel: string
}

export interface PlanComptableEntry {
  numero: string
  libelle: string
}

export interface AppConfig {
  anthropicApiKey: string
  supplierMappings: SupplierMapping[]
  lastSourceFolder: string | null
  lastDestinationFolder: string | null
  customPlanComptable: PlanComptableEntry[] | null
  includeAmountInFilename: boolean
  useQuarterMode: boolean
  filingGranularity: 'month' | 'quarter' | 'quarter-month'
  stampIncludeLabel: boolean
  prefixAccountInFilename: boolean
  largeFilePageThreshold: number
  paymentModes: string
  usePaymentDateFiling: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  anthropicApiKey: '',
  supplierMappings: [],
  lastSourceFolder: null,
  lastDestinationFolder: null,
  customPlanComptable: null,
  includeAmountInFilename: false,
  useQuarterMode: false,
  filingGranularity: 'month',
  stampIncludeLabel: false,
  prefixAccountInFilename: false,
  largeFilePageThreshold: 8,
  paymentModes: 'CB|Virement|Prelevement',
  usePaymentDateFiling: false
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const configPath = getConfigPath()
    const data = await readFile(configPath, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const configPath = getConfigPath()
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export async function getSupplierMappings(): Promise<SupplierMapping[]> {
  const config = await loadConfig()
  return config.supplierMappings
}

export async function addSupplierMapping(mapping: SupplierMapping): Promise<void> {
  const config = await loadConfig()
  // Update existing or add new
  const idx = config.supplierMappings.findIndex(
    (m) => m.invoiceName.toLowerCase() === mapping.invoiceName.toLowerCase()
  )
  if (idx >= 0) {
    config.supplierMappings[idx] = mapping
  } else {
    config.supplierMappings.push(mapping)
  }
  await saveConfig(config)
}

export async function removeSupplierMapping(invoiceName: string): Promise<void> {
  const config = await loadConfig()
  config.supplierMappings = config.supplierMappings.filter(
    (m) => m.invoiceName.toLowerCase() !== invoiceName.toLowerCase()
  )
  await saveConfig(config)
}

export async function updateSupplierMapping(
  oldInvoiceName: string,
  mapping: SupplierMapping
): Promise<void> {
  const config = await loadConfig()
  const idx = config.supplierMappings.findIndex(
    (m) => m.invoiceName.toLowerCase() === oldInvoiceName.toLowerCase()
  )
  if (idx >= 0) {
    config.supplierMappings[idx] = mapping
  } else {
    config.supplierMappings.push(mapping)
  }
  await saveConfig(config)
}

export async function importSupplierMappings(
  newMappings: SupplierMapping[]
): Promise<{ imported: number; updated: number }> {
  const config = await loadConfig()
  const existing = config.supplierMappings || []
  const existingByName = new Map(
    existing.map((m) => [m.invoiceName.toLowerCase(), m])
  )

  let imported = 0
  let updated = 0

  for (const mapping of newMappings) {
    const key = mapping.invoiceName.toLowerCase()
    if (existingByName.has(key)) {
      const idx = existing.findIndex((m) => m.invoiceName.toLowerCase() === key)
      existing[idx] = mapping
      updated++
    } else {
      existing.push(mapping)
      existingByName.set(key, mapping)
      imported++
    }
  }

  config.supplierMappings = existing
  await saveConfig(config)
  return { imported, updated }
}

/**
 * Trouve le mapping correspondant à un nom de fournisseur extrait par l'IA.
 * Utilise une recherche floue : le nom extrait contient le nom du mapping ou vice-versa.
 */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[-_./\\]+/g, ' ').replace(/\s+/g, ' ')
}

export function findSupplierMapping(
  extractedName: string,
  mappings: SupplierMapping[]
): SupplierMapping | null {
  if (!extractedName || mappings.length === 0) return null

  const n = normalize(extractedName)

  // 1. Exact match on normalized invoiceName or shortName (fastest path)
  const exact = mappings.find(
    (m) => normalize(m.invoiceName) === n || normalize(m.shortName) === n
  )
  if (exact) return exact

  // 2. Fuzzy match via Fuse.js : tolerant aux typos, OCR errors, mots manquants
  const fuse = new Fuse(mappings, {
    keys: [
      { name: 'invoiceName', weight: 0.6 },
      { name: 'shortName', weight: 0.4 }
    ],
    // threshold : 0 = match parfait, 1 = tout match. 0.3 = tolere ~30% de differences
    threshold: 0.3,
    ignoreLocation: true, // le match peut etre n'importe ou dans la chaine
    minMatchCharLength: 3,
    includeScore: true
  })

  const results = fuse.search(extractedName)
  if (results.length === 0) return null

  // Fuse retourne un score : 0 = parfait, 1 = pire.
  const best = results[0]
  if (best.score === undefined || best.score >= 0.3) return null

  // Check ambiguite : si le 2e candidat est trop proche du 1er, on refuse le match
  // (evite de choisir arbitrairement entre deux fournisseurs similaires)
  const second = results[1]
  if (second && second.score !== undefined && second.score - best.score < 0.1) {
    return null
  }

  return best.item
}

// --- Plan comptable ---

export async function importPlanComptable(csvContent: string): Promise<PlanComptableEntry[]> {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim())
  const entries: PlanComptableEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip header row if it contains "numero" or "libelle"
    if (i === 0 && /^[a-zA-Z]/.test(line.split(/[,;\t]/)[0])) continue

    const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ','
    const parts = line.split(sep)
    if (parts.length < 2) continue

    const numero = parts[0].trim().replace(/^["']|["']$/g, '')
    const libelle = parts
      .slice(1)
      .join(sep)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (numero && libelle) {
      entries.push({ numero, libelle })
    }
  }

  const config = await loadConfig()
  config.customPlanComptable = entries
  await saveConfig(config)
  return entries
}

export async function getPlanComptable(): Promise<PlanComptableEntry[] | null> {
  const config = await loadConfig()
  return config.customPlanComptable
}

export async function addPlanComptableEntry(
  entry: PlanComptableEntry,
  currentPlan: PlanComptableEntry[]
): Promise<PlanComptableEntry[]> {
  const config = await loadConfig()
  // If no custom plan yet, initialize from the current in-memory plan
  if (!config.customPlanComptable) {
    config.customPlanComptable = [...currentPlan]
  }
  const exists = config.customPlanComptable.find((e) => e.numero === entry.numero)
  if (!exists) {
    config.customPlanComptable.push(entry)
    config.customPlanComptable.sort((a, b) => a.numero.localeCompare(b.numero))
  }
  await saveConfig(config)
  return config.customPlanComptable
}

export async function resetPlanComptable(): Promise<void> {
  const config = await loadConfig()
  config.customPlanComptable = null
  await saveConfig(config)
}

// --- API key ---

export async function getApiKey(): Promise<string> {
  const config = await loadConfig()
  return config.anthropicApiKey
}

export async function setApiKey(apiKey: string): Promise<void> {
  const config = await loadConfig()
  config.anthropicApiKey = apiKey
  await saveConfig(config)
}

export async function getLastFolders(): Promise<{
  source: string | null
  destination: string | null
}> {
  const config = await loadConfig()
  return {
    source: config.lastSourceFolder ?? null,
    destination: config.lastDestinationFolder ?? null
  }
}

export async function setLastFolders(
  source: string | null,
  destination: string | null
): Promise<void> {
  const config = await loadConfig()
  config.lastSourceFolder = source
  config.lastDestinationFolder = destination
  await saveConfig(config)
}

// --- Settings ---

export async function getIncludeAmountInFilename(): Promise<boolean> {
  const config = await loadConfig()
  return config.includeAmountInFilename ?? false
}

export async function setIncludeAmountInFilename(value: boolean): Promise<void> {
  const config = await loadConfig()
  config.includeAmountInFilename = value
  await saveConfig(config)
}

export async function getStampIncludeLabel(): Promise<boolean> {
  const config = await loadConfig()
  return config.stampIncludeLabel ?? false
}

export async function setStampIncludeLabel(value: boolean): Promise<void> {
  const config = await loadConfig()
  config.stampIncludeLabel = value
  await saveConfig(config)
}

export async function getUseQuarterMode(): Promise<boolean> {
  const config = await loadConfig()
  return config.useQuarterMode ?? false
}

export async function setUseQuarterMode(value: boolean): Promise<void> {
  const config = await loadConfig()
  config.useQuarterMode = value
  await saveConfig(config)
}

export async function getFilingGranularity(): Promise<'month' | 'quarter' | 'quarter-month'> {
  const config = await loadConfig()
  if (config.filingGranularity) return config.filingGranularity
  // Migration: derive from old boolean
  return config.useQuarterMode ? 'quarter' : 'month'
}

export async function setFilingGranularity(value: 'month' | 'quarter' | 'quarter-month'): Promise<void> {
  const config = await loadConfig()
  config.filingGranularity = value
  // Keep old field in sync for backward compat
  config.useQuarterMode = value === 'quarter'
  await saveConfig(config)
}

export async function getPrefixAccountInFilename(): Promise<boolean> {
  const config = await loadConfig()
  return config.prefixAccountInFilename ?? false
}

export async function setPrefixAccountInFilename(value: boolean): Promise<void> {
  const config = await loadConfig()
  config.prefixAccountInFilename = value
  await saveConfig(config)
}

export async function getLargeFileThreshold(): Promise<number> {
  const config = await loadConfig()
  return config.largeFilePageThreshold ?? 8
}

export async function setLargeFileThreshold(value: number): Promise<void> {
  const config = await loadConfig()
  config.largeFilePageThreshold = value
  await saveConfig(config)
}

export async function getPaymentModes(): Promise<string> {
  const config = await loadConfig()
  return config.paymentModes ?? 'CB|Virement|Prelevement'
}

export async function setPaymentModes(value: string): Promise<void> {
  const config = await loadConfig()
  config.paymentModes = value
  await saveConfig(config)
}

export async function getUsePaymentDateFiling(): Promise<boolean> {
  const config = await loadConfig()
  return config.usePaymentDateFiling ?? false
}

export async function setUsePaymentDateFiling(value: boolean): Promise<void> {
  const config = await loadConfig()
  config.usePaymentDateFiling = value
  await saveConfig(config)
}
