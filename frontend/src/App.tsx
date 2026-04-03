import { useEffect, useMemo, useRef, useState } from 'react'
import Terminal from './components/Terminal'

type BackendEvent = {
  step: string
  message?: string
  action?: string
  waf_rule?: unknown
  [k: string]: unknown
}

export default function App() {
  const [symptom, setSymptom] = useState('')
  const [events, setEvents] = useState<BackendEvent[]>([])
  const [wafRule, setWafRule] = useState<unknown>(null)
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'closed' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)

  const wsBaseUrl = useMemo(() => {
    const configured = import.meta.env.VITE_BACKEND_WS_URL as
      | string
      | undefined
    if (configured && configured.trim().length > 0) return configured

    // Production default: deployed Worker URL
    return 'wss://soc-agent.csramineni.workers.dev'
  }, [])

  function closeWs() {
    const ws = wsRef.current
    wsRef.current = null
    try {
      ws?.close()
    } catch {
      // ignore
    }
  }

  function startInvestigation() {
    const cleaned = symptom.trim()
    if (!cleaned) return

    closeWs()
    setEvents([])
    setWafRule(null)
    setErrorMessage(null)

    const ticketId = crypto.randomUUID()
    const wsUrl = `${wsBaseUrl}/?ticketId=${encodeURIComponent(ticketId)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    setStatus('connecting')

    ws.onopen = () => {
      setStatus('connected')
      ws.send(JSON.stringify({ symptom: cleaned }))
    }

    ws.onmessage = (event) => {
      const parsed = (() => {
        try {
          return JSON.parse(event.data)
        } catch {
          return null
        }
      })() as BackendEvent | null

      if (!parsed || typeof parsed.step !== 'string') return

      setEvents((prev) => [...prev, parsed])
      if (parsed.waf_rule) setWafRule(parsed.waf_rule)
    }

    ws.onerror = () => {
      setStatus('error')
      setErrorMessage('WebSocket error while running investigation.')
    }

    ws.onclose = () => {
      setStatus((s) => (s === 'error' ? s : 'closed'))
    }
  }

  useEffect(() => {
    return () => closeWs()
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1200px] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--code-bg)]">
              <span className="font-mono text-[var(--accent)]">SOC</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-h)]">
                Autonomous Edge Security Agent
              </h1>
              <p className="mt-1 font-mono text-sm opacity-90">
                Report an issue and watch the agent investigate in real time.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <form
          className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] p-4"
          onSubmit={(e) => {
            e.preventDefault()
            startInvestigation()
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase text-[var(--text-h)] opacity-90">
              Symptom / Report
            </span>
            <input
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 font-mono text-sm text-[var(--text-h)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="e.g., We are getting a lot of weird traffic from unknown IPs"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="h-11 rounded-lg bg-[var(--accent)] px-4 font-mono text-sm font-semibold text-black hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === 'connecting' || symptom.trim().length === 0}
            >
              Investigate
            </button>

            <div className="font-mono text-xs opacity-90">
              Status:{' '}
              <span className="text-[var(--text-h)]">
                {status === 'idle'
                  ? 'idle'
                  : status === 'connecting'
                    ? 'connecting'
                    : status === 'connected'
                      ? 'running'
                      : status}
              </span>
              {errorMessage ? (
                <span className="ml-2 text-[#f38ba8]">{errorMessage}</span>
              ) : null}
            </div>
          </div>
        </form>

        <Terminal events={events} wafRule={wafRule} />
      </main>
    </div>
  )
}

