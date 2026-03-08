export interface ExportResult {
  outputPath: string;
  ok: boolean;
}

export async function exportManuscript(_projectPath: string): Promise<ExportResult> {
  throw new Error("Not implemented in Step 1. Export engine is added in Step 9.");
}
