import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GardenWorld from './components/GardenWorld'
import type { DemoMode, Impact, Phase } from './types'

const INITIAL_IMPACT: Impact = { water: 12.8, energy: 0.84, co2: 0.38 }
const RUN_IMPACT: Record<DemoMode, Impact> = {
  full: { water: 5.6, energy: 0.48, co2: 0.17 },
  lighter: { water: 2.1, energy: 0.18, co2: 0.06 },
}

const TASKS = [
  { label: 'Map repository', detail: 'Context gathered', state: 'done' },
  { label: 'Build living world', detail: 'Animating impact', state: 'active' },
  { label: 'Verify experience', detail: 'Browser review', state: 'queued' },
]

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)
const fixed = (value: number, digits: number) => value.toFixed(digits)

function MetricIcon({ kind }: { kind: keyof Impact }) {
  if (kind === 'water') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5S5.5 10 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5Z" />
        <path d="M9 16.2c.35 1.25 1.35 2 2.7 2.15" />
      </svg>
    )
  }
  if (kind === 'energy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 21V5h9v16M8.5 5V2.5h5V5M8.7 8h4.6v4H8.7z" />
        <path d="M15.5 8h1.7l1.8 2.4V18a1.5 1.5 0 0 0 3 0v-5.5l-1.7-1.7" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18.5h10a4 4 0 0 0 .45-7.97A5.8 5.8 0 0 0 6.4 9.05 4.75 4.75 0 0 0 7 18.5Z" />
      <path d="M12 12v9M9.7 14.5 12 16.8l2.3-2.3" />
    </svg>
  )
}

function MetricCard({
  kind,
  label,
  value,
  delta,
  unit,
  digits,
  active,
}: {
  kind: keyof Impact
  label: string
  value: number
  delta: number
  unit: string
  digits: number
  active: boolean
}) {
  return (
    <article className={`metric-card metric-${kind} ${active ? 'is-active' : ''}`}>
      <div className="metric-head">
        <span>{label}</span>
        <MetricIcon kind={kind} />
      </div>
      <div className="metric-value">
        <strong>{fixed(value, digits)}</strong>
        <span>{unit}</span>
      </div>
      <div className="metric-delta">
        <span className="pulse-dot" />
        {delta > 0 ? `+${fixed(delta, digits)} ${unit} this task` : 'Waiting for activity'}
      </div>
      <div className="signal-line"><i /></div>
    </article>
  )
}

function App() {
  const [phase, setPhase] = useState<Phase>('working')
  const [mode, setMode] = useState<DemoMode>('full')
  const [runId, setRunId] = useState(1)
  const [impact, setImpact] = useState<Impact>(INITIAL_IMPACT)
  const [delta, setDelta] = useState<Impact>({ water: 0, energy: 0, co2: 0 })
  const [isAnimating, setIsAnimating] = useState(true)
  const startImpact = useRef(INITIAL_IMPACT)
  const frame = useRef<number>()
  const loopTimer = useRef<number>()

  const runDemo = useCallback((nextMode: DemoMode) => {
    if (frame.current) cancelAnimationFrame(frame.current)
    if (loopTimer.current) window.clearTimeout(loopTimer.current)
    setMode(nextMode)
    setIsAnimating(true)
    startImpact.current = INITIAL_IMPACT
    setImpact(INITIAL_IMPACT)
    setRunId((value) => value + 1)
    setPhase('working')
    setDelta({ water: 0, energy: 0, co2: 0 })
  }, [])

  useEffect(() => {
    if (phase !== 'working' || !isAnimating) return

    const duration = mode === 'full' ? 8200 : 6200
    const started = performance.now()
    const target = RUN_IMPACT[mode]
    let lastPaint = 0

    const tick = (now: number) => {
      const raw = Math.min((now - started) / duration, 1)
      const eased = easeOutCubic(raw)

      if (now - lastPaint > 32 || raw === 1) {
        const nextDelta = {
          water: target.water * eased,
          energy: target.energy * eased,
          co2: target.co2 * eased,
        }
        setDelta(nextDelta)
        setImpact({
          water: startImpact.current.water + nextDelta.water,
          energy: startImpact.current.energy + nextDelta.energy,
          co2: startImpact.current.co2 + nextDelta.co2,
        })
        lastPaint = now
      }

      if (raw < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        loopTimer.current = window.setTimeout(() => {
          startImpact.current = INITIAL_IMPACT
          setImpact(INITIAL_IMPACT)
          setDelta({ water: 0, energy: 0, co2: 0 })
          setRunId((value) => value + 1)
        }, 550)
      }
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      if (loopTimer.current) window.clearTimeout(loopTimer.current)
    }
  }, [phase, mode, runId, isAnimating])

  const toggleAnimation = useCallback(() => {
    if (isAnimating) {
      setIsAnimating(false)
      setPhase('idle')
      setDelta({ water: 0, energy: 0, co2: 0 })
      return
    }
    startImpact.current = INITIAL_IMPACT
    setImpact(INITIAL_IMPACT)
    setDelta({ water: 0, energy: 0, co2: 0 })
    setRunId((value) => value + 1)
    setPhase('working')
    setIsAnimating(true)
  }, [isAnimating])

  const normalized = useMemo(() => ({
    water: Math.min(1, impact.water / 24),
    energy: Math.min(1, impact.energy / 1.8),
    co2: Math.min(1, impact.co2 / 0.85),
  }), [impact])

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />

      <header className="topbar">
        <div className="brand-lockup">
          <img src="/codex-mark.webp" alt="OpenAI mark" />
          <div>
            <strong>Quiet Garden</strong>
            <span>for Codex</span>
          </div>
        </div>
        <div className="topbar-center">
          <span className="live-dot" />
          Live environmental telemetry
        </div>
        <div className="session-meta">
          <span>SESSION 04</span>
          <button className="icon-button" aria-label="Sound on">
            <svg viewBox="0 0 24 24"><path d="M5 10v4h3l4 3V7L8 10H5Zm10.5 0a3 3 0 0 1 0 4M18 7.5a6.5 6.5 0 0 1 0 9" /></svg>
          </button>
        </div>
      </header>

      <aside className="task-panel glass-panel">
        <div className="panel-kicker">AGENT ACTIVITY</div>
        <h2>Building the experience</h2>
        <div className="task-list">
          {TASKS.map((task, index) => {
            const state = index === 1
              ? 'active'
              : task.state
            return (
              <div className={`task-row task-${state}`} key={task.label}>
                <div className="task-node">
                  {state === 'done' ? '✓' : state === 'active' ? <span /> : ''}
                </div>
                <div>
                  <strong>{task.label}</strong>
                  <span>{state === 'active' ? task.detail : state === 'done' ? 'Complete' : 'Queued'}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="code-card">
          <div className="code-card-head"><span /><span /><span /></div>
          <code>
            <i>agent</i>.run({'{'})<br />
            &nbsp;&nbsp;world: <b>"quiet-garden"</b>,<br />
            &nbsp;&nbsp;impact: <b>"live"</b><br />
            {'}'})
          </code>
        </div>
      </aside>

      <section className="world-stage" aria-label="Animated three-dimensional environmental impact garden">
        <GardenWorld
          phase={phase}
          runId={runId}
          mode={mode}
          levels={normalized}
        />
        {mode === 'lighter' && (
          <div className="savings-toast">
            <span className="savings-spark">✦</span>
            <div>
              <strong>Lighter route</strong>
              <span>3.5 mL · 0.30 Wh · 0.11 gCO₂e avoided</span>
            </div>
          </div>
        )}
      </section>

      <aside className="metrics-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">SESSION IMPACT</span>
            <h2>Living totals</h2>
          </div>
          <span className="telemetry-pulse"><i /><i /><i /></span>
        </div>
        <MetricCard kind="water" label="Water" value={impact.water} delta={delta.water} unit="mL" digits={1} active={isAnimating && phase === 'working'} />
        <MetricCard kind="energy" label="Energy" value={impact.energy} delta={delta.energy} unit="Wh" digits={2} active={isAnimating && phase === 'working'} />
        <MetricCard kind="co2" label="Carbon" value={impact.co2} delta={delta.co2} unit="gCO₂e" digits={2} active={isAnimating && phase === 'working'} />

        <div className="demo-controls glass-panel">
          <span className="panel-kicker">DEMO CONTROL</span>
          <p>Continuously looping a live task through the garden.</p>
          <button
            className="primary-button"
            onClick={() => runDemo(mode === 'full' ? 'lighter' : 'full')}
          >
            <span>{mode === 'full' ? 'Switch to lighter route' : 'Switch to full route'}</span>
            <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
          </button>
          <button className="text-button" onClick={() => runDemo(mode === 'full' ? 'lighter' : 'full')}>
            {mode === 'full' ? 'Preview efficient loop' : 'Return to standard loop'}
          </button>
          <button className="animation-toggle" onClick={toggleAnimation}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {isAnimating ? <path d="M8.5 6v12M15.5 6v12" /> : <path d="m9 6 7 6-7 6V6Z" />}
            </svg>
            {isAnimating ? 'Stop prompt production' : 'Start prompt production'}
          </button>
        </div>
      </aside>

      <footer className="footer-note">
        <span>ESTIMATED IN REAL TIME</span>
        <i />
        <span>MODEL + REGION + TOKEN MIX</span>
      </footer>
    </main>
  )
}

export default App
