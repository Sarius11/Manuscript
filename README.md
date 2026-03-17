# Manuscript

**Manuscript** is a local-first desktop writing environment for novels, screenplays, and complex narrative projects.

It is designed for writers who want a **serious writing tool without subscriptions, lock-in, or cloud dependencies**.

The project focuses on three principles:

- **Own your files**
- **Write without friction**
- **Ship publishable manuscripts**

Manuscript combines a modern editor with a visual story-graph system so authors can both **write the text and map the narrative structure** in the same environment.
<img width="1913" height="1078" alt="Képernyőkép 2026-03-17 200423" src="https://github.com/user-attachments/assets/7c334034-c3fe-4acc-8494-e353aaa387c8" />



---

## Core Ideas

Traditional writing tools tend to fall into two categories:

- **Text editors** (good for writing, poor for structure)
- **Planning tools** (good for structure, disconnected from the manuscript)

Manuscript bridges that gap.

It provides:

- a clean writing editor
- manuscript-ready formatting
- a visual story board for events, characters, and causality
- simple export to industry formats

All stored locally in human-readable files.

---

## Features

### Writing

- Clean manuscript-style editor
- Chapter and scene organization
- Autosave
- Focus writing mode
- Word count tracking

### Export (to be developed)

- DOCX manuscript export
- EPUB export
- PDF export

### Story Graph

A visual “red string board” for plotting complex narratives.

- draggable notes
- connections between events
- causal relationships
- character and location links
- persistent board layout

### Screenplay Mode (to be developed)

Support for screenplay formatting including:

- scene headings
- action blocks
- dialogue
- character cues

---

## Technology

Manuscript is built using:

- **Electron** – desktop runtime
- **React** – UI framework
- **Tamagui** – UI system
- **Lexical** – text editor engine
- **React Flow** – story graph canvas
- **Pandoc** – document export (to be implemented)

The application is **local-first** and does not require a backend.

---

## Storage Philosophy

Projects are stored as normal files on disk.

Example:

project/
project.json
chapters/
01.md
02.md
board.json


This keeps manuscripts portable, version-controllable, and future-proof.

---

## Goals

Manuscript is intended to become:

- a reliable long-form writing environment
- a visual narrative design tool
- a local-first alternative to subscription writing software

---

## Status

Early development.

The project currently focuses on building the core modules:

- writing editor
- project system
- export engine
- story graph board

---

## License

Copyright (c) 2026 Adam Nagy

This software is currently provided free of charge for personal and
non-commercial use.

All rights reserved.

No permission is granted to redistribute, sell, sublicense, or
commercially exploit this software without explicit written permission
from the author.


