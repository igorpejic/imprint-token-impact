const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");
const { Worker } = require("node:worker_threads");

let mainWindow;
let tray;
let monitor;
let nextRequestId = 0;
const pending = new Map();

function askMonitor(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId;
    pending.set(id, { resolve, reject });
    monitor.postMessage({ id, type, payload });
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 980, minWidth: 1120, minHeight: 760,
    backgroundColor: "#081214", titleBarStyle: "hiddenInset",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  if (process.env.NODE_ENV === "development" || process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}
function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("  Imprint");
  tray.setToolTip("Imprint — Codex environmental usage");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "Open Imprint", click: () => mainWindow.show() }, { type: "separator" }, { label: "Quit", click: () => app.quit() }]));
  tray.on("click", () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
}
app.whenReady().then(() => {
  monitor = new Worker(path.join(__dirname, "monitor-worker.cjs"), { workerData: { dbPath: path.join(app.getPath("userData"), "imprint.sqlite") } });
  monitor.on("message", (message) => {
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id);
      message.error ? request.reject(new Error(message.error)) : request.resolve(message.result); return;
    }
    if (message.type === "update") {
      mainWindow?.webContents.send("imprint:update", message.payload);
      if (message.payload?.total?.carbonKg) tray?.setTitle("  " + message.payload.total.carbonKg.toFixed(1) + "g CO₂e");
    }
  });
  monitor.on("error", (error) => console.error("Usage monitor failed", error));
  ipcMain.handle("imprint:get-dashboard", (_event, filters) => askMonitor("dashboard", filters));
  ipcMain.handle("imprint:get-health", () => askMonitor("health"));
  createWindow(); createTray();
});
app.on("window-all-closed", (event) => event.preventDefault());
app.on("before-quit", () => monitor?.terminate());
