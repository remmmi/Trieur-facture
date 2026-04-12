import { dialog } from 'electron'
import { readdir, stat } from 'fs/promises'
import { join, extname, dirname } from 'path'

export interface FileInfo {
  name: string
  path: string
  extension: string
  size: number
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx']

let lastSourcePath: string | undefined
let lastDestPath: string | undefined

export async function selectFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Choisir une facture dans le dossier source',
    defaultPath: lastSourcePath ?? lastDestPath,
    filters: [
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const folder = dirname(result.filePaths[0])
  lastSourcePath = folder
  return folder
}

export async function scanFolder(folderPath: string): Promise<FileInfo[]> {
  console.log('[scanFolder] Scanning:', folderPath, '(length:', folderPath.length, ')')
  const entries = await readdir(folderPath)
  console.log('[scanFolder] Found', entries.length, 'entries')
  const files: FileInfo[] = []

  for (const entry of entries) {
    const fullPath = join(folderPath, entry)
    const ext = extname(entry).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) continue

    try {
      const fileStat = await stat(fullPath)
      if (!fileStat.isFile()) continue

      files.push({
        name: entry,
        path: fullPath,
        extension: ext,
        size: fileStat.size
      })
    } catch (err) {
      console.warn('[scanFolder] Cannot stat file (online-only or path issue?):', fullPath, err)
    }
  }

  console.log('[scanFolder] Matched', files.length, 'supported files')
  return files.sort((a, b) => a.name.localeCompare(b.name))
}

export async function selectDestinationFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Dossier de destination (comptabilite)',
    defaultPath: lastDestPath ?? lastSourcePath
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  lastDestPath = result.filePaths[0]
  return lastDestPath
}

export function setLastPaths(source: string | null, dest: string | null): void {
  if (source) lastSourcePath = source
  if (dest) lastDestPath = dest
}

const MONTH_NAMES = new Set(['01','02','03','04','05','06','07','08','09','10','11','12'])
const QUARTER_NAMES = new Set(['T1','T2','T3','T4'])

export async function checkFolderMode(
  basePath: string,
  year: string
): Promise<'month' | 'quarter' | 'unknown'> {
  try {
    const yearPath = join(basePath, year)
    const entries = await readdir(yearPath)
    const dirs: string[] = []
    for (const entry of entries) {
      const fullPath = join(yearPath, entry)
      const s = await stat(fullPath)
      if (s.isDirectory()) dirs.push(entry)
    }
    const hasMonths = dirs.some((d) => MONTH_NAMES.has(d))
    const hasQuarters = dirs.some((d) => QUARTER_NAMES.has(d))
    if (hasQuarters && !hasMonths) return 'quarter'
    if (hasMonths && !hasQuarters) return 'month'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
