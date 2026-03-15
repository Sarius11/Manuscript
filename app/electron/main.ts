import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from "electron";
import { createAutoSave, type AutoSaveController } from "../core/fileManager";
import { ensureProject } from "../core/projectManager";
import type {
  AutosaveRequest,
  DevelopmentProjectContext,
  ExportManuscriptRequest,
  ExportManuscriptResult
} from "../types/ipc";

const DEVELOPMENT_PROJECT_NAME = "AtramentumDevelopmentProject";
const BOARD_FILE_NAME = "board.json";
const execFileAsync = promisify(execFile);
const autosaveControllers = new Map<string, AutoSaveController>();

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
  if (app.isPackaged) {
    return join(app.getPath("userData"), "projects");
  }

  return join(__dirname, "..", "..", "projects");
}

function getBoardFilePath(projectPath: string): string {
  return join(projectPath, BOARD_FILE_NAME);
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function ensureDevelopmentProjectContext(): Promise<DevelopmentProjectContext> {
  const projectsRootPath = getDevelopmentProjectsRootPath();
  const projectPath = join(projectsRootPath, DEVELOPMENT_PROJECT_NAME);
  await fs.mkdir(projectsRootPath, { recursive: true });
  const project = await ensureProject(projectPath, DEVELOPMENT_PROJECT_NAME);

  return {
    name: project.name,
    projectPath: project.path,
    chaptersDirectoryPath: project.chaptersDirectoryPath,
    chapters: project.chapters
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
    title: "Manuscript",
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

function toggleFocusedWindowFullscreen(): void {
  const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!focusedWindow) {
    return;
  }

  focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
}

function registerApplicationMenu(): void {
  const windowMenu: MenuItemConstructorOptions = {
    label: "Window",
    submenu: [
      {
        label: "Fullscreen",
        accelerator: "F11",
        click: () => {
          toggleFocusedWindowFullscreen();
        }
      },
      { type: "separator" },
      { role: "minimize" },
      { role: "zoom" },
      { role: "close" }
    ]
  };

  const menuTemplate: MenuItemConstructorOptions[] =
    process.platform === "darwin"
      ? [
          { role: "appMenu" },
          { role: "fileMenu" },
          { role: "editMenu" },
          { role: "viewMenu" },
          windowMenu,
          { role: "help" }
        ]
      : [
          { role: "fileMenu" },
          { role: "editMenu" },
          { role: "viewMenu" },
          windowMenu,
          { role: "help" }
        ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
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

  ipcMain.handle("board:load", async (_event, projectPath: string) => {
    const boardFilePath = getBoardFilePath(projectPath);

    try {
      return await fs.readFile(boardFilePath, "utf-8");
    } catch (error) {
      if (getErrorCode(error) === "ENOENT") {
        return null;
      }

      throw error;
    }
  });

  ipcMain.handle("board:save", async (_event, projectPath: string, content: string) => {
    const boardFilePath = getBoardFilePath(projectPath);
    await fs.writeFile(boardFilePath, content, "utf-8");
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
  app.setName("Manuscript");
  registerApplicationMenu();
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

