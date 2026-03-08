export type WritingMode = "novel" | "screenplay";

export interface Chapter {
  id: string;
  title: string;
  fileName: string;
}

export interface ProjectFile {
  name: string;
  mode: WritingMode;
  chapterOrder: string[];
}
