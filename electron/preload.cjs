const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("roundtableDesktop", {
  callModel: (input) => ipcRenderer.invoke("model:call", input),
  cancelModelCall: (requestId) => ipcRenderer.invoke("model:cancel", requestId),
  detectLocalAgents: (requests) => ipcRenderer.invoke("local-agents:detect", requests),
  listLocalAgentModels: (requests) => ipcRenderer.invoke("local-agents:models", requests),
  selectKnowledgeBaseVault: () => ipcRenderer.invoke("knowledge:select-vault"),
  searchKnowledgeBase: (request) => ipcRenderer.invoke("knowledge:search", request)
});
