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

export async function selectFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Sélectionner le dossier contenant les factures'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
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
    title: 'Sélectionner le dossier racine de destination (comptabilité)'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
}
