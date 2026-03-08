import { contextBridge, ipcRenderer } from "electron";
import type { CodexDesktopApi, ExportManuscriptRequest, ExportManuscriptResult } from "../types/ipc";

const api: CodexDesktopApi = {
  openProjectFolder: () => ipcRenderer.invoke("project:openFolder"),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("fs:writeFile", filePath, content),
  exportManuscript: (request: ExportManuscriptRequest): Promise<ExportManuscriptResult> =>
    ipcRenderer.invoke("export:manuscript", request)
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("codex", api);
} else {
  (globalThis as unknown as { codex: CodexDesktopApi }).codex = api;
}
