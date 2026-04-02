import { dialog } from 'electron'
import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'

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
    properties: ['openDirectory'],
    title: 'Sélectionner le dossier contenant les factures',
    defaultPath: lastSourcePath ?? lastDestPath
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  lastSourcePath = result.filePaths[0]
  return lastSourcePath
}

export async function scanFolder(folderPath: string): Promise<FileInfo[]> {
  const entries = await readdir(folderPath)
  const files: FileInfo[] = []

  for (const entry of entries) {
    const fullPath = join(folderPath, entry)
    const ext = extname(entry).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) continue

    const fileStat = await stat(fullPath)
    if (!fileStat.isFile()) continue

    files.push({
      name: entry,
      path: fullPath,
      extension: ext,
      size: fileStat.size
    })
  }

  return files.sort((a, b) => a.name.localeCompare(b.name))
}

export async function selectDestinationFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Sélectionner le dossier racine de destination (comptabilité)',
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
