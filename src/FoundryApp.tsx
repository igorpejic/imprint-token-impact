import { useCallback, useEffect, useRef, useState } from 'react'
import FoundryWorld from './components/FoundryWorld'
import type { DemoMode, Impact, Phase } from './types'

const START: Impact = { water: 3.4, energy: 0.28, co2: 0.1 }
const COST: Record<DemoMode, Impact> = {
  full: { water: 5.2, energy: 0.48, co2: 0.17 },
  lighter: { water: 1.9, energy: 0.17, co2: 0.06 },
}

const ease = (value: number) => value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2

function ImpactReadout({ label, value, delta, unit, tone }: {
  label: string
  value: number
  delta: number
  unit: string
  tone: string
}) {
  return (
    <article className="foundry-metric" style={{ '--tone': tone } as React.CSSProperties}>
      <div className="foundry-metric-label"><i />{label}</div>
      <strong>{value.toFixed(unit === 'mL' ? 1 : 2)} <small>{unit}</small></strong>
      <span>{delta > 0 ? `+${delta.toFixed(unit === 'mL' ? 1 : 2)} ${unit} this run` : 'Standing by'}</span>
    </article>
  )
}

export default function FoundryApp() {
  const [phase, setPhase] = useState<Phase>('working')
  const [mode, setMode] = useState<DemoMode>('full')
  const [runId, setRunId] = useState(1)
  const [progress, setProgress] = useState(0)
  const [impact, setImpact] = useState<Impact>(START)
  const [delta, setDelta] = useState<Impact>({ water: 0, energy: 0, co2: 0 })
  const [isAnimating, setIsAnimating] = useState(true)
  const startImpact = useRef(START)
  const frame = useRef<number>()
  const loopTimer = useRef<number>()

  const run = useCallback((nextMode: DemoMode) => {
    if (frame.current) cancelAnimationFrame(frame.current)
    if (loopTimer.current) window.clearTimeout(loopTimer.current)
    startImpact.current = START
    setImpact(START)
    setMode(nextMode)
    setIsAnimating(true)
    setPhase('working')
    setProgress(0)
    setDelta({ water: 0, energy: 0, co2: 0 })
    setRunId((value) => value + 1)
  }, [])

  useEffect(() => {
    if (phase !== 'working' || !isAnimating) return
    const duration = mode === 'full' ? 7200 : 5400
    const started = performance.now()
    const target = COST[mode]

    const tick = (now: number) => {
      const raw = Math.min(1, (now - started) / duration)
      const animated = ease(raw)
      setProgress(raw)
      const next = {
        water: target.water * animated,
        energy: target.energy * animated,
        co2: target.co2 * animated,
      }
      setDelta(next)
      setImpact({
        water: startImpact.current.water + next.water,
        energy: startImpact.current.energy + next.energy,
        co2: startImpact.current.co2 + next.co2,
      })
      if (raw < 1) frame.current = requestAnimationFrame(tick)
      else {
        loopTimer.current = window.setTimeout(() => {
          startImpact.current = START
          setImpact(START)
          setDelta({ water: 0, energy: 0, co2: 0 })
          setProgress(0)
          setRunId((value) => value + 1)
        }, 500)
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
      setProgress(0)
      setDelta({ water: 0, energy: 0, co2: 0 })
      return
    }
    startImpact.current = START
    setImpact(START)
    setDelta({ water: 0, energy: 0, co2: 0 })
    setProgress(0)
    setRunId((value) => value + 1)
    setPhase('working')
    setIsAnimating(true)
  }, [isAnimating])

  const activeStage = progress < 0.14 ? 0 : progress < 0.38 ? 1 : progress < 0.78 ? 2 : 3
  const status = !isAnimating ? 'Prompt production paused' : phase === 'working'
    ? ['Loading prompt', 'Cooling systems online', 'Forging the answer', 'Inspecting output'][activeStage]
    : 'Foundry ready'

  return (
    <main className="foundry-shell">
      <header className="foundry-header">
        <a className="foundry-brand" href="/foundry">
          <img src="/codex-mark.webp" alt="OpenAI mark" />
          <span><strong>Token Foundry</strong><small>Codex impact lab</small></span>
        </a>
        <div className="foundry-live"><i /> LIVE RESOURCE TRACE</div>
        <a className="foundry-switch" href="/">View garden <span>↗</span></a>
      </header>

      <aside className="foundry-story">
        <span className="foundry-kicker">CURRENT RUN</span>
        <h1>Forge intelligence.<br /><em>See its cost.</em></h1>
        <p>Follow a prompt through the physical systems that cool, power, and process every answer.</p>

        <div className="foundry-stages">
          {['Prompt intake', 'Cool the core', 'Token forge', 'Answer output'].map((label, index) => (
            <div className={`${index === activeStage && phase === 'working' ? 'active' : ''} ${index < activeStage || phase === 'complete' ? 'done' : ''}`} key={label}>
              <i>{index < activeStage ? '✓' : index + 1}</i>
              <span>{label}<small>{index === activeStage && phase === 'working' ? 'In progress' : index < activeStage ? 'Complete' : 'Waiting'}</small></span>
            </div>
          ))}
        </div>

        <div className="foundry-copy-block">
          <code>codex.forge({'{'} route: "{mode === 'full' ? 'full' : 'lighter'}" {'}'})</code>
        </div>
      </aside>

      <section className="foundry-stage">
        <FoundryWorld phase={phase} mode={mode} progress={progress} runId={runId} />
        <div className={`foundry-status ${isAnimating && phase === 'working' ? 'working' : ''}`}>
          <i />
          <span><strong>{status}</strong><small>{isAnimating ? `${Math.round(progress * (mode === 'full' ? 2840 : 1610)).toLocaleString()} tokens processed` : 'Foundry systems remain on standby'}</small></span>
        </div>
        {mode === 'lighter' && (
          <div className="foundry-savings"><b>✦</b><span><strong>Lighter route</strong><small>3.3 mL · 0.31 Wh · 0.11 gCO₂e avoided</small></span></div>
        )}
      </section>

      <aside className="foundry-data">
        <div className="foundry-data-head"><span className="foundry-kicker">LIVE CONSUMPTION</span><i>•••</i></div>
        <ImpactReadout label="Coolant water" value={impact.water} delta={delta.water} unit="mL" tone="#6fc8ff" />
        <ImpactReadout label="Machine energy" value={impact.energy} delta={delta.energy} unit="Wh" tone="#ffc060" />
        <ImpactReadout label="Exhaust carbon" value={impact.co2} delta={delta.co2} unit="gCO₂e" tone="#b193df" />

        <div className="foundry-controls">
          <span className="foundry-kicker">DEMO SEQUENCE</span>
          <p>Continuously looping a prompt through the miniature foundry.</p>
          <button onClick={() => run(mode === 'full' ? 'lighter' : 'full')}>
            {mode === 'full' ? 'Switch to lighter route' : 'Switch to full route'}
            <span>→</span>
          </button>
          <button className="foundry-secondary" onClick={() => run(mode === 'full' ? 'lighter' : 'full')}>{mode === 'full' ? 'Preview efficient loop' : 'Return to standard loop'}</button>
          <button className="foundry-animation-toggle" onClick={toggleAnimation}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {isAnimating ? <path d="M8.5 6v12M15.5 6v12" /> : <path d="m9 6 7 6-7 6V6Z" />}
            </svg>
            {isAnimating ? 'Stop prompt production' : 'Start prompt production'}
          </button>
        </div>
      </aside>
    </main>
  )
}
