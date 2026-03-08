import { useMemo, useState } from "react";
import { ChapterSidebar } from "../components/ChapterSidebar";
import { LexicalEditor } from "../editor/LexicalEditor";
import type { Chapter } from "../../types";

const initialChapters: Chapter[] = [
  { id: "chapter-01", title: "01 - Cold Open", fileName: "01.md" },
  { id: "chapter-02", title: "02 - The Warning", fileName: "02.md" },
  { id: "chapter-03", title: "03 - Night Train", fileName: "03.md" }
];

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

function MetadataPane({ chapterFileName }: { chapterFileName: string | null }): JSX.Element {
  return (
    <aside className="panel panel-meta">
      <h2 className="panel-title">Metadata</h2>
      <p className="meta-copy">
        Selected chapter file: <strong>{chapterFileName ?? "N/A"}</strong>
      </p>
    </aside>
  );
}

export function AppShell(): JSX.Element {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapters[0]?.id ?? null);
  const [chapterMarkdown, setChapterMarkdown] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialChapters.map((chapter) => [chapter.id, `# ${chapter.title}\n\n`]))
  );

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId]
  );

  const handleAddChapter = (): void => {
    const chapterNumber = String(chapters.length + 1).padStart(2, "0");
    const fileName = `${chapterNumber}.md`;
    const nextChapter: Chapter = {
      id: `chapter-${Date.now()}-${chapterNumber}`,
      title: `${chapterNumber} - Untitled`,
      fileName
    };

    setChapters((previous) => [...previous, nextChapter]);
    setChapterMarkdown((previous) => ({
      ...previous,
      [nextChapter.id]: `# ${nextChapter.title}\n\n`
    }));
    setSelectedChapterId(nextChapter.id);
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
          markdown={selectedChapter ? chapterMarkdown[selectedChapter.id] ?? "" : ""}
          onChange={handleEditorChange}
        />
        <MetadataPane chapterFileName={selectedChapter?.fileName ?? null} />
      </div>
    </main>
  );
}
