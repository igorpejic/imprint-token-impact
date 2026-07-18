import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import GardenWorld from './components/GardenWorld'
import FoundryWorld from './components/FoundryWorld'
import type { Dashboard, DemoMode, Period, Phase, Project } from './types'
import './styles.css'

const periods: Period[] = ['day', 'week', 'month', 'lifetime']
const periodLabel: Record<Period, string> = { day: 'Today', week: 'Past week', month: 'Past month', lifetime: 'All time' }
const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

function emptyDashboard(period: Period): Dashboard {
  return {
    projects: [], total: { energyKWh: 0, carbonKg: 0, waterLitres: 0 }, period,
    health: { status: 'unavailable', files: 0, processed: 0, errors: 0, codexHome: '' },
  }
}

function Monitor({ dashboard, period, setPeriod }: { dashboard: Dashboard; period: Period; setPeriod: (period: Period) => void }) {
  const projects = dashboard.projects.filter((project) => project.energy > 0)
  return <section className="monitor-view">
    <div className="monitor-heading">
      <div><span className="eyebrow">LOCAL CODEX USAGE</span><h1>Your environmental footprint</h1><p>Carbon, water and energy stay separate; values are operational estimates from recorded token activity.</p></div>
      <div className="periods">{periods.map((item) => <button key={item} className={item === period ? 'active' : ''} onClick={() => setPeriod(item)}>{periodLabel[item]}</button>)}</div>
    </div>
    <div className="total-grid">
      <Metric label="Carbon" value={dashboard.total.carbonKg * 1000} unit="g CO₂e" />
      <Metric label="Water" value={dashboard.total.waterLitres} unit="litres" />
      <Metric label="Energy" value={dashboard.total.energyKWh} unit="kWh" />
    </div>
    <section className="project-panel">
      <div className="panel-title"><div><span className="eyebrow">PROJECTS</span><h2>Observed activity</h2></div><span className={'monitor-status ' + dashboard.health.status}>{dashboard.health.status === 'live' ? '● Live monitor' : `Indexing ${dashboard.health.processed}/${dashboard.health.files}`}</span></div>
      {projects.length ? <div className="project-list">{projects.map((project) => <ProjectRow key={project.id} project={project} />)}</div> : <p className="empty">No token events have been indexed for this period yet. Keep using Codex and this view will update automatically.</p>}
    </section>
  </section>
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <article className="total-card"><span>{label}</span><strong>{number.format(value)}</strong><small>{unit}</small></article>
}

function ProjectRow({ project }: { project: Project }) {
  const tokens = project.inputTokens + project.outputTokens
  return <article className="project-row"><div><strong>{project.name}</strong><small>{project.models.length ? project.models.map((model) => model.model).join(' · ') : 'Model pending'}</small></div><span>{number.format(tokens)} tokens</span><span>{number.format(project.carbon * 1000)} g CO₂e</span><span>{number.format(project.water)} L</span></article>
}

function Animations() {
  const [scene, setScene] = useState<'garden' | 'foundry'>('garden')
  const [mode, setMode] = useState<DemoMode>('full')
  const [phase, setPhase] = useState<Phase>('working')
  const [runId, setRunId] = useState(1)
  const [progress, setProgress] = useState(0.2)

  useEffect(() => {
    if (phase !== 'working') return
    const timer = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : value + 0.006), 80)
    return () => window.clearInterval(timer)
  }, [phase])

  const restart = () => { setProgress(0); setPhase('working'); setRunId((value) => value + 1) }
  const levels = mode === 'full' ? { water: 0.75, energy: 0.7, co2: 0.72 } : { water: 0.3, energy: 0.28, co2: 0.24 }
  return <section className="animations-view">
    <div className="animation-heading"><div><span className="eyebrow">INTERACTIVE IMPACT</span><h1>See the cost of each run</h1><p>Choose a visual interpretation of the monitor’s carbon, water and energy signals.</p></div><div className="scene-tabs"><button className={scene === 'garden' ? 'active' : ''} onClick={() => setScene('garden')}>Quiet Garden</button><button className={scene === 'foundry' ? 'active' : ''} onClick={() => setScene('foundry')}>Token Foundry</button></div></div>
    <div className="animation-stage">
      {scene === 'garden' ? <GardenWorld phase={phase} runId={runId} mode={mode} levels={levels} /> : <FoundryWorld phase={phase} runId={runId} mode={mode} progress={progress} />}
    </div>
    <div className="animation-controls"><div><strong>{scene === 'garden' ? 'Quiet Garden' : 'Token Foundry'}</strong><span>{mode === 'full' ? 'Full route visualisation' : 'Lighter route visualisation'}</span></div><button onClick={() => { setMode((value) => value === 'full' ? 'lighter' : 'full'); restart() }}>{mode === 'full' ? 'Show lighter route' : 'Show full route'}</button><button onClick={() => setPhase((value) => value === 'working' ? 'idle' : 'working')}>{phase === 'working' ? 'Pause' : 'Play'}</button><button onClick={restart}>Restart</button></div>
  </section>
}

function ImprintApp() {
  const [tab, setTab] = useState<'monitor' | 'animations'>('monitor')
  const [period, setPeriod] = useState<Period>('lifetime')
  const [dashboard, setDashboard] = useState<Dashboard>(() => emptyDashboard('lifetime'))

  useEffect(() => {
    if (!window.imprint) return
    const refresh = () => window.imprint.getDashboard({ period }).then(setDashboard).catch(() => setDashboard(emptyDashboard(period)))
    refresh()
    return window.imprint.onUpdate(refresh)
  }, [period])

  return <main className="imprint-app">
    <header className="app-header"><div className="brand"><span>◉</span><div><strong>Imprint</strong><small>the physical cost of your AI</small></div></div><nav><button className={tab === 'monitor' ? 'active' : ''} onClick={() => setTab('monitor')}>Monitor</button><button className={tab === 'animations' ? 'active' : ''} onClick={() => setTab('animations')}>Animations</button></nav><span className="header-status">{dashboard.health.status === 'live' ? '● Live Codex monitor' : 'Local monitor'}</span></header>
    {tab === 'monitor' ? <Monitor dashboard={dashboard} period={period} setPeriod={setPeriod} /> : <Animations />}
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><ImprintApp /></StrictMode>)
