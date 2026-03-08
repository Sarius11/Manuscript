import { useState } from "react";
import type { Chapter } from "../../types";

export interface ChapterSidebarProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onReorderChapters: (chapterIds: string[]) => void;
}

function reorderChapterIds(chapterIds: string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) {
    return chapterIds;
  }

  const sourceIndex = chapterIds.indexOf(sourceId);
  const targetIndex = chapterIds.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return chapterIds;
  }

  const next = [...chapterIds];
  const [moved] = next.splice(sourceIndex, 1);

  if (!moved) {
    return chapterIds;
  }

  next.splice(targetIndex, 0, moved);
  return next;
}

export function ChapterSidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  onAddChapter,
  onReorderChapters
}: ChapterSidebarProps): JSX.Element {
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);

  const chapterIds = chapters.map((chapter) => chapter.id);

  return (
    <aside className="panel panel-sidebar">
      <h2 className="panel-title">Chapters</h2>
      <div className="chapter-list">
        {chapters.map((chapter) => {
          const isSelected = chapter.id === selectedChapterId;
          const isDragging = chapter.id === dragSourceId;
          const isDropTarget = chapter.id === dragTargetId && dragSourceId !== dragTargetId;

          return (
            <button
              key={chapter.id}
              type="button"
              className={`chapter-item${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}`}
              draggable
              onClick={() => {
                onSelectChapter(chapter.id);
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", chapter.id);
                setDragSourceId(chapter.id);
                setDragTargetId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dragTargetId !== chapter.id) {
                  setDragTargetId(chapter.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain") || dragSourceId;

                if (!sourceId) {
                  setDragSourceId(null);
                  setDragTargetId(null);
                  return;
                }

                const reorderedIds = reorderChapterIds(chapterIds, sourceId, chapter.id);
                if (reorderedIds.join("|") !== chapterIds.join("|")) {
                  onReorderChapters(reorderedIds);
                }

                setDragSourceId(null);
                setDragTargetId(null);
              }}
              onDragEnd={() => {
                setDragSourceId(null);
                setDragTargetId(null);
              }}
            >
              {chapter.title}
            </button>
          );
        })}
      </div>
      <button className="btn" type="button" onClick={onAddChapter}>
        Add Chapter
      </button>
    </aside>
  );
}
