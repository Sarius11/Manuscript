# Codex (Working Title)

Local-first desktop writing app scaffold (Step 1).

## Requirements

- Node.js 22+
- Corepack (bundled with Node.js)

## Quickstart

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm --filter app dev:renderer
```

## Workspace Layout

```
app/
  electron/
  renderer/
  core/
  types/
  projects/
```

Step 1 includes only scaffold, TypeScript setup, and Vite renderer foundation.
