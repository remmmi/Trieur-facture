import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Erreur non catchee:', error)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { error } = this.state
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="max-w-2xl w-full mx-4 space-y-4">
            <h1 className="text-2xl font-bold">Erreur inattendue</h1>
            <p className="text-muted-foreground">
              {error?.message ?? 'Une erreur inconnue est survenue.'}
            </p>
            {error?.stack && (
              <pre className="rounded bg-muted p-4 text-sm overflow-auto max-h-64">
                <code>{error.stack}</code>
              </pre>
            )}
            <button
              className="rounded bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition-opacity"
              onClick={() => window.location.reload()}
            >
              Recharger l&apos;application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
