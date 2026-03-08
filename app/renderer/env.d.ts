import type { CodexDesktopApi } from "../types/ipc";

declare global {
  interface Window {
    codex: CodexDesktopApi;
  }
}

export {};
