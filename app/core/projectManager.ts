import { promises as fs } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { ProjectFile, WritingMode } from "../types";

const PROJECT_FILE_NAME = "project.json";
const CHAPTERS_DIR_NAME = "chapters";
const NOTES_DIR_NAME = "notes";
const DEFAULT_CHAPTER_FILE = "01.md";

export interface ProjectSummary {
  name: string;
  path: string;
  mode: WritingMode;
  chapters: string[];
  projectFilePath: string;
  chaptersDirectoryPath: string;
  notesDirectoryPath: string;
}

function getProjectFilePath(projectPath: string): string {
  return join(projectPath, PROJECT_FILE_NAME);
}

function getChaptersDirectoryPath(projectPath: string): string {
  return join(projectPath, CHAPTERS_DIR_NAME);
}

function getNotesDirectoryPath(projectPath: string): string {
  return join(projectPath, NOTES_DIR_NAME);
}

function sanitizeProjectName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ");
}

function parseProjectFile(rawJson: string, fallbackName: string): ProjectFile {
  const parsed = JSON.parse(rawJson) as Partial<ProjectFile> & { name?: unknown; mode?: unknown; chapterOrder?: unknown };

  const name = typeof parsed.name === "string" && parsed.name.trim().length > 0 ? parsed.name.trim() : fallbackName;
  const mode: WritingMode = parsed.mode === "screenplay" ? "screenplay" : "novel";
  const chapterOrder = Array.isArray(parsed.chapterOrder)
    ? parsed.chapterOrder.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

  return {
    name,
    mode,
    chapterOrder
  };
}

function sortChapterFiles(chapterFiles: string[], chapterOrder: string[]): string[] {
  const orderMap = new Map<string, number>();
  chapterOrder.forEach((chapter, index) => {
    orderMap.set(chapter, index);
  });

  return [...chapterFiles].sort((left, right) => {
    const leftOrder = orderMap.get(left);
    const rightOrder = orderMap.get(right);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) {
      return -1;
    }

    if (rightOrder !== undefined) {
      return 1;
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });
}

export async function readProjectFile(projectPath: string): Promise<ProjectFile> {
  const resolvedPath = resolve(projectPath);
  const filePath = getProjectFilePath(resolvedPath);
  const projectNameFallback = basename(resolvedPath);
  const content = await fs.readFile(filePath, "utf-8");
  return parseProjectFile(content, projectNameFallback);
}

export async function loadChapters(projectPath: string, chapterOrder: string[] = []): Promise<string[]> {
  const chaptersDirectoryPath = getChaptersDirectoryPath(resolve(projectPath));
  const entries = await fs.readdir(chaptersDirectoryPath, { withFileTypes: true });

  const chapterFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name);

  return sortChapterFiles(chapterFiles, chapterOrder);
}

export async function openProject(folderPath: string): Promise<ProjectSummary> {
  const resolvedProjectPath = resolve(folderPath);
  const projectFile = await readProjectFile(resolvedProjectPath);
  const chapters = await loadChapters(resolvedProjectPath, projectFile.chapterOrder);

  return {
    name: projectFile.name,
    path: resolvedProjectPath,
    mode: projectFile.mode,
    chapters,
    projectFilePath: getProjectFilePath(resolvedProjectPath),
    chaptersDirectoryPath: getChaptersDirectoryPath(resolvedProjectPath),
    notesDirectoryPath: getNotesDirectoryPath(resolvedProjectPath)
  };
}

export async function createProject(parentFolderPath: string, name: string): Promise<ProjectSummary> {
  const projectName = sanitizeProjectName(name);

  if (projectName.length === 0) {
    throw new Error("Project name cannot be empty.");
  }

  const resolvedParentPath = resolve(parentFolderPath);
  const projectPath = join(resolvedParentPath, projectName);
  const chaptersDirectoryPath = getChaptersDirectoryPath(projectPath);
  const notesDirectoryPath = getNotesDirectoryPath(projectPath);
  const projectFilePath = getProjectFilePath(projectPath);

  await fs.mkdir(projectPath, { recursive: false });
  await fs.mkdir(chaptersDirectoryPath, { recursive: true });
  await fs.mkdir(notesDirectoryPath, { recursive: true });

  const projectFile: ProjectFile = {
    name: projectName,
    mode: "novel",
    chapterOrder: [DEFAULT_CHAPTER_FILE]
  };

  await fs.writeFile(projectFilePath, `${JSON.stringify(projectFile, null, 2)}\n`, "utf-8");
  await fs.writeFile(join(chaptersDirectoryPath, DEFAULT_CHAPTER_FILE), "# Chapter 1\n\n", "utf-8");

  return openProject(projectPath);
}
