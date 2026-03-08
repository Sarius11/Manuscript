import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { createAutoSave, type AutoSaveController } from "../core/fileManager";
import { createProject, openProject } from "../core/projectManager";
import type {
  AutosaveRequest,
  DevelopmentProjectContext,
  ExportManuscriptRequest,
  ExportManuscriptResult
} from "../types/ipc";

const DEVELOPMENT_PROJECT_NAME = "CodexDevelopmentProject";
const execFileAsync = promisify(execFile);
const autosaveControllers = new Map<string, AutoSaveController>();

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function getPreloadPath(): string {
  return join(__dirname, "preload.js");
}

function getIndexHtmlPath(): string {
  return join(app.getAppPath(), "dist", "index.html");
}

function getDevServerUrl(): string {
  return process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
}

function getDevelopmentProjectsRootPath(): string {
  return join(app.getAppPath(), "projects");
}

async function ensureDevelopmentProjectContext(): Promise<DevelopmentProjectContext> {
  const projectsRootPath = getDevelopmentProjectsRootPath();
  const projectPath = join(projectsRootPath, DEVELOPMENT_PROJECT_NAME);
  await fs.mkdir(projectsRootPath, { recursive: true });

  try {
    const project = await openProject(projectPath);
    return {
      name: project.name,
      projectPath: project.path,
      chaptersDirectoryPath: project.chaptersDirectoryPath
    };
  } catch (error) {
    if (getErrorCode(error) !== "ENOENT") {
      throw error;
    }
  }

  try {
    const project = await createProject(projectsRootPath, DEVELOPMENT_PROJECT_NAME);
    return {
      name: project.name,
      projectPath: project.path,
      chaptersDirectoryPath: project.chaptersDirectoryPath
    };
  } catch (error) {
    if (getErrorCode(error) !== "EEXIST") {
      throw error;
    }
  }

  const project = await openProject(projectPath);
  return {
    name: project.name,
    projectPath: project.path,
    chaptersDirectoryPath: project.chaptersDirectoryPath
  };
}

function getAutosaveController(filePath: string, debounceMs?: number): AutoSaveController {
  const existing = autosaveControllers.get(filePath);
  if (existing) {
    return existing;
  }

  const controller = createAutoSave(filePath, {
    debounceMs,
    onError: (error) => {
      console.error("Autosave failed", { filePath, error });
    }
  });

  autosaveControllers.set(filePath, controller);
  return controller;
}

async function flushAllAutosaves(): Promise<void> {
  const entries = [...autosaveControllers.entries()];

  await Promise.all(
    entries.map(async ([, controller]) => {
      try {
        await controller.flush();
      } catch {
        // Errors are already reported through onError.
      } finally {
        controller.destroy();
      }
    })
  );

  autosaveControllers.clear();
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

  ipcMain.handle("project:getDevelopmentContext", async (): Promise<DevelopmentProjectContext> => {
    return ensureDevelopmentProjectContext();
  });

  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    return fs.readFile(filePath, "utf-8");
  });

  ipcMain.handle("fs:writeFile", async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, "utf-8");
  });

  ipcMain.handle("autosave:schedule", async (_event, request: AutosaveRequest) => {
    const controller = getAutosaveController(request.filePath, request.debounceMs);
    controller.schedule(request.content);
  });

  ipcMain.handle("autosave:flush", async (_event, filePath: string) => {
    const controller = autosaveControllers.get(filePath);
    if (!controller) {
      return;
    }

    await controller.flush();
  });

  ipcMain.handle("autosave:flushAll", async () => {
    await flushAllAutosaves();
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

app.on("before-quit", () => {
  void flushAllAutosaves();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
