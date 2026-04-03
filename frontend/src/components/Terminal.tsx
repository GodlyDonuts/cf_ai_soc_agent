import { useEffect, useMemo, useRef } from 'react'

type TerminalEvent = {
  step: string
  message?: string
  action?: string
  waf_rule?: unknown
  parameters?: {
    severity?: 'high' | 'medium' | 'low'
    threat_type?: string
    asn?: number
    payload?: string
    [k: string]: unknown
  }
  [k: string]: unknown
}

export default function Terminal({
  events,
  wafRule,
}: {
  events: TerminalEvent[]
  wafRule: unknown
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [events.length, wafRule])

  const stepColor = useMemo(() => {
    const map: Record<string, string> = {
      thinking: 'text-[#89dceb]',
      received_symptom: 'text-[#89dceb]',
      llm_iteration_1: 'text-[#74c7ec]',
      check_logs: 'text-[#f9e2af]',
      ask_user: 'text-[#f5c2e7]',
      final_waf_rule: 'text-[#a6e3a1]',
      error: 'text-[#f38ba8]',
      runInvestigation_error: 'text-[#f38ba8]',
      default: 'text-[var(--text-h)]',
    }

    return (step: string) => {
      if (step.startsWith('llm_iteration_')) return 'text-[#74c7ec]'
      return map[step] ?? map.default
    }
  }, [])

  return (
    <section className="soc-terminal">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs uppercase text-[var(--text-h)] opacity-90">
            Investigation Stream
          </span>
          <span className="font-mono text-xs opacity-80">
            {events.length === 0 ? 'waiting for input...' : `${events.length} events`}
          </span>
        </div>
        <span className="font-mono text-xs opacity-70">catppuccin mocha</span>
      </div>

      <div
        ref={scrollRef}
        className="soc-terminal-body max-h-[60vh] overflow-auto px-2 py-2"
      >
        {events.map((ev, idx) => (
          <div key={`${ev.step}-${idx}`} className="flex flex-col gap-1 py-1">
            <div className="soc-terminal-line">
              <span className={`soc-terminal-step ${stepColor(ev.step)}`}>
                {ev.step}
              </span>
              <span className="soc-terminal-msg">
                {ev.message ?? (ev.action ? `action=${ev.action}` : '')}
              </span>
            </div>

            {ev.parameters &&
            (ev.parameters.severity || ev.parameters.threat_type) ? (
              <div className="ml-6 flex flex-wrap gap-2 py-1">
                {ev.parameters.threat_type && (
                  <span className="rounded bg-[#313244] px-2 py-0.5 font-mono text-[10px] font-bold text-[#f2cdcd]">
                    THREAT: {ev.parameters.threat_type.toUpperCase()}
                  </span>
                )}
                {ev.parameters.severity && (
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                      ev.parameters.severity === 'high'
                        ? 'bg-[#f38ba8] text-[#11111b]'
                        : ev.parameters.severity === 'medium'
                          ? 'bg-[#fab387] text-[#11111b]'
                          : 'bg-[#a6e3a1] text-[#11111b]'
                    }`}
                  >
                    SEVERITY: {ev.parameters.severity.toUpperCase()}
                  </span>
                )}
                {ev.parameters.asn && (
                  <span className="rounded bg-[#313244] px-2 py-0.5 font-mono text-[10px] text-[#89b4fa]">
                    ASN: {ev.parameters.asn}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        ))}

        {wafRule ? (
          <div className="mt-4 border-t border-[var(--border)] px-3 py-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#a6e3a1]" />
              <div className="font-mono text-xs uppercase text-[var(--text-h)] opacity-90">
                Deployment: Cloudflare WAF Custom Rule
              </div>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[#1e1e2e] p-4 font-mono text-sm text-[#a6e3a1]">
              {JSON.stringify(wafRule, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  )
}

