import { readFile, writeFile } from 'fs/promises'
import { join, basename, extname } from 'path'
import { tmpdir } from 'os'
import libre from 'libreoffice-convert'
import { promisify } from 'util'

const convertAsync = promisify(libre.convert)

export async function ensurePdf(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.pdf') {
    return filePath
  }

  if (ext === '.doc' || ext === '.docx') {
    const inputBuffer = await readFile(filePath)
    const outputBuffer = await convertAsync(inputBuffer, '.pdf', undefined)
    const pdfName = basename(filePath, ext) + '.pdf'
    const outputPath = join(tmpdir(), `trieur-facture-${Date.now()}-${pdfName}`)
    await writeFile(outputPath, outputBuffer)
    return outputPath
  }

  throw new Error(`Format non supporté: ${ext}`)
}
