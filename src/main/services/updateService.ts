import { app, net, shell } from 'electron'

const RELEASES_API = 'https://api.github.com/repos/remmmi/Trieur-facture/releases/latest'
const RELEASES_PAGE = 'https://github.com/remmmi/Trieur-facture/releases/latest'

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  latestUrl?: string
  publishedAt?: string
  error?: string
}

function parseSemver(v: string): number[] {
  return v
    .replace(/^v/, '')
    .split('-')[0]
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)
}

function isNewer(remote: string, local: string): boolean {
  const r = parseSemver(remote)
  const l = parseSemver(local)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const ri = r[i] ?? 0
    const li = l[i] ?? 0
    if (ri > li) return true
    if (ri < li) return false
  }
  return false
}

function fetchJson(url: string): Promise<{ tag_name: string; html_url: string; published_at: string }> {
  return new Promise((resolve, reject) => {
    const req = net.request({
      method: 'GET',
      url,
      headers: {
        'User-Agent': `trieur-facture/${app.getVersion()}`,
        Accept: 'application/vnd.github+json'
      }
    })
    let body = ''
    req.on('response', (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf-8')
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const release = await fetchJson(RELEASES_API)
    const latest = release.tag_name
    if (!latest) {
      return { hasUpdate: false, currentVersion, error: 'tag manquant' }
    }
    if (isNewer(latest, currentVersion)) {
      return {
        hasUpdate: true,
        currentVersion,
        latestVersion: latest,
        latestUrl: release.html_url,
        publishedAt: release.published_at
      }
    }
    return { hasUpdate: false, currentVersion, latestVersion: latest }
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export function openReleasePage(url?: string): void {
  shell.openExternal(url ?? RELEASES_PAGE)
}
