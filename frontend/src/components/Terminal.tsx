import { useEffect, useMemo, useRef } from 'react'

type TerminalEvent = {
  step: string
  message?: string
  action?: string
  waf_rule?: unknown
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
        <span className="font-mono text-xs opacity-70">
          catppuccin mocha
        </span>
      </div>

      <div
        ref={scrollRef}
        className="soc-terminal-body max-h-[54vh] overflow-auto px-2 py-2"
      >
        {events.map((ev, idx) => (
          <div key={`${ev.step}-${idx}`} className="soc-terminal-line">
            <span className={`soc-terminal-step ${stepColor(ev.step)}`}>
              {ev.step}
            </span>
            <span className="soc-terminal-msg">
              {ev.message ?? (ev.action ? `action=${ev.action}` : '')}
            </span>
          </div>
        ))}

        {wafRule ? (
          <div className="px-3 py-3">
            <div className="mb-2 font-mono text-xs uppercase text-[var(--text-h)] opacity-90">
              Final WAF Rule
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--code-bg)] p-4 font-mono text-sm text-[var(--text)]">
              {JSON.stringify(wafRule, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  )
}

