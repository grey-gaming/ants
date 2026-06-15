import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { isAuthenticated, validateApiKey } from '@/lib/api'
import { Loader2 } from 'lucide-react'

export function AuthGuard(Component: React.ComponentType<any>) {
  return function AuthenticatedComponent(props: any) {
    const [checking, setChecking] = useState(true)

    useState(() => {
      checkAuth()
    })

    async function checkAuth() {
      try {
        const authenticated = await isAuthenticated()
        if (!authenticated) {
          window.location.href = '/login'
        }
      } finally {
        setChecking(false)
      }
    }

    if (checking) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-0">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )
    }

    return <Component {...props} />
  }
}

export function LoginPage() {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await validateApiKey(apiKey.trim())
      localStorage.setItem('ants_api_key', result.apiKey)
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-1 p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-white">
            <span className="text-2xl font-bold">A</span>
          </div>
          <h1 className="text-heading-lg text-text-primary">Welcome to ANTS</h1>
          <p className="mt-2 text-body text-text-secondary">
            Enter your API key to continue
          </p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-body-sm font-medium text-text-secondary">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_..."
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-body text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            {error && (
              <p className="text-sm text-error">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="w-full rounded-md bg-accent px-4 py-2 text-body font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
