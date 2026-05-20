import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'

/**
 * Dev only debug drawer. Toggle with Ctrl+Shift+D.
 * Affiche : state Zustand, dernier resultat IA, dernier IPC, bouton copy.
 */
export function DebugPanel(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [open])

  if (!import.meta.env.DEV || !open) return null

  const state = useAppStore.getState()
  const apiKeys = Object.keys(window.api ?? {}).sort()

  const dump = {
    tick,
    state: {
      ...state,
      // Fonctions trop verbeuses, on les masque
      ...Object.fromEntries(
        Object.entries(state)
          .filter(([, v]) => typeof v === 'function')
          .map(([k]) => [k, '[fn]'])
      )
    },
    api: apiKeys
  }

  const json = JSON.stringify(dump, null, 2)

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '480px',
        zIndex: 9999,
        background: '#0a0a0a',
        color: '#e5e5e5',
        borderLeft: '1px solid #404040',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: '11px'
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          background: '#262626',
          borderBottom: '1px solid #404040',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontWeight: 600 }}>Debug Panel (Ctrl+Shift+D)</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            style={{
              padding: '2px 8px',
              background: '#404040',
              border: '1px solid #525252',
              color: '#fafafa',
              cursor: 'pointer',
              borderRadius: 3
            }}
            onClick={() => navigator.clipboard.writeText(json)}
            title="Copier le dump JSON"
          >
            Copy
          </button>
          <button
            type="button"
            style={{
              padding: '2px 8px',
              background: '#404040',
              border: '1px solid #525252',
              color: '#fafafa',
              cursor: 'pointer',
              borderRadius: 3
            }}
            onClick={() => setOpen(false)}
          >
            X
          </button>
        </div>
      </div>
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: '8px 12px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {json}
      </pre>
    </div>
  )
}
