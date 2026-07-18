const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const readline = require("node:readline");
const chokidar = require("chokidar");
const { DatabaseSync } = require("node:sqlite");

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const ROOTS = [path.join(CODEX_HOME, "sessions"), path.join(CODEX_HOME, "archived_sessions")];
const GLOBAL_STATE = path.join(CODEX_HOME, ".codex-global-state.json");
const db = new DatabaseSync(workerData.dbPath);
let projects = [];
let lastNotify = 0;
const activeScans = new Set();
const pendingScans = new Set();
const health = { status: "starting", files: 0, processed: 0, errors: 0 };

db.exec("PRAGMA journal_mode=WAL;" +
  "CREATE TABLE IF NOT EXISTS usage_events(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, observed_at INTEGER NOT NULL, project_id TEXT NOT NULL, cwd TEXT, model TEXT NOT NULL, input_tokens INTEGER NOT NULL, cached_input_tokens INTEGER NOT NULL, cache_write_input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, reasoning_output_tokens INTEGER NOT NULL, energy_low REAL NOT NULL, energy_central REAL NOT NULL, energy_high REAL NOT NULL, carbon_low REAL NOT NULL, carbon_central REAL NOT NULL, carbon_high REAL NOT NULL, water_low REAL NOT NULL, water_central REAL NOT NULL, water_high REAL NOT NULL, confidence TEXT NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS events_project_time ON usage_events(project_id,observed_at);" +
  "CREATE TABLE IF NOT EXISTS file_cursors(file_path TEXT PRIMARY KEY, byte_offset INTEGER NOT NULL, context_json TEXT NOT NULL, modified_at INTEGER NOT NULL);");

const profiles = [
  [/gpt-5\.6-sol/i, 1.05, 1.85, 3.0, "low"], [/gpt-5\.6-terra/i, .53, .93, 1.5, "low"], [/gpt-5\.6-luna/i, .21, .37, .6, "low"],
  [/gpt-5\.5/i, .9, 1.6, 2.6, "medium"], [/gpt-5\.4/i, .58, 1.05, 1.7, "medium"], [/gpt-5\.3|gpt-5\.2/i, .5, .9, 1.45, "medium"],
  [/gpt-5\.1/i, .46, .82, 1.34, "medium"], [/gpt-5|o3|o4/i, .38, .72, 1.2, "medium"], [/gpt-4o-mini|mini|nano/i, .08, .18, .3, "medium"], [/gpt-4o|gpt-4/i, .35, .7, 1.2, "medium"],
];
function num(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function profile(model) { return profiles.find((p) => p[0].test(model || "")) || [/./, .35, 1.1, 3, "low"]; }
function impacts(tokens, model) {
  const p = profile(model), input = Math.max(0, num(tokens.input_tokens)), cached = Math.min(input, Math.max(0, num(tokens.cached_input_tokens))), output = Math.max(0, num(tokens.output_tokens));
  const effective = input - cached + cached * .12 + output * 1.6;
  const make = (wh) => { const energy = effective / 1000 * wh / 1000; return { energy, carbon: energy * .3844, water: energy * (.569 + 1.2 * 3.1321) }; };
  return { low: make(p[1]), central: make(p[2]), high: make(p[3]), confidence: p[4] };
}
async function loadProjects() {
  try {
    const state = JSON.parse(await fsp.readFile(GLOBAL_STATE, "utf8"));
    const map = state["local-projects"] || {}, pinned = state["pinned-project-ids"] || [], order = state["project-order"] || [];
    projects = Object.values(map).map((item) => ({ id: item.id, name: item.name || path.basename(item.rootPaths?.[0] || item.id), roots: item.rootPaths || [], pinned: pinned.includes(item.id), rank: order.indexOf(item.id) }))
      .sort((a,b) => a.pinned === b.pinned ? a.rank - b.rank || a.name.localeCompare(b.name) : a.pinned ? -1 : 1);
  } catch { projects = []; }
}
function projectId(cwd) {
  const folder = cwd ? path.resolve(cwd) : "";
  const match = projects.filter((item) => item.roots.some((root) => folder === root || folder.startsWith(root + path.sep)))
    .sort((a,b) => Math.max(...b.roots.map((root) => root.length)) - Math.max(...a.roots.map((root) => root.length)))[0];
  return match ? match.id : folder ? "cwd:" + crypto.createHash("sha1").update(folder).digest("hex").slice(0,12) : "unknown";
}
const addEvent = db.prepare("INSERT OR IGNORE INTO usage_events(id,session_id,observed_at,project_id,cwd,model,input_tokens,cached_input_tokens,cache_write_input_tokens,output_tokens,reasoning_output_tokens,energy_low,energy_central,energy_high,carbon_low,carbon_central,carbon_high,water_low,water_central,water_high,confidence) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
function consume(context, data) {
  const payload = data.payload || {};
  if (data.type === "session_meta") { context.sessionId = payload.session_id || payload.id || context.sessionId; context.cwd = payload.cwd || context.cwd; context.model = payload.model || context.model; }
  if (data.type === "turn_context") { context.sessionId = payload.session_id || context.sessionId; context.cwd = payload.cwd || context.cwd; context.model = payload.model || context.model; }
  if (payload.type !== "token_count" || !payload.info?.total_token_usage) return false;
  const last = payload.info.last_token_usage || payload.info.total_token_usage;
  if (num(last.input_tokens) <= 0 && num(last.output_tokens) <= 0) return false;
  const sessionId = context.sessionId || "unknown-session", model = context.model || "unknown";
  const id = crypto.createHash("sha256").update(sessionId + ":" + JSON.stringify(payload.info.total_token_usage)).digest("hex");
  const impact = impacts(last, model);
  return addEvent.run(id, sessionId, Date.parse(data.timestamp || "") || Date.now(), projectId(context.cwd), context.cwd || null, model, num(last.input_tokens), num(last.cached_input_tokens), num(last.cache_write_input_tokens), num(last.output_tokens), num(last.reasoning_output_tokens), impact.low.energy, impact.central.energy, impact.high.energy, impact.low.carbon, impact.central.carbon, impact.high.carbon, impact.low.water, impact.central.water, impact.high.water, impact.confidence).changes > 0;
}
async function scan(file) {
  if (activeScans.has(file)) { pendingScans.add(file); return; }
  activeScans.add(file);
  try {
    const stat = await fsp.stat(file), cursor = db.prepare("SELECT byte_offset,context_json FROM file_cursors WHERE file_path=?").get(file);
    let offset = cursor && cursor.byte_offset <= stat.size ? cursor.byte_offset : 0, context = {};
    try { context = cursor ? JSON.parse(cursor.context_json) : {}; } catch {}
    let changed = false;
    const lineStream = readline.createInterface({ input: fs.createReadStream(file, { start: offset, encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of lineStream) {
      offset += Buffer.byteLength(line) + 1;
      if (!line.includes("token_count") && !line.includes("turn_context") && !line.includes("session_meta")) continue;
      try { changed = consume(context, JSON.parse(line)) || changed; } catch {}
    }
    db.prepare("INSERT INTO file_cursors(file_path,byte_offset,context_json,modified_at) VALUES(?,?,?,?) ON CONFLICT(file_path) DO UPDATE SET byte_offset=excluded.byte_offset,context_json=excluded.context_json,modified_at=excluded.modified_at").run(file, offset, JSON.stringify(context), stat.mtimeMs);
    if (changed) notify();
  } catch { health.errors++; }
  finally { activeScans.delete(file); if (pendingScans.delete(file)) scan(file); }
}
async function filesIn(root) {
  const result = [];
  async function walk(folder) {
    let entries; try { entries = await fsp.readdir(folder,{withFileTypes:true}); } catch { return; }
    for (const entry of entries) { const file = path.join(folder,entry.name); if (entry.isDirectory()) await walk(file); else if (entry.isFile() && file.endsWith(".jsonl")) result.push(file); }
  }
  await walk(root); return result;
}
async function backfill() {
  health.status = "indexing";
  const files = (await Promise.all(ROOTS.map(filesIn))).flat();
  const ordered = await Promise.all(files.map(async (file) => ({ file, stat: await fsp.stat(file) })));
  ordered.sort((a,b) => b.stat.mtimeMs - a.stat.mtimeMs); health.files = ordered.length;
  for (const item of ordered) { await scan(item.file); health.processed++; if (health.processed % 10 === 0) notify(); }
  health.status = "live"; notify();
}
function since(period) { return period === "day" ? Date.now()-86400000 : period === "week" ? Date.now()-604800000 : period === "month" ? Date.now()-2592000000 : 0; }
function dashboard(period) {
  const rows = db.prepare("SELECT project_id,cwd,model,SUM(input_tokens) inputTokens,SUM(cached_input_tokens) cachedInputTokens,SUM(output_tokens) outputTokens,SUM(energy_low) energyLow,SUM(energy_central) energyCentral,SUM(energy_high) energyHigh,SUM(carbon_low) carbonLow,SUM(carbon_central) carbonCentral,SUM(carbon_high) carbonHigh,SUM(water_low) waterLow,SUM(water_central) waterCentral,SUM(water_high) waterHigh,MAX(observed_at) lastUsed,MAX(confidence) confidence FROM usage_events WHERE observed_at>=? GROUP BY project_id,cwd,model").all(since(period || "lifetime"));
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.project_id)) map.set(row.project_id,{id:row.project_id,cwd:row.cwd,models:[],lastUsed:0,inputTokens:0,cachedInputTokens:0,outputTokens:0,energy:0,carbon:0,water:0,low:{energy:0,carbon:0,water:0},high:{energy:0,carbon:0,water:0}});
    const item=map.get(row.project_id); item.models.push({model:row.model,inputTokens:row.inputTokens,cachedInputTokens:row.cachedInputTokens,outputTokens:row.outputTokens,energy:row.energyCentral,carbon:row.carbonCentral,water:row.waterCentral,confidence:row.confidence});
    item.inputTokens+=row.inputTokens; item.cachedInputTokens+=row.cachedInputTokens; item.outputTokens+=row.outputTokens; item.energy+=row.energyCentral; item.carbon+=row.carbonCentral; item.water+=row.waterCentral; item.low.energy+=row.energyLow; item.low.carbon+=row.carbonLow; item.low.water+=row.waterLow; item.high.energy+=row.energyHigh; item.high.carbon+=row.carbonHigh; item.high.water+=row.waterHigh; item.lastUsed=Math.max(item.lastUsed,row.lastUsed);
  }
  const known=new Map(projects.map((item)=>[item.id,item])), empty={models:[],lastUsed:0,inputTokens:0,cachedInputTokens:0,outputTokens:0,energy:0,carbon:0,water:0,low:{energy:0,carbon:0,water:0},high:{energy:0,carbon:0,water:0}};
  const list=projects.map((item)=>Object.assign({id:item.id,name:item.name,pinned:item.pinned,rank:item.rank,roots:item.roots},map.get(item.id)||empty));
  for(const item of map.values()) if(!known.has(item.id)) list.push(Object.assign({name:item.cwd?path.basename(item.cwd):"Unassigned project",pinned:false,rank:Number.MAX_SAFE_INTEGER,roots:item.cwd?[item.cwd]:[]},item));
  list.sort((a,b)=>a.pinned===b.pinned ? a.rank-b.rank || b.lastUsed-a.lastUsed || a.name.localeCompare(b.name) : a.pinned?-1:1);
  const total=list.reduce((sum,item)=>({energyKWh:sum.energyKWh+item.energy,carbonKg:sum.carbonKg+item.carbon,waterLitres:sum.waterLitres+item.water}),{energyKWh:0,carbonKg:0,waterLitres:0});
  return {projects:list,total,period:period||"lifetime",health:Object.assign({codexHome:CODEX_HOME},health)};
}
function notify() { if(Date.now()-lastNotify<250)return; lastNotify=Date.now(); parentPort.postMessage({type:"update",payload:dashboard("lifetime")}); }
parentPort.on("message",({id,type,payload})=>{try { if(type==="dashboard") parentPort.postMessage({id,result:dashboard(payload?.period)}); else if(type==="health") parentPort.postMessage({id,result:Object.assign({codexHome:CODEX_HOME},health)}); } catch(error){parentPort.postMessage({id,error:String(error)});} });
(async()=>{await loadProjects(); const watcher=chokidar.watch([...ROOTS,GLOBAL_STATE],{ignoreInitial:true,depth:8}); watcher.on("add",scan).on("change",(file)=>file===GLOBAL_STATE?loadProjects().then(notify):scan(file)); backfill();})();
