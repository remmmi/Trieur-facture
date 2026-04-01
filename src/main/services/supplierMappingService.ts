import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'

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

export interface AppConfig {
  anthropicApiKey: string
  supplierMappings: SupplierMapping[]
}

const DEFAULT_CONFIG: AppConfig = {
  anthropicApiKey: '',
  supplierMappings: []
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

/**
 * Trouve le mapping correspondant à un nom de fournisseur extrait par l'IA.
 * Utilise une recherche floue : le nom extrait contient le nom du mapping ou vice-versa.
 */
export function findSupplierMapping(
  extractedName: string,
  mappings: SupplierMapping[]
): SupplierMapping | null {
  const normalized = extractedName.toLowerCase().trim()

  // Exact match first
  const exact = mappings.find((m) => m.invoiceName.toLowerCase() === normalized)
  if (exact) return exact

  // Partial match: extracted name contains the mapping name or vice-versa
  const partial = mappings.find(
    (m) =>
      normalized.includes(m.invoiceName.toLowerCase()) ||
      m.invoiceName.toLowerCase().includes(normalized) ||
      normalized.includes(m.shortName.toLowerCase()) ||
      m.shortName.toLowerCase().includes(normalized)
  )
  if (partial) return partial

  return null
}

export async function getApiKey(): Promise<string> {
  const config = await loadConfig()
  return config.anthropicApiKey
}

export async function setApiKey(apiKey: string): Promise<void> {
  const config = await loadConfig()
  config.anthropicApiKey = apiKey
  await saveConfig(config)
}
