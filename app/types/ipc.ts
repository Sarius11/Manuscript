export interface ExportManuscriptRequest {
  chapterPaths: string[];
  outputPath: string;
}

export interface ExportManuscriptResult {
  ok: boolean;
  outputPath: string;
  error?: string;
}

export interface AutosaveRequest {
  filePath: string;
  content: string;
  debounceMs?: number;
}

export interface DevelopmentProjectContext {
  name: string;
  projectPath: string;
  chaptersDirectoryPath: string;
}

export interface CodexDesktopApi {
  openProjectFolder: () => Promise<string | null>;
  getDevelopmentProjectContext: () => Promise<DevelopmentProjectContext>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  scheduleAutosave: (request: AutosaveRequest) => Promise<void>;
  flushAutosave: (filePath: string) => Promise<void>;
  flushAllAutosaves: () => Promise<void>;
  exportManuscript: (request: ExportManuscriptRequest) => Promise<ExportManuscriptResult>;
}
