import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
const icon = (glyph: string) => function Icon(_props: { size?: number }) { return <span aria-hidden="true">{glyph}</span>; };
const BarChart3 = icon("▥"), Check = icon("✓"), ChevronDown = icon("⌄"), Droplets = icon("◉"), Factory = icon("◫"), FolderSearch = icon("▣"), Leaf = icon("✦"), MapPinned = icon("⌖"), Search = icon("⌕"), Sparkles = icon("✧"), Trees = icon("♣"), Zap = icon("ϟ");
import type { Dashboard, Period, Project } from "./types";
import "./styles.css";
import "./card-layout.css";
import "./animation-tab.css";
import GardenWorld from "./components/GardenWorld";
import FoundryWorld from "./components/FoundryWorld";
import HouseholdWorld from "./components/HouseholdWorld";
import type { DemoMode, Phase } from "./types";

const periodLabels: Record<Period, string> = { day: "Today", week: "Past week", month: "Past month", lifetime: "Full lifetime" };
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const metric = (value: number, unit: string) => number.format(value) + " " + unit;
const unavailableDashboard = (period: Period): Dashboard => ({ projects: [], total: { energyKWh: 0, carbonKg: 0, waterLitres: 0 }, period, health: { status: "browser", files: 0, processed: 0, errors: 0, codexHome: "" } });

type LiveValues = Pick<Project, "inputTokens" | "cachedInputTokens" | "outputTokens" | "energy" | "carbon" | "water">;
const LIVE_PLAYBACK_MS = 20_000;

function useLivePlayback(project: Project): LiveValues {
  const target: LiveValues = { inputTokens: project.inputTokens, cachedInputTokens: project.cachedInputTokens, outputTokens: project.outputTokens, energy: project.energy, carbon: project.carbon, water: project.water };
  const [display, setDisplay] = useState<LiveValues>({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, energy: 0, carbon: 0, water: 0 });
  const displayRef = useRef(display);
  const projectRef = useRef(project.id);
  useEffect(() => { displayRef.current = display; }, [display]);
  useEffect(() => {
    if (projectRef.current !== project.id) { projectRef.current = project.id; setDisplay(target); return; }
    const start = displayRef.current, started = performance.now(); let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / LIVE_PLAYBACK_MS);
      // Smoothstep keeps the counter calm at both ends, even for small live deltas.
      const eased = progress * progress * (3 - 2 * progress);
      const next = Object.fromEntries(Object.keys(target).map((key) => [key, start[key as keyof LiveValues] + (target[key as keyof LiveValues] - start[key as keyof LiveValues]) * eased])) as LiveValues;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [project.id, project.inputTokens, project.cachedInputTokens, project.outputTokens, project.energy, project.carbon, project.water]);
  return display;
}

function App() {
  const [tab, setTab] = useState<"project" | "compare" | "animations">("project");
  const [period, setPeriod] = useState<Period>("lifetime");
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [activeId, setActiveId] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const refresh = async () => {
    if (!window.imprint) { setDashboard(unavailableDashboard(period)); return; }
    try {
      const next = await window.imprint.getDashboard({ period });
      setDashboard(next);
      setActiveId((value) => value || next.projects.find((project) => project.energy > 0)?.id || next.projects[0]?.id || "");
      setCompareIds((value) => value.length ? value.filter((id) => next.projects.some((project) => project.id === id)) : next.projects.filter((project) => project.energy > 0).slice(0, 3).map((project) => project.id));
    } catch { setDashboard(unavailableDashboard(period)); }
  };
  useEffect(() => { refresh(); return window.imprint?.onUpdate(refresh); }, [period]);
  const active = dashboard?.projects.find((project) => project.id === activeId) || dashboard?.projects[0];
  const selected = (dashboard?.projects || []).filter((project) => compareIds.includes(project.id));
  if (!dashboard) return <main className="loading"><Leaf size={24} /> Connecting to local Codex usage…</main>;
  return <main className="app">
    <header><div className="brand"><span><Droplets size={16}/></span><div><b>Imprint</b><small>the physical cost of your AI</small></div></div><nav><button className={tab === "project" ? "active" : ""} onClick={() => setTab("project")}><FolderSearch size={14}/> Project</button><button className={tab === "compare" ? "active" : ""} onClick={() => setTab("compare")}><BarChart3 size={14}/> Compare</button><button className={tab === "animations" ? "active" : ""} onClick={() => setTab("animations")}><Sparkles size={14}/> Animations</button></nav><p className="live"><i/> {dashboard.health.status === "live" ? "Live Codex monitor" : "Indexing " + dashboard.health.processed + "/" + dashboard.health.files}</p></header>
    {tab === "animations" ? <AnimationsView project={active}/> : active ? tab === "project" ? <ProjectView project={active} projects={dashboard.projects} period={period} setPeriod={setPeriod} setActive={setActiveId}/> : <CompareView projects={dashboard.projects} selected={selected} selectedIds={compareIds} period={period} setPeriod={setPeriod} setSelected={setCompareIds}/> : <section className="empty-dashboard">No Codex projects are available yet.</section>}
    <footer><Leaf size={13}/> Real Codex token events · operational inference estimate · carbon, water and energy remain separate</footer>
  </main>;
}
function ProjectView({project,projects,period,setPeriod,setActive}:{project:Project;projects:Project[];period:Period;setPeriod:(p:Period)=>void;setActive:(id:string)=>void}) {
  const playback = useLivePlayback(project);
  const liveProject = { ...project, ...playback };
  const total = liveProject.inputTokens + liveProject.outputTokens;
  const cached = Math.round(liveProject.cachedInputTokens / Math.max(1, liveProject.inputTokens) * 100);
  return <section className="content">
    <div className="controls"><ProjectDropdown projects={projects} selected={project.id} onChange={setActive}/><PeriodFilter period={period} setPeriod={setPeriod}/></div>
    <section className="summary panel"><div><span className="dot"/><h1>{project.name}</h1><p>{project.models.length ? project.models.length + " model" + (project.models.length > 1 ? "s" : "") + " observed in this project" : "Waiting for Codex activity"}</p></div><div className="sum-numbers"><span><b className="live-value">{compact.format(total)}</b>tokens processed</span><span><b className="live-value">{metric(liveProject.carbon * 1000, "g")}</b>CO₂e in {periodLabels[period].toLowerCase()}</span></div></section>
    <section className="load panel"><div className="load-top"><div><em>PLANETARY LOAD <small className="playback-note">20s live playback</small></em><b className="live-value">{Math.min(100,Math.round(liveProject.carbon*36 + liveProject.energy*12))}%</b></div><p>Actual usage updates after each Codex call. Cached context reduces fresh compute.</p></div><div className="track"><i style={{width:Math.min(100,liveProject.carbon*36+liveProject.energy*12)+"%"}}/></div><ModelMix project={project}/></section>
    <section className="cards"><Carbon project={liveProject}/><Water project={liveProject}/><Energy project={liveProject}/></section>
    <section className="immersive panel"><div className="section-title"><div><em>IMMERSIVE IMPACT</em><h2>Drive through the forest you are protecting</h2></div><span><Sparkles size={14}/> avoided impact clears the haze</span></div><Forest projects={[project]}/><div className="caption"><span><Trees size={15}/> {metric(Math.max(.01,project.carbon*22),"trees·year")} annual sequestration</span><span><Check size={15}/> {cached}% cached-context efficiency</span></div></section>
  </section>;
}
function ProjectDropdown({projects,selected,onChange}:{projects:Project[];selected:string;onChange:(id:string)=>void}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""); const current=projects.find((p)=>p.id===selected); const list=projects.filter((p)=>p.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="picker"><button onClick={()=>setOpen(!open)}><span><i className="dot"/>{current?.name || "Select project"}</span><ChevronDown size={16}/></button>{open && <div className="menu"><label><Search size={15}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search projects…"/></label>{list.map((p)=><button key={p.id} className={p.id===selected?"selected":""} onClick={()=>{onChange(p.id);setOpen(false);setQuery("");}}><span><b>{p.pinned?"Pinned · ":""}{p.name}</b><small>{p.models.length?p.models.map((m)=>m.model).join(" · "):"No captured usage yet"}</small></span>{p.id===selected&&<Check size={16}/>}</button>)}{!list.length&&<p>No matching projects.</p>}</div>}</div>;
}
function PeriodFilter({period,setPeriod}:{period:Period;setPeriod:(p:Period)=>void}) { return <div className="filters">{(Object.keys(periodLabels) as Period[]).map((item)=><button key={item} className={period===item?"active":""} onClick={()=>setPeriod(item)}>{periodLabels[item]}</button>)}</div>; }
function ModelMix({project}:{project:Project}) { const total=Math.max(.000001,project.energy); return <div className="models"><div><span>Observed model mix</span><span>{project.models.length>1?"multi-model project":"single model"}</span></div>{project.models.map((m,i)=><article key={m.model}><p><i className={"c"+i}/>{m.model}<small>{m.confidence==="low"?"estimated profile":"catalog profile"}</small></p><span><b><i className={"c"+i} style={{width:m.energy/total*100+"%"}}/></b><strong>{compact.format(m.inputTokens+m.outputTokens)} tokens</strong></span></article>)}</div>; }
const LONDON_ROUTE_KM = 32;
const londonStops = [[66,137],[116,132],[167,143],[218,157],[269,169],[320,158],[371,171],[422,185],[477,178]] as const;
function londonCarPosition(km: number) { const progress = ((km % LONDON_ROUTE_KM) + LONDON_ROUTE_KM) % LONDON_ROUTE_KM / LONDON_ROUTE_KM, scaled = progress * (londonStops.length - 1), index = Math.min(londonStops.length - 2, Math.floor(scaled)), portion = scaled - index, start = londonStops[index], end = londonStops[index + 1]; return { x: start[0] + (end[0] - start[0]) * portion, y: start[1] + (end[1] - start[1]) * portion, progress }; }
function Carbon({project}:{project:Project}) { const km=project.carbon/.171, car=londonCarPosition(km), completed=Math.floor(km/LONDON_ROUTE_KM), leg=Math.round(car.progress*100); const routeText=completed?`${completed} full London route${completed>1?"s":""} + ${number.format(km-completed*LONDON_ROUTE_KM)} km`:`${leg}% of a 32 km cross-city London route`; return <article className="card carbon"><h3><MapPinned size={15}/>Carbon</h3><div className="metric-copy"><strong>{metric(km,"km")}</strong><p>cumulative small-car distance across Greater London</p></div><div className="map london-map"><span className="route-key">{routeText}</span><svg viewBox="0 0 560 285" role="img" aria-label="Greater London map with cumulative car route"><path className="london-boundary" d="M39 159 51 111 82 83 127 67 178 72 218 50 267 65 313 48 358 65 410 57 449 81 495 89 526 120 518 151 540 178 520 208 482 213 448 236 401 228 365 249 312 238 268 256 223 237 172 247 132 227 86 233 55 205Z"/><path className="thames" d="M18 164C77 151 111 173 158 160S237 144 278 162s77 31 125 15 77-32 139-21"/><g className="borough-lines"><path d="M89 101 111 222M151 79 165 237M218 65 226 240M287 58 293 242M359 63 365 234M431 75 426 222"/><path d="M59 128 497 126M47 176 518 177M75 210 485 209"/></g><path className="route-shadow" d="M66 137C93 126 102 132 116 132S151 135 167 143 202 153 218 157 253 167 269 169 304 163 320 158 354 165 371 171 407 181 422 185 458 176 477 178" pathLength="100"/><path className="route-live" d="M66 137C93 126 102 132 116 132S151 135 167 143 202 153 218 157 253 167 269 169 304 163 320 158 354 165 371 171 407 181 422 185 458 176 477 178" pathLength="100" strokeDasharray="100" strokeDashoffset={100-car.progress*100}/><g className="landmarks"><text x="57" y="117">Heathrow</text><text x="157" y="126">Kensington</text><text x="242" y="148">Westminster</text><text x="319" y="147">City</text><text x="404" y="170">Canary Wharf</text><text x="467" y="168">Greenwich</text></g><g className="car-marker" style={{transform:`translate(${car.x}px, ${car.y}px)`}}><rect x="-8" y="-5" width="16" height="9" rx="3"/><circle cx="-5" cy="5" r="2"/><circle cx="5" cy="5" r="2"/></g></svg></div><footer>{metric(project.carbon*1000,"g CO₂e")} operational estimate</footer></article>; }
function Water({project}:{project:Project}) { const bottleEquivalents=Math.round(project.water/.5), count=Math.min(42,Math.max(0,Math.floor(project.water/5))); return <article className="card water"><h3><Droplets size={15}/>Water</h3><div className="metric-copy"><strong>{metric(project.water,"L")}</strong><p>{bottleEquivalents} reusable-bottle equivalents</p></div><div className="water-scene"><div>{Array.from({length:count},(_,i)=><i key={i}/>)}</div><b className="person"/></div><footer>{count} visual stacks · each represents 5 litres</footer></article>; }
function Energy({project}:{project:Project}) { const lit=Math.min(10,Math.floor(project.energy/5)); return <article className="card energy"><h3><Zap size={15}/>Energy</h3><div className="metric-copy"><strong>{metric(project.energy/.62,"hrs")}</strong><p>of a home’s evening electricity</p></div><div className="house"><i className="moon"/>{Array.from({length:10},(_,i)=><b key={i} className={i<lit?"lit":""}/>)}</div><footer>{metric(project.energy,"kWh")} drawn from the grid · one window per 5 kWh</footer></article>; }
function CompareView({projects,selected,selectedIds,period,setPeriod,setSelected}:{projects:Project[];selected:Project[];selectedIds:string[];period:Period;setPeriod:(p:Period)=>void;setSelected:(v:string[])=>void}) {
  const [daily,setDaily]=useState(false); const toggle=(id:string)=>setSelected(selectedIds.includes(id)?selectedIds.filter((v)=>v!==id):selectedIds.length<5?[...selectedIds,id]:selectedIds); const value=(project:Project,key:"carbon"|"water"|"energy")=>daily?project[key]/(period==="month"?30:period==="week"?7:1):project[key];
  return <section className="content"><div className="controls compare-controls"><ComparePicker projects={projects} selected={selectedIds} toggle={toggle}/><div className="filters"><button className={!daily?"active":""} onClick={()=>setDaily(false)}>Total usage</button><button className={daily?"active":""} onClick={()=>setDaily(true)}>Per day</button></div><PeriodFilter period={period} setPeriod={setPeriod}/></div><section className="compare-title panel"><div><em>COMPARE UP TO FIVE PROJECTS</em><h1>Footprint, without a blended score</h1><p>Ranked separately by carbon, water, energy, and a transparent impact index.</p></div><b>{selected.length}/5 selected</b></section><section className="chart-grid"><Rank title="Carbon" unit="kg CO₂e" icon={<Factory size={15}/>} projects={selected} get={(p)=>value(p,"carbon")}/><Rank title="Water" unit="litres" icon={<Droplets size={15}/>} projects={selected} get={(p)=>value(p,"water")}/><Rank title="Energy" unit="kWh" icon={<Zap size={15}/>} projects={selected} get={(p)=>value(p,"energy")}/><Rank title="Impact index" unit="/ 100" icon={<Leaf size={15}/>} projects={selected} get={(p)=>p.carbon*55+p.water*2+p.energy*18}/></section><section className="immersive panel"><div className="section-title"><div><em>COMPARE IN THE FOREST</em><h2>One route per project, one shared atmosphere</h2></div><span><Leaf size={14}/> lighter choices clear the haze</span></div><Forest projects={selected}/><div className="caption"><span><Trees size={15}/> cars represent projects, not consumption as a reward</span><span>{daily?"daily intensity":"total selected period"}</span></div></section></section>;
}
function ComparePicker({projects,selected,toggle}:{projects:Project[];selected:string[];toggle:(id:string)=>void}) { const [open,setOpen]=useState(false),[query,setQuery]=useState(""); const list=projects.filter((p)=>p.name.toLowerCase().includes(query.toLowerCase())); return <div className="picker compare-picker"><button onClick={()=>setOpen(!open)}><span><BarChart3 size={15}/>Choose projects</span><b>{selected.length}/5</b></button>{open&&<div className="menu"><label><Search size={15}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search up to 100 projects…"/></label>{list.map((p)=><button key={p.id} className={selected.includes(p.id)?"selected":""} onClick={()=>toggle(p.id)}><span><b>{p.name}</b><small>{p.models.length?p.models.length+" model"+(p.models.length>1?"s":""):"No usage"}</small></span>{selected.includes(p.id)&&<Check size={16}/>}</button>)}</div>}</div>; }
function Rank({title,unit,icon,projects,get}:{title:string;unit:string;icon:React.ReactNode;projects:Project[];get:(p:Project)=>number}) { const list=[...projects].sort((a,b)=>get(b)-get(a)),max=Math.max(.0001,...list.map(get)); return <article className="rank panel"><header><span>{icon}{title}</span><small>{unit}</small></header>{list.length?list.map((p,i)=><div key={p.id}><em>0{i+1}</em><section><b>{p.name}</b><span><i style={{width:get(p)/max*100+"%"}}/></span></section><strong>{number.format(get(p))}</strong></div>):<p>Choose up to five projects to compare.</p>}</article>; }
function Forest({projects}:{projects:Project[]}) { const haze=Math.min(.76,projects.reduce((sum,p)=>sum+p.carbon,0)*.15); return <div className="forest" style={{["--haze" as string]:haze}}><div className="trees">{Array.from({length:34},(_,i)=><i key={i} style={{left:(i*11)%100+"%",bottom:10+(i*17)%33+"%",transform:"scale("+(.5+(i%5)*.13)+")"}}/>)}</div><div className="road"/>{projects.map((p,i)=><div className={"car car"+i} key={p.id} style={{left:18+i*16+"%"}}><i/><small>{p.name}</small></div>)}<b className="haze"/></div>; }

function AnimationsView({project}:{project?:Project}) { return project ? <MetricWorld project={project}/> : <section className="empty-dashboard">Choose a Codex project to enter the world view.</section>; }
function MetricWorld({project}:{project:Project}) {
  const [scene, setScene] = useState<"home" | "garden" | "foundry">("home");
  const [phase, setPhase] = useState<Phase>("working");
  const [runId, setRunId] = useState(1);
  const [progress, setProgress] = useState(.12);
  const live = useLivePlayback(project);
  const tokenVolume = live.inputTokens + live.outputTokens;
  const levels = { water: Math.min(1, live.water / 180), energy: Math.min(1, live.energy / 30), co2: Math.min(1, live.carbon / 8) };
  const intensity = Math.max(levels.water, levels.energy, levels.co2);
  const mode: DemoMode = intensity > .45 ? "full" : "lighter";
  useEffect(() => {
    if (phase !== "working") return;
    const speed = .003 + intensity * .007;
    const timer = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : value + speed), 80);
    return () => window.clearInterval(timer);
  }, [phase, intensity]);
  useEffect(() => { setRunId((value) => value + 1); }, [project.inputTokens, project.outputTokens, project.energy, project.water, project.carbon]);
  const restart = () => { setProgress(0); setPhase("working"); setRunId((value) => value + 1); };
  return <section className="animation-tab">
    <div className="animation-tab-head"><div><em>IMMERSIVE LIVE VIEW</em><h1>{project.name} · physical footprint</h1><p>Watch your AI usage become a tangible household and land simulation.</p></div><div className="animation-picker"><button className={scene === "home" ? "active" : ""} onClick={() => setScene("home")}>Home & land</button><button className={scene === "garden" ? "active" : ""} onClick={() => setScene("garden")}>Living world</button><button className={scene === "foundry" ? "active" : ""} onClick={() => setScene("foundry")}>Token foundry</button></div></div>
    <div className="impact-readout"><span><i className="co2"/>Carbon <b>{metric(live.carbon * 1000, "g")}</b></span><span><i className="water"/>Water <b>{metric(live.water, "L")}</b></span><span><i className="energy"/>Energy <b>{metric(live.energy, "kWh")}</b></span><span><i className="tokens"/>Tokens <b>{compact.format(tokenVolume)}</b></span></div>
    <div className="animation-canvas">{scene === "home" ? <HouseholdWorld carbonKg={live.carbon} waterLitres={live.water} energyKWh={live.energy} tokenVolume={tokenVolume} paused={phase !== "working"}/> : scene === "garden" ? <GardenWorld phase={phase} runId={runId} mode={mode} levels={levels}/> : <FoundryWorld phase={phase} runId={runId} mode={mode} progress={progress}/>}</div>
    <div className="animation-toolbar"><div><b>{scene === "home" ? "Home & land" : scene === "garden" ? "Living world" : "Token foundry"}</b><span>{scene === "home" ? "resource draw and land burden follow live monitored usage" : mode === "full" ? "high observed load · full processing path" : "lighter observed load · reduced processing path"}</span></div><button onClick={() => setPhase((value) => value === "working" ? "idle" : "working")}>{phase === "working" ? "Pause" : "Play"}</button><button onClick={restart}>Replay live feed</button></div>
  </section>;
}
createRoot(document.getElementById("root")!).render(<App/>);
