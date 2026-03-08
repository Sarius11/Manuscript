import { promises as fs } from "node:fs";
import { dirname, extname, resolve } from "node:path";

export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 500;

export interface AutoSaveOptions {
  debounceMs?: number;
  onSaved?: (filePath: string, content: string) => void;
  onError?: (error: unknown) => void;
}

export interface AutoSaveController {
  schedule: (content: string) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  destroy: () => void;
  isPending: () => boolean;
}

function resolveMarkdownPath(filePath: string): string {
  const resolvedPath = resolve(filePath);
  const extension = extname(resolvedPath).toLowerCase();

  if (extension !== ".md") {
    throw new Error(`Only markdown files are supported: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function readMarkdownFile(filePath: string): Promise<string> {
  const resolvedPath = resolveMarkdownPath(filePath);
  return fs.readFile(resolvedPath, "utf-8");
}

export async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  const resolvedPath = resolveMarkdownPath(filePath);
  await fs.mkdir(dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, content, "utf-8");
}

export function createAutoSave(filePath: string, options: AutoSaveOptions = {}): AutoSaveController {
  const resolvedPath = resolveMarkdownPath(filePath);
  const debounceMs = options.debounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS;
  let timer: NodeJS.Timeout | null = null;
  let nextContent: string | null = null;
  let writeChain = Promise.resolve();
  let destroyed = false;

  const clearPendingTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const persistContent = async (content: string): Promise<void> => {
    writeChain = writeChain.then(async () => {
      await writeMarkdownFile(resolvedPath, content);
      options.onSaved?.(resolvedPath, content);
    });

    try {
      await writeChain;
    } catch (error) {
      options.onError?.(error);
      throw error;
    }
  };

  const flushInternal = async (propagateErrors: boolean): Promise<void> => {
    if (destroyed || nextContent === null) {
      return;
    }

    clearPendingTimer();
    const content = nextContent;
    nextContent = null;

    try {
      await persistContent(content);
    } catch (error) {
      if (propagateErrors) {
        throw error;
      }
    }
  };

  return {
    schedule(content: string): void {
      if (destroyed) {
        return;
      }

      nextContent = content;
      clearPendingTimer();

      timer = setTimeout(() => {
        void flushInternal(false);
      }, debounceMs);
    },

    async flush(): Promise<void> {
      await flushInternal(true);
    },

    cancel(): void {
      clearPendingTimer();
      nextContent = null;
    },

    destroy(): void {
      destroyed = true;
      clearPendingTimer();
      nextContent = null;
    },

    isPending(): boolean {
      return nextContent !== null;
    }
  };
}
