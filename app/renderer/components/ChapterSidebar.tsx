import { useMemo, useState, type CSSProperties } from "react";
import { Text, XStack, YStack } from "tamagui";
import type { Chapter } from "../../types";
import { AppButton, SectionLabel } from "./uiPrimitives";

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

  const chapterIds = useMemo(() => chapters.map((chapter) => chapter.id), [chapters]);

  const baseButtonStyle = useMemo<CSSProperties>(
    () => ({
      width: "100%",
      border: "1px solid #3A3A3A",
      borderRadius: 6,
      background: "transparent",
      color: "#E0E0E0",
      textAlign: "left",
      padding: "10px 12px",
      fontFamily: "\"Avenir Next\", \"Segoe UI\", \"Helvetica Neue\", sans-serif",
      fontSize: "14px",
      cursor: "pointer",
      transition: "all 140ms ease"
    }),
    []
  );

  return (
    <YStack
      paddingHorizontal={16}
      paddingVertical={16}
      borderBottomWidth={1}
      borderBottomColor="$panelLine"
      gap="$3"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <SectionLabel>Chapters</SectionLabel>
        <Text fontFamily="$body" fontSize="$1" color="$textMuted">
          {chapters.length}
        </Text>
      </XStack>
      <YStack gap="$2" maxHeight={260} overflow="scroll">
        {chapters.map((chapter) => {
          const isSelected = chapter.id === selectedChapterId;
          const isDragging = chapter.id === dragSourceId;
          const isDropTarget = chapter.id === dragTargetId && dragSourceId !== dragTargetId;
          const chapterIndex = chapterIds.indexOf(chapter.id) + 1;

          return (
            <button
              key={chapter.id}
              type="button"
              draggable
              style={{
                ...baseButtonStyle,
                borderColor: isSelected ? "#D4C3A9" : "#3A3A3A",
                background: isSelected ? "#2C2C2C" : "transparent",
                opacity: isDragging ? 0.65 : 1,
                outline: isDropTarget ? "1px dashed #D4C3A9" : "none",
                outlineOffset: 1
              }}
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
              {chapterIndex}. {chapter.title}
            </button>
          );
        })}
      </YStack>
      <AppButton tone="dashed" onPress={onAddChapter}>
        + New Chapter
      </AppButton>
    </YStack>
  );
}
