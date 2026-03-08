import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { ExportManuscriptRequest, ExportManuscriptResult } from "../types/ipc";

const execFileAsync = promisify(execFile);

function getPreloadPath(): string {
  return join(__dirname, "preload.js");
}

function getIndexHtmlPath(): string {
  return join(app.getAppPath(), "dist", "index.html");
}

function getDevServerUrl(): string {
  return process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#111111",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    await window.loadFile(getIndexHtmlPath());
    return;
  }

  await window.loadURL(getDevServerUrl());
  window.webContents.openDevTools({ mode: "detach" });
}

function registerIpcHandlers(): void {
  ipcMain.handle("project:openFolder", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open Project Folder",
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    return fs.readFile(filePath, "utf-8");
  });

  ipcMain.handle("fs:writeFile", async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, "utf-8");
  });

  ipcMain.handle(
    "export:manuscript",
    async (_event, request: ExportManuscriptRequest): Promise<ExportManuscriptResult> => {
      try {
        await execFileAsync("pandoc", [...request.chapterPaths, "-o", request.outputPath]);
        return {
          ok: true,
          outputPath: request.outputPath
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pandoc execution failed.";
        return {
          ok: false,
          outputPath: request.outputPath,
          error: message
        };
      }
    }
  );
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
