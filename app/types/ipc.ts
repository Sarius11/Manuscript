export interface ExportManuscriptRequest {
  chapterPaths: string[];
  outputPath: string;
}

export interface ExportManuscriptResult {
  ok: boolean;
  outputPath: string;
  error?: string;
}

export interface CodexDesktopApi {
  openProjectFolder: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  exportManuscript: (request: ExportManuscriptRequest) => Promise<ExportManuscriptResult>;
}
