import { contextBridge, ipcRenderer } from "electron";
import type {
  AutosaveRequest,
  CodexDesktopApi,
  ExportManuscriptRequest,
  ExportManuscriptResult
} from "../types/ipc";

const api: CodexDesktopApi = {
  openProjectFolder: () => ipcRenderer.invoke("project:openFolder"),
  getDevelopmentProjectContext: () => ipcRenderer.invoke("project:getDevelopmentContext"),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("fs:writeFile", filePath, content),
  loadBoard: (projectPath: string) => ipcRenderer.invoke("board:load", projectPath),
  saveBoard: (projectPath: string, content: string) => ipcRenderer.invoke("board:save", projectPath, content),
  scheduleAutosave: (request: AutosaveRequest) => ipcRenderer.invoke("autosave:schedule", request),
  flushAutosave: (filePath: string) => ipcRenderer.invoke("autosave:flush", filePath),
  flushAllAutosaves: () => ipcRenderer.invoke("autosave:flushAll"),
  exportManuscript: (request: ExportManuscriptRequest): Promise<ExportManuscriptResult> =>
    ipcRenderer.invoke("export:manuscript", request)
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("codex", api);
} else {
  (globalThis as unknown as { codex: CodexDesktopApi }).codex = api;
}
