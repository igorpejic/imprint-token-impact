const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("imprint", {
  getDashboard: (filters) => ipcRenderer.invoke("imprint:get-dashboard", filters),
  getHealth: () => ipcRenderer.invoke("imprint:get-health"),
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("imprint:update", listener);
    return () => ipcRenderer.removeListener("imprint:update", listener);
  },
});
