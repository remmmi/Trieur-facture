const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i

export function sanitizeFileName(
  rawName: string,
  options?: { destFolderLength?: number; maxPathLength?: number }
): string {
  const { destFolderLength = 0, maxPathLength = 240 } = options ?? {}

  let safe = rawName
    .replace(/[/\\]/g, '-')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (WINDOWS_RESERVED.test(safe)) {
    safe = '_' + safe
  }

  // destFolderLength + '/' + name + '.pdf'
  const overhead = destFolderLength + 1 + 4
  const maxNameLength = maxPathLength - overhead
  if (maxNameLength > 0 && safe.length > maxNameLength) {
    safe = safe.slice(0, maxNameLength).trimEnd()
  }

  return safe
}

export function parseIsoDate(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return null
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}
