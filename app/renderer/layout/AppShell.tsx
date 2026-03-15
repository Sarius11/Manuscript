import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, XStack, YStack } from "tamagui";
import type { Chapter, CodexDesktopApi, DevelopmentProjectContext } from "../../types";
import { ChapterSidebar } from "../components/ChapterSidebar";
import {
  AppButton,
  AppShellFrame,
  CenterPaneFrame,
  LeftSidebarFrame,
  RightSidebarFrame,
  SectionLabel,
  StatusBarFrame,
  ToolbarBrand,
  ToolbarDivider,
  ToolbarSubtle,
  TopToolbarFrame,
  WorkspaceFrame
} from "../components/uiPrimitives";
import { LexicalEditor } from "../editor/LexicalEditor";
import { StoryBoard } from "../modules/storyboard/StoryBoard";

const PROJECT_FILE_NAME = "project.json";
const STORY_BIBLE_FILE_NAME = "story-bible.json";
const DEFAULT_CHAPTER_GOAL = 2500;
const DEFAULT_DAILY_GOAL = 2000;

interface WritingGoals {
  chapterGoal: number;
  dailyGoal: number;
}

interface GoalDraft {
  chapterGoal: string;
  dailyGoal: string;
}

interface StoryType {
  id: string;
  name: string;
}

interface StoryEntry {
  id: string;
  typeId: string;
  title: string;
  fileName: string;
}

interface StoryBibleData {
  types: StoryType[];
  entries: StoryEntry[];
}

interface ChapterTab {
  id: string;
  kind: "chapter";
  chapterId: string;
  fileName: string;
  title: string;
}

interface StoryTab {
  id: string;
  kind: "story";
  entryId: string;
  title: string;
}

interface BoardTab {
  id: "storyboard";
  kind: "board";
  title: string;
}

type EditorTab = ChapterTab | StoryTab | BoardTab;
type TopChromeMode = "open" | "hover" | "collapsed" | "tabs";

const TOP_CHROME_MODE_ORDER: readonly TopChromeMode[] = ["open", "hover", "collapsed", "tabs"] as const;
const TOP_CHROME_MODE_LABEL: Readonly<Record<TopChromeMode, string>> = {
  open: "Open",
  hover: "Auto",
  collapsed: "Click",
  tabs: "Pages"
};
const AUTO_TOP_CHROME_SHOW_THRESHOLD_PX = 96;
const AUTO_TOP_CHROME_HIDE_THRESHOLD_PX = 176;
const AUTO_TOP_CHROME_HIDE_DELAY_MS = 520;

const DEFAULT_STORY_TYPES: ReadonlyArray<StoryType> = [
  { id: "characters", name: "Characters" },
  { id: "plots", name: "Plot Outlines" },
  { id: "world", name: "World Building" },
  { id: "facts", name: "Facts" }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("ENOENT");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createDefaultStoryBible(): StoryBibleData {
  return {
    types: DEFAULT_STORY_TYPES.map((type) => ({ ...type })),
    entries: []
  };
}

function joinPath(basePath: string, ...segments: string[]): string {
  const separator = basePath.includes("\\") ? "\\" : "/";
  const normalizedBase = basePath.replace(/[\\/]+$/, "");
  const normalizedSegments = segments
    .map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ""))
    .filter((segment) => segment.length > 0);

  return [normalizedBase, ...normalizedSegments].join(separator);
}

function sortFilesLexically(fileNames: string[]): string[] {
  return [...fileNames].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

function extractHeadingTitle(markdown: string): string | null {
  const headingMatch = markdown.match(/^\s*#\s+(.+?)\s*$/m);
  if (!headingMatch || !headingMatch[1]) {
    return null;
  }

  const title = headingMatch[1].trim();
  return title.length > 0 ? title : null;
}

function countWords(markdown: string): number {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length === 0) {
    return 0;
  }

  return plainText.split(" ").length;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function sanitizeFilePart(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "entry";
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getChapterOrder(projectObject: Record<string, unknown>, chaptersFromContext: string[] | undefined): string[] {
  const availableChapters = Array.isArray(chaptersFromContext)
    ? chaptersFromContext.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const orderCandidate = projectObject.chapterOrder;
  const configuredOrder = Array.isArray(orderCandidate)
    ? orderCandidate.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

  if (availableChapters.length === 0) {
    if (configuredOrder.length > 0) {
      return configuredOrder;
    }

    return ["01.md"];
  }

  const available = new Set(availableChapters);
  const ordered = configuredOrder.filter((item) => available.has(item));
  const missing = availableChapters.filter((item) => !ordered.includes(item));

  return [...ordered, ...sortFilesLexically(missing)];
}

function parseGoals(projectObject: Record<string, unknown>): WritingGoals {
  const goalsCandidate = projectObject.goals;
  if (!isRecord(goalsCandidate)) {
    return {
      chapterGoal: DEFAULT_CHAPTER_GOAL,
      dailyGoal: DEFAULT_DAILY_GOAL
    };
  }

  const chapterGoal =
    typeof goalsCandidate.chapterGoal === "number" && goalsCandidate.chapterGoal > 0
      ? goalsCandidate.chapterGoal
      : DEFAULT_CHAPTER_GOAL;
  const dailyGoal =
    typeof goalsCandidate.dailyGoal === "number" && goalsCandidate.dailyGoal > 0
      ? goalsCandidate.dailyGoal
      : DEFAULT_DAILY_GOAL;

  return { chapterGoal, dailyGoal };
}

function parseStoryBible(rawContent: string | null): StoryBibleData {
  if (!rawContent) {
    return createDefaultStoryBible();
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (!isRecord(parsed)) {
      return createDefaultStoryBible();
    }

    const types = Array.isArray(parsed.types)
      ? parsed.types
          .map((type): StoryType | null => {
            if (!isRecord(type) || typeof type.id !== "string" || typeof type.name !== "string") {
              return null;
            }

            const name = type.name.trim();
            const id = type.id.trim();
            if (name.length === 0 || id.length === 0) {
              return null;
            }

            return { id, name };
          })
          .filter((type): type is StoryType => type !== null)
      : [];

    const normalizedTypes = types.length > 0 ? types : createDefaultStoryBible().types;
    const typeIds = new Set(normalizedTypes.map((type) => type.id));
    const fallbackTypeId = normalizedTypes[0]?.id ?? "characters";

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .map((entry): StoryEntry | null => {
            if (
              !isRecord(entry) ||
              typeof entry.id !== "string" ||
              typeof entry.typeId !== "string" ||
              typeof entry.title !== "string" ||
              typeof entry.fileName !== "string"
            ) {
              return null;
            }

            const id = entry.id.trim();
            const typeId = typeIds.has(entry.typeId) ? entry.typeId : fallbackTypeId;
            const title = entry.title.trim();
            const fileName = entry.fileName.trim();

            if (id.length === 0 || title.length === 0 || fileName.length === 0) {
              return null;
            }

            return {
              id,
              typeId,
              title,
              fileName
            };
          })
          .filter((entry): entry is StoryEntry => entry !== null)
      : [];

    return {
      types: normalizedTypes,
      entries
    };
  } catch {
    return createDefaultStoryBible();
  }
}

async function readJsonObject(api: CodexDesktopApi, filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await api.readFile(filePath);
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    throw error;
  }
}

async function readFileOrEmpty(api: CodexDesktopApi, filePath: string): Promise<string> {
  try {
    return await api.readFile(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return "";
    }

    throw error;
  }
}

function createChapterTab(chapter: Chapter, chapterIndex: number): ChapterTab {
  return {
    id: `chapter:${chapter.id}`,
    kind: "chapter",
    chapterId: chapter.id,
    fileName: chapter.fileName,
    title: `${chapterIndex + 1}. ${chapter.title}`
  };
}

function createStoryTab(entry: StoryEntry): StoryTab {
  return {
    id: `story:${entry.id}`,
    kind: "story",
    entryId: entry.id,
    title: entry.title
  };
}

function createBoardTab(): BoardTab {
  return {
    id: "storyboard",
    kind: "board",
    title: "Red String Board"
  };
}

function getNextTopChromeMode(currentMode: TopChromeMode): TopChromeMode {
  const currentIndex = TOP_CHROME_MODE_ORDER.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % TOP_CHROME_MODE_ORDER.length;
  return TOP_CHROME_MODE_ORDER[nextIndex] ?? "open";
}

export function AppShell(): JSX.Element {
  const desktopApi = typeof window !== "undefined" ? window.codex : undefined;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<DevelopmentProjectContext | null>(null);
  const [projectName, setProjectName] = useState<string>("Loading project...");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chapterContents, setChapterContents] = useState<Record<string, string>>({});
  const [storyBible, setStoryBible] = useState<StoryBibleData>(createDefaultStoryBible());
  const [storyContents, setStoryContents] = useState<Record<string, string>>({});
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showNewEntryMenu, setShowNewEntryMenu] = useState<boolean>(false);
  const [newEntryTitle, setNewEntryTitle] = useState<string>("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("characters");
  const [newTypeName, setNewTypeName] = useState<string>("");
  const [typeNameDrafts, setTypeNameDrafts] = useState<Record<string, string>>({});
  const [showRenameCategories, setShowRenameCategories] = useState<boolean>(false);
  const [showGoalSettings, setShowGoalSettings] = useState<boolean>(false);
  const [statsExpanded, setStatsExpanded] = useState<boolean>(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState<boolean>(false);
  const [topChromeMode, setTopChromeMode] = useState<TopChromeMode>("open");
  const [isTopChromeNearEdge, setIsTopChromeNearEdge] = useState<boolean>(false);
  const [isTopChromeInteracting, setIsTopChromeInteracting] = useState<boolean>(false);
  const [isTopChromeClickOpen, setIsTopChromeClickOpen] = useState<boolean>(false);
  const topChromeAutoHideTimerRef = useRef<number | null>(null);
  const topChromePointerYRef = useRef<number>(Number.POSITIVE_INFINITY);
  const [goals, setGoals] = useState<WritingGoals>({
    chapterGoal: DEFAULT_CHAPTER_GOAL,
    dailyGoal: DEFAULT_DAILY_GOAL
  });
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    chapterGoal: String(DEFAULT_CHAPTER_GOAL),
    dailyGoal: String(DEFAULT_DAILY_GOAL)
  });
  const chapterBaselineWordsRef = useRef<Record<string, number>>({});

  const projectPaths = useMemo(() => {
    if (!projectContext) {
      return null;
    }

    return {
      projectFilePath: joinPath(projectContext.projectPath, PROJECT_FILE_NAME),
      storyBiblePath: joinPath(projectContext.projectPath, "notes", STORY_BIBLE_FILE_NAME)
    };
  }, [projectContext]);

  useEffect(() => {
    let isCancelled = false;

    const load = async (): Promise<void> => {
      if (!desktopApi) {
        setLoadError("Desktop IPC bridge unavailable. Start with `pnpm dev` to run Electron.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const context = await desktopApi.getDevelopmentProjectContext();
        if (isCancelled) {
          return;
        }

        setProjectContext(context);
        setProjectName(context.name);

        const projectFilePath = joinPath(context.projectPath, PROJECT_FILE_NAME);
        const projectObject = await readJsonObject(desktopApi, projectFilePath);
        const nextGoals = parseGoals(projectObject);
        setGoals(nextGoals);
        setGoalDraft({
          chapterGoal: String(nextGoals.chapterGoal),
          dailyGoal: String(nextGoals.dailyGoal)
        });

        const runtimeChaptersValue = (context as unknown as { chapters?: unknown }).chapters;
        const runtimeChapterList = Array.isArray(runtimeChaptersValue)
          ? runtimeChaptersValue.filter((item): item is string => typeof item === "string")
          : undefined;
        const chapterOrder = getChapterOrder(projectObject, runtimeChapterList);
        const loadedChapters = await Promise.all(
          chapterOrder.map(async (fileName) => {
            const chapterPath = joinPath(context.chaptersDirectoryPath, fileName);
            const content = await readFileOrEmpty(desktopApi, chapterPath);
            const title = extractHeadingTitle(content) ?? "Untitled";

            return {
              chapter: {
                id: fileName,
                fileName,
                title
              } satisfies Chapter,
              content
            };
          })
        );

        if (isCancelled) {
          return;
        }

        const nextChapters = loadedChapters.map((item) => item.chapter);
        const nextChapterContents: Record<string, string> = {};
        const baselineWords: Record<string, number> = {};
        loadedChapters.forEach((item) => {
          nextChapterContents[item.chapter.fileName] = item.content;
          baselineWords[item.chapter.fileName] = countWords(item.content);
        });

        chapterBaselineWordsRef.current = baselineWords;
        setChapters(nextChapters);
        setChapterContents(nextChapterContents);

        const firstChapter = nextChapters[0];
        if (firstChapter) {
          setSelectedChapterId(firstChapter.id);
          const firstTab = createChapterTab(firstChapter, 0);
          setOpenTabs([firstTab]);
          setActiveTabId(firstTab.id);
        } else {
          setSelectedChapterId(null);
          setOpenTabs([]);
          setActiveTabId(null);
        }

        const storyBiblePath = joinPath(context.projectPath, "notes", STORY_BIBLE_FILE_NAME);
        const storyBibleRaw = await readFileOrEmpty(desktopApi, storyBiblePath);
        const parsedStoryBible = parseStoryBible(storyBibleRaw.length > 0 ? storyBibleRaw : null);
        setStoryBible(parsedStoryBible);
        setTypeNameDrafts(
          Object.fromEntries(parsedStoryBible.types.map((type) => [type.id, type.name])) as Record<string, string>
        );
        setSelectedTypeId(parsedStoryBible.types[0]?.id ?? "characters");

        const loadedEntries = await Promise.all(
          parsedStoryBible.entries.map(async (entry) => {
            const filePath = joinPath(context.projectPath, "notes", entry.fileName);
            const content = await readFileOrEmpty(desktopApi, filePath);
            return [entry.id, content] as const;
          })
        );

        if (isCancelled) {
          return;
        }

        const nextStoryContents: Record<string, string> = {};
        loadedEntries.forEach(([entryId, content]) => {
          nextStoryContents[entryId] = content;
        });
        setStoryContents(nextStoryContents);
      } catch (error) {
        if (!isCancelled) {
          setLoadError(`Failed to load project context. ${getErrorMessage(error)}`);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
      if (desktopApi) {
        void desktopApi.flushAllAutosaves();
      }
    };
  }, [desktopApi]);

  const chapterById = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const chapterIndexById = useMemo(() => new Map(chapters.map((chapter, index) => [chapter.id, index])), [chapters]);
  const storyEntryById = useMemo(() => new Map(storyBible.entries.map((entry) => [entry.id, entry])), [storyBible.entries]);
  const storyTypeById = useMemo(() => new Map(storyBible.types.map((type) => [type.id, type])), [storyBible.types]);

  const entriesByType = useMemo(() => {
    const grouped = new Map<string, StoryEntry[]>();

    storyBible.types.forEach((type) => {
      grouped.set(type.id, []);
    });

    storyBible.entries.forEach((entry) => {
      const current = grouped.get(entry.typeId) ?? [];
      current.push(entry);
      grouped.set(entry.typeId, current);
    });

    return grouped;
  }, [storyBible.entries, storyBible.types]);

  const activeTab = useMemo(() => openTabs.find((tab) => tab.id === activeTabId) ?? null, [openTabs, activeTabId]);

  const activeChapter = useMemo(() => {
    if (!activeTab || activeTab.kind !== "chapter") {
      return null;
    }

    return chapterById.get(activeTab.chapterId) ?? null;
  }, [activeTab, chapterById]);

  const activeStoryEntry = useMemo(() => {
    if (!activeTab || activeTab.kind !== "story") {
      return null;
    }

    return storyEntryById.get(activeTab.entryId) ?? null;
  }, [activeTab, storyEntryById]);

  const activeMarkdown = useMemo(() => {
    if (!activeTab) {
      return "";
    }

    if (activeTab.kind === "chapter") {
      return chapterContents[activeTab.fileName] ?? "";
    }

    if (activeTab.kind === "board") {
      return "";
    }

    return storyContents[activeTab.entryId] ?? "";
  }, [activeTab, chapterContents, storyContents]);

  useEffect(() => {
    if (!activeTab || activeTab.kind !== "chapter") {
      return;
    }

    setSelectedChapterId(activeTab.chapterId);
  }, [activeTab]);

  useEffect(() => {
    const fallbackType = storyBible.types[0];
    if (!fallbackType) {
      return;
    }

    const hasSelected = storyBible.types.some((type) => type.id === selectedTypeId);
    if (!hasSelected) {
      setSelectedTypeId(fallbackType.id);
    }
  }, [selectedTypeId, storyBible.types]);

  useEffect(() => {
    setOpenTabs((previousTabs) => {
      let hasChanges = false;

      const nextTabs = previousTabs.map((tab) => {
        if (tab.kind === "chapter") {
          const chapter = chapterById.get(tab.chapterId);
          const chapterIndex = chapterIndexById.get(tab.chapterId);

          if (!chapter || chapterIndex === undefined) {
            return tab;
          }

          const nextTitle = `${chapterIndex + 1}. ${chapter.title}`;
          if (nextTitle === tab.title) {
            return tab;
          }

          hasChanges = true;
          return {
            ...tab,
            title: nextTitle
          };
        }

        if (tab.kind === "board") {
          return tab;
        }

        const entry = storyEntryById.get(tab.entryId);
        if (!entry || entry.title === tab.title) {
          return tab;
        }

        hasChanges = true;
        return {
          ...tab,
          title: entry.title
        };
      });

      return hasChanges ? nextTabs : previousTabs;
    });
  }, [chapterById, chapterIndexById, storyEntryById]);

  useEffect(() => {
    const clearAutoHideTimer = (): void => {
      if (topChromeAutoHideTimerRef.current !== null) {
        window.clearTimeout(topChromeAutoHideTimerRef.current);
        topChromeAutoHideTimerRef.current = null;
      }
    };

    const scheduleAutoHide = (): void => {
      if (isTopChromeInteracting || topChromeAutoHideTimerRef.current !== null) {
        return;
      }

      topChromeAutoHideTimerRef.current = window.setTimeout(() => {
        setIsTopChromeNearEdge(false);
        topChromeAutoHideTimerRef.current = null;
      }, AUTO_TOP_CHROME_HIDE_DELAY_MS);
    };

    if (topChromeMode !== "hover") {
      clearAutoHideTimer();
      topChromePointerYRef.current = Number.POSITIVE_INFINITY;
      setIsTopChromeNearEdge(false);
      return;
    }

    if (isTopChromeInteracting) {
      clearAutoHideTimer();
      setIsTopChromeNearEdge(true);
    } else if (topChromePointerYRef.current >= AUTO_TOP_CHROME_HIDE_THRESHOLD_PX) {
      scheduleAutoHide();
    }

    const handleMouseMove = (event: MouseEvent): void => {
      const pointerY = event.clientY;
      topChromePointerYRef.current = pointerY;

      if (pointerY <= AUTO_TOP_CHROME_SHOW_THRESHOLD_PX) {
        clearAutoHideTimer();
        setIsTopChromeNearEdge(true);
        return;
      }

      if (pointerY >= AUTO_TOP_CHROME_HIDE_THRESHOLD_PX) {
        scheduleAutoHide();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      clearAutoHideTimer();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isTopChromeInteracting, topChromeMode]);

  useEffect(() => {
    if (topChromeMode !== "collapsed") {
      setIsTopChromeClickOpen(false);
    }
  }, [topChromeMode]);

  const persistProjectFields = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!desktopApi || !projectPaths) {
        return;
      }

      const currentProject = await readJsonObject(desktopApi, projectPaths.projectFilePath);
      const nextProject = {
        ...currentProject,
        ...fields
      };
      await desktopApi.writeFile(projectPaths.projectFilePath, `${JSON.stringify(nextProject, null, 2)}\n`);
    },
    [desktopApi, projectPaths]
  );

  const persistStoryBible = useCallback(
    async (nextStoryBible: StoryBibleData) => {
      if (!desktopApi || !projectPaths) {
        return;
      }

      await desktopApi.writeFile(projectPaths.storyBiblePath, `${JSON.stringify(nextStoryBible, null, 2)}\n`);
    },
    [desktopApi, projectPaths]
  );

  const upsertTab = useCallback((tab: EditorTab) => {
    setOpenTabs((previousTabs) => {
      const existingIndex = previousTabs.findIndex((candidate) => candidate.id === tab.id);
      if (existingIndex < 0) {
        return [...previousTabs, tab];
      }

      const existing = previousTabs[existingIndex];
      if (!existing || existing.title === tab.title) {
        return previousTabs;
      }

      const nextTabs = [...previousTabs];
      nextTabs[existingIndex] = tab;
      return nextTabs;
    });

    setActiveTabId(tab.id);
  }, []);

  const handleSelectChapter = useCallback(
    (chapterId: string) => {
      const chapter = chapterById.get(chapterId);
      const chapterIndex = chapterIndexById.get(chapterId);

      if (!chapter || chapterIndex === undefined) {
        return;
      }

      setSelectedChapterId(chapter.id);
      upsertTab(createChapterTab(chapter, chapterIndex));
    },
    [chapterById, chapterIndexById, upsertTab]
  );

  const handleReorderChapters = useCallback(
    (chapterIds: string[]) => {
      setChapters((previousChapters) => {
        const byId = new Map(previousChapters.map((chapter) => [chapter.id, chapter]));
        const ordered = chapterIds
          .map((id) => byId.get(id))
          .filter((chapter): chapter is Chapter => chapter !== undefined);
        const missing = previousChapters.filter((chapter) => !chapterIds.includes(chapter.id));
        const nextChapters = [...ordered, ...missing];

        void persistProjectFields({
          chapterOrder: nextChapters.map((chapter) => chapter.fileName)
        });

        return nextChapters;
      });
    },
    [persistProjectFields]
  );

  const handleAddChapter = useCallback(() => {
    if (!desktopApi || !projectContext) {
      return;
    }

    const maxChapterNumber = chapters.reduce((maxValue, chapter) => {
      const match = chapter.fileName.match(/^(\d+)/);
      if (!match || !match[1]) {
        return maxValue;
      }

      const parsed = Number.parseInt(match[1], 10);
      return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
    }, 0);
    const nextNumber = maxChapterNumber + 1;
    const fileName = `${String(nextNumber).padStart(2, "0")}.md`;
    const markdown = `# Chapter ${nextNumber}\n\n`;
    const filePath = joinPath(projectContext.chaptersDirectoryPath, fileName);
    const chapter: Chapter = {
      id: fileName,
      fileName,
      title: `Chapter ${nextNumber}`
    };

    void (async () => {
      try {
        await desktopApi.writeFile(filePath, markdown);
        chapterBaselineWordsRef.current[fileName] = countWords(markdown);
        setChapterContents((previous) => ({
          ...previous,
          [fileName]: markdown
        }));
        setChapters((previousChapters) => {
          const nextChapters = [...previousChapters, chapter];
          void persistProjectFields({
            chapterOrder: nextChapters.map((item) => item.fileName)
          });
          return nextChapters;
        });
        setSelectedChapterId(chapter.id);
        upsertTab(createChapterTab(chapter, chapters.length));
      } catch (error) {
        setLoadError(`Failed to add chapter. ${getErrorMessage(error)}`);
      }
    })();
  }, [chapters, desktopApi, persistProjectFields, projectContext, upsertTab]);

  const handleCloseTab = useCallback((tabId: string) => {
    setOpenTabs((previousTabs) => {
      const closingIndex = previousTabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex < 0) {
        return previousTabs;
      }

      const nextTabs = previousTabs.filter((tab) => tab.id !== tabId);
      setActiveTabId((previousActive) => {
        if (previousActive !== tabId) {
          return previousActive;
        }

        if (nextTabs.length === 0) {
          return null;
        }

        const fallbackTab = nextTabs[Math.max(0, closingIndex - 1)] ?? nextTabs[0];
        return fallbackTab ? fallbackTab.id : null;
      });

      return nextTabs;
    });
  }, []);

  const handleOpenStoryEntry = useCallback(
    (entry: StoryEntry) => {
      upsertTab(createStoryTab(entry));
    },
    [upsertTab]
  );

  const handleOpenBoard = useCallback(() => {
    upsertTab(createBoardTab());
  }, [upsertTab]);

  const handleCreateEntry = useCallback(() => {
    if (!desktopApi || !projectContext) {
      return;
    }

    const type = storyBible.types.find((candidate) => candidate.id === selectedTypeId) ?? storyBible.types[0];
    if (!type) {
      return;
    }

    const title = newEntryTitle.trim().length > 0 ? newEntryTitle.trim() : "Untitled Entry";
    const entryId = createId("entry");
    const fileName = `${sanitizeFilePart(title)}-${entryId.slice(-6)}.md`;
    const entry: StoryEntry = {
      id: entryId,
      typeId: type.id,
      title,
      fileName
    };
    const markdown = `# ${title}\n\n`;
    const entryPath = joinPath(projectContext.projectPath, "notes", fileName);

    void (async () => {
      try {
        await desktopApi.writeFile(entryPath, markdown);
        setStoryContents((previous) => ({
          ...previous,
          [entry.id]: markdown
        }));
        setStoryBible((previous) => {
          const next = {
            ...previous,
            entries: [...previous.entries, entry]
          };

          void persistStoryBible(next);
          return next;
        });
        setNewEntryTitle("");
        setShowNewEntryMenu(false);
        upsertTab(createStoryTab(entry));
      } catch (error) {
        setLoadError(`Failed to create entry. ${getErrorMessage(error)}`);
      }
    })();
  }, [desktopApi, newEntryTitle, persistStoryBible, projectContext, selectedTypeId, storyBible.types, upsertTab]);

  const handleAddType = useCallback(() => {
    const name = newTypeName.trim();
    if (name.length === 0) {
      return;
    }

    setStoryBible((previous) => {
      const duplicate = previous.types.some((type) => type.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        return previous;
      }

      const nextType: StoryType = {
        id: createId("type"),
        name
      };
      const next = {
        ...previous,
        types: [...previous.types, nextType]
      };

      void persistStoryBible(next);
      setTypeNameDrafts((drafts) => ({
        ...drafts,
        [nextType.id]: nextType.name
      }));
      setSelectedTypeId(nextType.id);
      return next;
    });

    setNewTypeName("");
  }, [newTypeName, persistStoryBible]);

  const handleSaveTypeNames = useCallback(() => {
    setStoryBible((previous) => {
      const nextTypes = previous.types.map((type) => {
        const draftName = typeNameDrafts[type.id];
        const normalized = draftName ? draftName.trim() : type.name;
        return {
          ...type,
          name: normalized.length > 0 ? normalized : type.name
        };
      });

      const hasChanges = nextTypes.some((type, index) => type.name !== previous.types[index]?.name);
      if (!hasChanges) {
        return previous;
      }

      const next = {
        ...previous,
        types: nextTypes
      };
      void persistStoryBible(next);
      setTypeNameDrafts(Object.fromEntries(nextTypes.map((type) => [type.id, type.name])) as Record<string, string>);
      return next;
    });
  }, [persistStoryBible, typeNameDrafts]);

  const handleEditorChange = useCallback(
    (markdown: string) => {
      if (!desktopApi || !projectContext || !activeTab) {
        return;
      }

      if (activeTab.kind === "board") {
        return;
      }

      if (activeTab.kind === "chapter") {
        const fileName = activeTab.fileName;
        const chapterPath = joinPath(projectContext.chaptersDirectoryPath, fileName);
        setChapterContents((previous) => ({
          ...previous,
          [fileName]: markdown
        }));
        setChapters((previousChapters) =>
          previousChapters.map((chapter) => {
            if (chapter.fileName !== fileName) {
              return chapter;
            }

            const nextTitle = extractHeadingTitle(markdown) ?? "Untitled";
            if (nextTitle === chapter.title) {
              return chapter;
            }

            return {
              ...chapter,
              title: nextTitle
            };
          })
        );
        void desktopApi.scheduleAutosave({
          filePath: chapterPath,
          content: markdown,
          debounceMs: 500
        });
        return;
      }

      const storyEntry = storyEntryById.get(activeTab.entryId);
      if (!storyEntry) {
        return;
      }

      const entryPath = joinPath(projectContext.projectPath, "notes", storyEntry.fileName);
      setStoryContents((previous) => ({
        ...previous,
        [storyEntry.id]: markdown
      }));
      void desktopApi.scheduleAutosave({
        filePath: entryPath,
        content: markdown,
        debounceMs: 500
      });
    },
    [activeTab, desktopApi, projectContext, storyEntryById]
  );

  const handleSaveGoals = useCallback(() => {
    const nextGoals: WritingGoals = {
      chapterGoal: parsePositiveInt(goalDraft.chapterGoal, goals.chapterGoal),
      dailyGoal: parsePositiveInt(goalDraft.dailyGoal, goals.dailyGoal)
    };

    setGoals(nextGoals);
    setGoalDraft({
      chapterGoal: String(nextGoals.chapterGoal),
      dailyGoal: String(nextGoals.dailyGoal)
    });
    setShowGoalSettings(false);
    void persistProjectFields({ goals: nextGoals });
  }, [goalDraft, goals, persistProjectFields]);

  const chapterWordCount = useMemo(() => {
    if (!activeChapter) {
      return 0;
    }

    return countWords(chapterContents[activeChapter.fileName] ?? "");
  }, [activeChapter, chapterContents]);

  const totalWordCount = useMemo(
    () => chapters.reduce((total, chapter) => total + countWords(chapterContents[chapter.fileName] ?? ""), 0),
    [chapters, chapterContents]
  );

  const sessionWordCount = useMemo(
    () =>
      chapters.reduce((total, chapter) => {
        const current = countWords(chapterContents[chapter.fileName] ?? "");
        const baseline = chapterBaselineWordsRef.current[chapter.fileName] ?? current;
        return total + Math.max(0, current - baseline);
      }, 0),
    [chapters, chapterContents]
  );

  const chapterProgressPercent = Math.min(100, (chapterWordCount / goals.chapterGoal) * 100);
  const dailyProgressPercent = Math.min(100, (sessionWordCount / goals.dailyGoal) * 100);

  const activeStoryTypeName = activeStoryEntry ? storyTypeById.get(activeStoryEntry.typeId)?.name ?? "Story Note" : null;
  const activeChapterIndex = activeChapter ? (chapterIndexById.get(activeChapter.id) ?? 0) + 1 : null;
  const boardSceneOptions = useMemo(
    () => chapters.map((chapter) => ({ id: chapter.id, title: chapter.title })),
    [chapters]
  );
  const isTopChromeVisibleInAutoMode = isTopChromeNearEdge || isTopChromeInteracting;
  const isTopToolbarVisible =
    topChromeMode === "open" ||
    (topChromeMode === "hover" && isTopChromeVisibleInAutoMode) ||
    (topChromeMode === "collapsed" && isTopChromeClickOpen);
  const isTabStripVisible =
    topChromeMode === "tabs" ||
    topChromeMode === "open" ||
    (topChromeMode === "hover" && isTopChromeVisibleInAutoMode) ||
    (topChromeMode === "collapsed" && isTopChromeClickOpen);
  const topChromeHeight = (isTopToolbarVisible ? 48 : 0) + (isTabStripVisible ? 44 : 0);
  const pinButtonTop = Math.max(8, topChromeHeight - 12);

  const cycleTopChromeMode = (): void => {
    setTopChromeMode((currentMode) => getNextTopChromeMode(currentMode));
  };

  return (
    <AppShellFrame position="relative">
      {isTopToolbarVisible ? (
        <TopToolbarFrame
          onMouseEnter={() => {
            setIsTopChromeInteracting(true);
          }}
          onMouseLeave={() => {
            setIsTopChromeInteracting(false);
          }}
        >
        <XStack alignItems="center" gap="$4">
          <ToolbarBrand>Manuscript</ToolbarBrand>
          <ToolbarSubtle>{`Project: ${projectName}`}</ToolbarSubtle>
        </XStack>
        <XStack alignItems="center" gap="$3">
          <AppButton tone={activeTab?.kind === "board" ? "focus" : "default"} onPress={handleOpenBoard}>
            Board
          </AppButton>
          <AppButton tone="ghost" onPress={() => setStatsExpanded((value) => !value)}>
            {statsExpanded ? "Collapse Stats" : "Expand Stats"}
          </AppButton>
          <ToolbarDivider />
          <AppButton tone="focus" onPress={() => setShowGoalSettings((value) => !value)}>
            Goals
          </AppButton>
        </XStack>
        </TopToolbarFrame>
      ) : null}
      <button
        type="button"
        title={`Top bar mode: ${TOP_CHROME_MODE_LABEL[topChromeMode]}. Click to switch.`}
        aria-label="Switch top bar mode"
        onClick={cycleTopChromeMode}
        style={{
          position: "absolute",
          right: 14,
          top: pinButtonTop,
          transform: "translateY(-50%)",
          padding: "4px 10px",
          border: "1px solid #3A3A3A",
          borderRadius: 999,
          background: "#1D1F23",
          color: "#A7A7A7",
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          cursor: "pointer",
          zIndex: 98
        }}
      >
        {`Pin: ${TOP_CHROME_MODE_LABEL[topChromeMode]}`}
      </button>
      {topChromeMode === "collapsed" ? (
        <button
          type="button"
          aria-label={isTopChromeClickOpen ? "Collapse top bar" : "Open top bar"}
          onClick={() => {
            setIsTopChromeClickOpen((value) => !value);
          }}
          style={{
            position: "absolute",
            top: Math.max(0, topChromeHeight - 10),
            left: "50%",
            transform: "translateX(-50%)",
            width: 34,
            height: 16,
            border: "1px solid #3A3A3A",
            borderRadius: 8,
            background: "#1D1F23",
            color: "#A7A7A7",
            cursor: "pointer",
            zIndex: 97
          }}
        >
          {isTopChromeClickOpen ? "^" : "v"}
        </button>
      ) : null}
      <WorkspaceFrame position="relative">
        {!isLeftSidebarCollapsed ? (
          <LeftSidebarFrame position="relative">
          <ChapterSidebar
            chapters={chapters}
            selectedChapterId={selectedChapterId}
            onSelectChapter={handleSelectChapter}
            onAddChapter={handleAddChapter}
            onReorderChapters={handleReorderChapters}
          />
          <YStack flex={1} minHeight={0}>
            <YStack paddingHorizontal={16} paddingTop={12} paddingBottom={8}>
              <XStack justifyContent="space-between" alignItems="center" gap="$2">
                <SectionLabel>Story Bible</SectionLabel>
                <AppButton tone={activeTab?.kind === "board" ? "focus" : "default"} onPress={handleOpenBoard}>
                  Board
                </AppButton>
              </XStack>
            </YStack>
            <YStack flex={1} minHeight={0} overflow="scroll" paddingHorizontal={16} paddingBottom={16} gap="$4">
              {storyBible.types.map((type) => {
                const entries = entriesByType.get(type.id) ?? [];

                return (
                  <YStack key={type.id} gap="$2">
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontFamily="$body" fontSize="$2" color="$textMuted" fontWeight="700">
                        {type.name}
                      </Text>
                      <Text fontFamily="$body" fontSize="$2" color="$textMuted">
                        {entries.length}
                      </Text>
                    </XStack>
                    {entries.map((entry) => {
                      const isActive = activeTab?.kind === "story" && activeTab.entryId === entry.id;

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: "1px solid",
                            borderColor: isActive ? "#D4C3A9" : "transparent",
                            borderRadius: 6,
                            background: isActive ? "#2A2A2A" : "transparent",
                            color: "#E0E0E0",
                            fontSize: 15,
                            padding: "7px 8px",
                            cursor: "pointer"
                          }}
                          onClick={() => handleOpenStoryEntry(entry)}
                        >
                          {entry.title}
                        </button>
                      );
                    })}
                  </YStack>
                );
              })}
            </YStack>
          </YStack>
          <YStack padding={14} borderTopWidth={1} borderTopColor="$panelLine">
            <AppButton
              tone="dashed"
              onPress={() => {
                setShowNewEntryMenu((value) => {
                  const next = !value;
                  if (next) {
                    setShowRenameCategories(false);
                  }

                  return next;
                });
              }}
            >
              + New Entry
            </AppButton>
          </YStack>
          {showNewEntryMenu ? (
            <YStack
              position="absolute"
              left={12}
              right={12}
              bottom={72}
              backgroundColor="$paperDeep"
              borderWidth={1}
              borderColor="$panelLine"
              borderRadius={8}
              padding={12}
              gap="$3"
              maxHeight="calc(100% - 108px)"
              overflow="scroll"
              zIndex={50}
            >
              <SectionLabel>New Entry</SectionLabel>
              <input
                value={newEntryTitle}
                placeholder="Entry title"
                onChange={(event) => setNewEntryTitle(event.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #3A3A3A",
                  background: "#191A1D",
                  color: "#E0E0E0",
                  outline: "none"
                }}
              />
              <select
                value={selectedTypeId}
                onChange={(event) => setSelectedTypeId(event.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #3A3A3A",
                  background: "#191A1D",
                  color: "#E0E0E0",
                  outline: "none"
                }}
              >
                {storyBible.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <YStack gap="$2">
                <input
                  value={newTypeName}
                  placeholder="Add new category"
                  onChange={(event) => setNewTypeName(event.target.value)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #3A3A3A",
                    background: "#191A1D",
                    color: "#E0E0E0",
                    outline: "none"
                  }}
                />
                <AppButton onPress={handleAddType}>Add Type</AppButton>
              </YStack>
              <button
                type="button"
                onClick={() => setShowRenameCategories((value) => !value)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  color: "#8A8A8A",
                  padding: "0",
                  textAlign: "left",
                  cursor: "pointer"
                }}
              >
                <XStack alignItems="center" justifyContent="space-between">
                  <SectionLabel>Rename Categories</SectionLabel>
                  <Text fontFamily="$body" color="$textMuted" fontSize="$2">
                    {showRenameCategories ? "▾" : "▸"}
                  </Text>
                </XStack>
              </button>
              {showRenameCategories ? (
                <YStack gap="$2" maxHeight={140} overflow="scroll">
                  {storyBible.types.map((type) => (
                    <input
                      key={type.id}
                      value={typeNameDrafts[type.id] ?? type.name}
                      onChange={(event) =>
                        setTypeNameDrafts((previous) => ({
                          ...previous,
                          [type.id]: event.target.value
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3A3A3A",
                        background: "#191A1D",
                        color: "#E0E0E0",
                        outline: "none"
                      }}
                    />
                  ))}
                </YStack>
              ) : null}
              <YStack gap="$2">
                <XStack gap="$2">
                  <AppButton tone="ghost" flex={1} onPress={() => setShowNewEntryMenu(false)}>
                    Close
                  </AppButton>
                  <AppButton flex={1} onPress={handleSaveTypeNames} disabled={!showRenameCategories}>
                    Save Names
                  </AppButton>
                </XStack>
                <AppButton tone="focus" width="100%" onPress={handleCreateEntry}>
                  Create
                </AppButton>
              </YStack>
            </YStack>
          ) : null}
          </LeftSidebarFrame>
        ) : null}
        <CenterPaneFrame>
          {isTabStripVisible ? (
            <XStack
              borderBottomWidth={1}
              borderBottomColor="$panelLine"
              backgroundColor="$paperDarker"
              minHeight={44}
              paddingHorizontal={8}
              alignItems="center"
              overflow="scroll"
              gap="$2"
              onMouseEnter={() => {
                setIsTopChromeInteracting(true);
              }}
              onMouseLeave={() => {
                setIsTopChromeInteracting(false);
              }}
            >
              {openTabs.map((tab) => {
                const isActive = tab.id === activeTabId;

                return (
                  <XStack
                    key={tab.id}
                    borderWidth={1}
                    borderColor={isActive ? "$accentGold" : "$panelLine"}
                    borderRadius={7}
                    backgroundColor={isActive ? "$chapterActive" : "$paperDeep"}
                    alignItems="center"
                    minHeight={32}
                  >
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#E0E0E0",
                        fontSize: 13,
                        padding: "6px 10px",
                        cursor: "pointer",
                        maxWidth: 180,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      {tab.title}
                    </button>
                    <button
                      type="button"
                      aria-label="Close tab"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#A7A7A7",
                        fontSize: 12,
                        padding: "0 8px",
                        cursor: "pointer"
                      }}
                      onClick={() => handleCloseTab(tab.id)}
                    >
                      x
                    </button>
                  </XStack>
                );
              })}
            </XStack>
          ) : null}
          {activeTab?.kind === "board" ? (
            <YStack flex={1} minHeight={0} backgroundColor="#14161A">
              {projectContext ? (
                <StoryBoard
                  projectPath={projectContext.projectPath}
                  sceneOptions={boardSceneOptions}
                  onOpenScene={handleSelectChapter}
                  onError={setLoadError}
                />
              ) : null}
            </YStack>
          ) : (
            <YStack flex={1} minHeight={0} overflow="scroll" backgroundColor="#14161A">
              <YStack maxWidth={960} width="100%" marginHorizontal="auto" paddingTop={34} paddingBottom={90}>
                {activeChapterIndex ? (
                  <Text
                    textAlign="center"
                    fontFamily="$body"
                    fontSize="$2"
                    letterSpacing={5}
                    color="$accentGold"
                    textTransform="uppercase"
                    marginBottom={10}
                  >
                    {`Chapter ${activeChapterIndex}`}
                  </Text>
                ) : null}
                {activeStoryTypeName ? (
                  <Text
                    textAlign="center"
                    fontFamily="$body"
                    fontSize="$2"
                    letterSpacing={3}
                    color="$textMuted"
                    textTransform="uppercase"
                    marginBottom={10}
                  >
                    {activeStoryTypeName}
                  </Text>
                ) : null}
                {activeTab ? (
                  <LexicalEditor key={activeTab.id} initialMarkdown={activeMarkdown} onChange={handleEditorChange} />
                ) : (
                  <YStack padding={48} alignItems="center" justifyContent="center">
                    <Text fontFamily="$body" color="$textMuted" fontSize="$4">
                      Open a chapter, story entry, or board to start writing.
                    </Text>
                  </YStack>
                )}
              </YStack>
            </YStack>
          )}
        </CenterPaneFrame>
        {!isRightSidebarCollapsed ? (
          <RightSidebarFrame position="relative">
          <YStack padding={16} borderBottomWidth={1} borderBottomColor="$panelLine" gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SectionLabel>Writing Progress</SectionLabel>
              <XStack gap="$2">
                <AppButton tone="ghost" onPress={() => setShowGoalSettings((value) => !value)}>
                  ⚙
                </AppButton>
                <AppButton tone="ghost" onPress={() => setStatsExpanded((value) => !value)}>
                  {statsExpanded ? "Hide" : "Show"}
                </AppButton>
              </XStack>
            </XStack>
            <XStack justifyContent="space-between">
              <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                Chapter
              </Text>
              <Text color="$textPrimary" fontFamily="$body" fontSize="$2">
                {`${chapterWordCount.toLocaleString()} / ${goals.chapterGoal.toLocaleString()}`}
              </Text>
            </XStack>
            <YStack backgroundColor="#2A2A2A" height={5} borderRadius={999} overflow="hidden">
              <YStack backgroundColor="$accentGold" width={`${chapterProgressPercent}%`} height={5} />
            </YStack>
            <XStack justifyContent="space-between">
              <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                Daily
              </Text>
              <Text color="$textPrimary" fontFamily="$body" fontSize="$2">
                {`${sessionWordCount.toLocaleString()} / ${goals.dailyGoal.toLocaleString()}`}
              </Text>
            </XStack>
            <YStack backgroundColor="#2A2A2A" height={5} borderRadius={999} overflow="hidden">
              <YStack backgroundColor="$accentGold" width={`${dailyProgressPercent}%`} height={5} />
            </YStack>
            <XStack justifyContent="space-between">
              <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                Total Manuscript
              </Text>
              <Text color="$textPrimary" fontFamily="$body" fontSize="$2">
                {totalWordCount.toLocaleString()}
              </Text>
            </XStack>
          </YStack>
          {statsExpanded ? (
            <YStack padding={16} gap="$2">
              <SectionLabel>Chapter Navigator</SectionLabel>
              {chapters.map((chapter, index) => {
                const isActive = activeTab?.kind === "chapter" && activeTab.chapterId === chapter.id;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: isActive ? "#D4C3A9" : "transparent",
                      borderRadius: 6,
                      background: isActive ? "#2A2A2A" : "transparent",
                      color: "#E0E0E0",
                      padding: "6px 8px",
                      cursor: "pointer"
                    }}
                    onClick={() => handleSelectChapter(chapter.id)}
                  >
                    {`${index + 1}. ${chapter.title}`}
                  </button>
                );
              })}
            </YStack>
          ) : null}
          {showGoalSettings ? (
            <YStack
              position="absolute"
              top={56}
              right={10}
              left={10}
              padding={12}
              borderWidth={1}
              borderColor="$panelLine"
              borderRadius={8}
              backgroundColor="$paperDeep"
              gap="$2"
              zIndex={60}
            >
              <SectionLabel>Goals</SectionLabel>
              <input
                type="number"
                min={1}
                value={goalDraft.chapterGoal}
                onChange={(event) =>
                  setGoalDraft((previous) => ({
                    ...previous,
                    chapterGoal: event.target.value
                  }))
                }
                placeholder="Chapter goal"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #3A3A3A",
                  background: "#191A1D",
                  color: "#E0E0E0",
                  outline: "none"
                }}
              />
              <input
                type="number"
                min={1}
                value={goalDraft.dailyGoal}
                onChange={(event) =>
                  setGoalDraft((previous) => ({
                    ...previous,
                    dailyGoal: event.target.value
                  }))
                }
                placeholder="Daily goal"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #3A3A3A",
                  background: "#191A1D",
                  color: "#E0E0E0",
                  outline: "none"
                }}
              />
              <XStack justifyContent="flex-end" gap="$2" marginTop={4}>
                <AppButton tone="ghost" onPress={() => setShowGoalSettings(false)}>
                  Cancel
                </AppButton>
                <AppButton tone="focus" onPress={handleSaveGoals}>
                  Save
                </AppButton>
              </XStack>
            </YStack>
          ) : null}
          </RightSidebarFrame>
        ) : null}
        <button
          type="button"
          aria-label={isLeftSidebarCollapsed ? "Open left sidebar" : "Close left sidebar"}
          onClick={() => {
            setIsLeftSidebarCollapsed((value) => {
              const next = !value;
              if (next) {
                setShowNewEntryMenu(false);
              }

              return next;
            });
          }}
          style={{
            position: "absolute",
            top: "50%",
            left: isLeftSidebarCollapsed ? 0 : 272,
            transform: "translateY(-50%)",
            width: 20,
            height: 56,
            border: "1px solid #3A3A3A",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            background: "#1D1F23",
            color: "#A7A7A7",
            cursor: "pointer",
            zIndex: 80
          }}
        >
          {isLeftSidebarCollapsed ? ">" : "<"}
        </button>
        <button
          type="button"
          aria-label={isRightSidebarCollapsed ? "Open right sidebar" : "Close right sidebar"}
          onClick={() => {
            setIsRightSidebarCollapsed((value) => {
              const next = !value;
              if (next) {
                setShowGoalSettings(false);
              }

              return next;
            });
          }}
          style={{
            position: "absolute",
            top: "50%",
            right: isRightSidebarCollapsed ? 0 : 272,
            transform: "translateY(-50%)",
            width: 20,
            height: 56,
            border: "1px solid #3A3A3A",
            borderRight: "none",
            borderRadius: "8px 0 0 8px",
            background: "#1D1F23",
            color: "#A7A7A7",
            cursor: "pointer",
            zIndex: 80
          }}
        >
          {isRightSidebarCollapsed ? "<" : ">"}
        </button>
      </WorkspaceFrame>
      <StatusBarFrame>
        <XStack gap="$4">
          <Text fontFamily="$body" fontSize="$1" color="$textMuted">
            Drafting Mode: On
          </Text>
          <Text fontFamily="$body" fontSize="$1" color="$textMuted">
            Autosave: Active
          </Text>
        </XStack>
        <XStack gap="$4">
          <Text fontFamily="$body" fontSize="$1" color="$textMuted">
            Midnight Dark Theme
          </Text>
          <Text fontFamily="$body" fontSize="$1" color="$accentGold">
            Manuscript
          </Text>
        </XStack>
      </StatusBarFrame>
      {isLoading ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(10,10,10,0.75)"
          zIndex={100}
        >
          <Text fontFamily="$body" fontSize="$4" color="$textPrimary">
            Loading project...
          </Text>
        </YStack>
      ) : null}
      {loadError ? (
        <YStack
          position="absolute"
          bottom={44}
          left={18}
          right={18}
          padding={12}
          borderRadius={8}
          borderWidth={1}
          borderColor="#7A4242"
          backgroundColor="#2E1717"
          zIndex={110}
        >
          <Text fontFamily="$body" fontSize="$2" color="#F6CBCB">
            {loadError}
          </Text>
        </YStack>
      ) : null}
    </AppShellFrame>
  );
}
