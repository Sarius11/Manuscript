import { useEffect, useMemo, useRef, useState } from "react";
import { ChapterSidebar } from "../components/ChapterSidebar";
import { LexicalEditor } from "../editor/LexicalEditor";
import type { Chapter, DevelopmentProjectContext } from "../../types";

const AUTOSAVE_DEBOUNCE_MS = 500;

const initialChapters: Chapter[] = [
  { id: "chapter-01", title: "01 - Cold Open", fileName: "01.md" },
  { id: "chapter-02", title: "02 - The Warning", fileName: "02.md" },
  { id: "chapter-03", title: "03 - Night Train", fileName: "03.md" }
];

function getDefaultChapterMarkdown(title: string): string {
  return `# ${title}\n\n`;
}

function buildChapterFilePath(context: DevelopmentProjectContext, chapter: Chapter): string {
  const separator = context.chaptersDirectoryPath.includes("\\") ? "\\" : "/";

  if (
    context.chaptersDirectoryPath.endsWith("\\") ||
    context.chaptersDirectoryPath.endsWith("/")
  ) {
    return `${context.chaptersDirectoryPath}${chapter.fileName}`;
  }

  return `${context.chaptersDirectoryPath}${separator}${chapter.fileName}`;
}

function Toolbar(): JSX.Element {
  return (
    <header className="toolbar">
      <h1 className="toolbar-title">Codex</h1>
      <div className="toolbar-actions">
        <button className="btn btn-primary" type="button">
          New Project
        </button>
        <button className="btn" type="button">
          Open Project
        </button>
      </div>
    </header>
  );
}

function EditorPane({
  selectedChapter,
  markdown,
  onChange
}: {
  selectedChapter: Chapter | null;
  markdown: string;
  onChange: (markdown: string) => void;
}): JSX.Element {
  return (
    <section className="editor-wrap">
      <article className="editor-pane">
        <h3 className="editor-heading">{selectedChapter?.title ?? "No chapter selected"}</h3>
        {selectedChapter ? (
          <LexicalEditor key={selectedChapter.id} initialMarkdown={markdown} onChange={onChange} />
        ) : (
          <p className="meta-copy">Choose a chapter from the sidebar to start writing.</p>
        )}
      </article>
    </section>
  );
}

function MetadataPane({
  chapterFileName,
  projectName
}: {
  chapterFileName: string | null;
  projectName: string | null;
}): JSX.Element {
  return (
    <aside className="panel panel-meta">
      <h2 className="panel-title">Metadata</h2>
      <p className="meta-copy">
        Active project: <strong>{projectName ?? "Loading..."}</strong>
      </p>
      <p className="meta-copy">
        Selected chapter file: <strong>{chapterFileName ?? "N/A"}</strong>
      </p>
    </aside>
  );
}

export function AppShell(): JSX.Element {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapters[0]?.id ?? null);
  const [chapterMarkdown, setChapterMarkdown] = useState<Record<string, string>>({});
  const [projectContext, setProjectContext] = useState<DevelopmentProjectContext | null>(null);
  const lastSelectedChapterIdRef = useRef<string | null>(selectedChapterId);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId]
  );

  useEffect(() => {
    let active = true;

    const loadProjectContext = async (): Promise<void> => {
      try {
        const context = await window.codex.getDevelopmentProjectContext();
        if (!active) {
          return;
        }
        setProjectContext(context);
      } catch (error) {
        console.error("Failed to load development project context.", error);
      }
    };

    void loadProjectContext();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!projectContext) {
      return;
    }

    let active = true;

    const loadInitialChapterMarkdown = async (): Promise<void> => {
      const loadedEntries = await Promise.all(
        chapters.map(async (chapter) => {
          const filePath = buildChapterFilePath(projectContext, chapter);

          try {
            const content = await window.codex.readFile(filePath);
            return [chapter.id, content] as const;
          } catch {
            const fallback = getDefaultChapterMarkdown(chapter.title);
            await window.codex.scheduleAutosave({
              filePath,
              content: fallback,
              debounceMs: AUTOSAVE_DEBOUNCE_MS
            });
            return [chapter.id, fallback] as const;
          }
        })
      );

      if (!active) {
        return;
      }

      setChapterMarkdown((previous) => {
        const next = { ...previous };

        for (const [chapterId, content] of loadedEntries) {
          if (next[chapterId] === undefined) {
            next[chapterId] = content;
          }
        }

        return next;
      });
    };

    void loadInitialChapterMarkdown();

    return () => {
      active = false;
    };
  }, [chapters, projectContext]);

  useEffect(() => {
    const previousChapterId = lastSelectedChapterIdRef.current;

    if (
      previousChapterId &&
      previousChapterId !== selectedChapterId &&
      projectContext
    ) {
      const previousChapter = chapters.find((chapter) => chapter.id === previousChapterId);
      if (previousChapter) {
        const filePath = buildChapterFilePath(projectContext, previousChapter);
        void window.codex.flushAutosave(filePath);
      }
    }

    lastSelectedChapterIdRef.current = selectedChapterId;
  }, [chapters, projectContext, selectedChapterId]);

  useEffect(() => {
    return () => {
      void window.codex.flushAllAutosaves();
    };
  }, []);

  const handleAddChapter = (): void => {
    const chapterNumber = String(chapters.length + 1).padStart(2, "0");
    const fileName = `${chapterNumber}.md`;
    const nextChapter: Chapter = {
      id: `chapter-${Date.now()}-${chapterNumber}`,
      title: `${chapterNumber} - Untitled`,
      fileName
    };
    const initialMarkdown = getDefaultChapterMarkdown(nextChapter.title);

    setChapters((previous) => [...previous, nextChapter]);
    setChapterMarkdown((previous) => ({
      ...previous,
      [nextChapter.id]: initialMarkdown
    }));
    setSelectedChapterId(nextChapter.id);

    if (projectContext) {
      const filePath = buildChapterFilePath(projectContext, nextChapter);
      void window.codex.scheduleAutosave({
        filePath,
        content: initialMarkdown,
        debounceMs: AUTOSAVE_DEBOUNCE_MS
      });
    }
  };

  const handleReorderChapters = (orderedIds: string[]): void => {
    setChapters((previous) => {
      const chapterById = new Map(previous.map((chapter) => [chapter.id, chapter] as const));
      const reordered = orderedIds
        .map((id) => chapterById.get(id))
        .filter((chapter): chapter is Chapter => chapter !== undefined);

      return reordered.length === previous.length ? reordered : previous;
    });
  };

  const handleEditorChange = (markdown: string): void => {
    if (!selectedChapterId) {
      return;
    }

    setChapterMarkdown((previous) =>
      previous[selectedChapterId] === markdown ? previous : { ...previous, [selectedChapterId]: markdown }
    );

    if (!selectedChapter || !projectContext) {
      return;
    }

    const filePath = buildChapterFilePath(projectContext, selectedChapter);
    void window.codex.scheduleAutosave({
      filePath,
      content: markdown,
      debounceMs: AUTOSAVE_DEBOUNCE_MS
    });
  };

  return (
    <main className="app-shell">
      <Toolbar />
      <div className="shell-main">
        <ChapterSidebar
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          onSelectChapter={setSelectedChapterId}
          onAddChapter={handleAddChapter}
          onReorderChapters={handleReorderChapters}
        />
        <EditorPane
          selectedChapter={selectedChapter}
          markdown={
            selectedChapter
              ? chapterMarkdown[selectedChapter.id] ?? getDefaultChapterMarkdown(selectedChapter.title)
              : ""
          }
          onChange={handleEditorChange}
        />
        <MetadataPane
          chapterFileName={selectedChapter?.fileName ?? null}
          projectName={projectContext?.name ?? null}
        />
      </div>
    </main>
  );
}
