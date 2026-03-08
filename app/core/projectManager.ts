export interface ProjectSummary {
  name: string;
  path: string;
  chapters: string[];
}

export async function openProject(_folderPath: string): Promise<ProjectSummary> {
  throw new Error("Not implemented in Step 1. Project manager is added in Step 4.");
}

export async function createProject(_folderPath: string, _name: string): Promise<ProjectSummary> {
  throw new Error("Not implemented in Step 1. Project manager is added in Step 4.");
}
