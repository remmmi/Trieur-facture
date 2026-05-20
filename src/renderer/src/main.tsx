import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAppStore } from '@/store/useAppStore'

// Dev only : expose Zustand store + helpers on window for Claude / chrome-devtools MCP.
// Call `window.__store.getState()` via evaluate_script to dump runtime state.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useAppStore }).__store = useAppStore
  ;(window as unknown as { __debug: () => Record<string, unknown> }).__debug = () => ({
    state: useAppStore.getState(),
    api: Object.keys(window.api ?? {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
