const sampleChapters = [
  "01 - Cold Open",
  "02 - The Warning",
  "03 - Night Train"
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

function Sidebar(): JSX.Element {
  return (
    <aside className="panel panel-sidebar">
      <h2 className="panel-title">Chapters</h2>
      <div className="chapter-list">
        {sampleChapters.map((chapter) => (
          <button key={chapter} className="chapter-item" type="button">
            {chapter}
          </button>
        ))}
      </div>
      <button className="btn" type="button">
        Add Chapter
      </button>
    </aside>
  );
}

function EditorPane(): JSX.Element {
  return (
    <section className="editor-wrap">
      <article className="editor-pane">
        Center writing pane placeholder. Lexical editor integration is implemented in Step 7.
      </article>
    </section>
  );
}

function MetadataPane(): JSX.Element {
  return (
    <aside className="panel panel-meta">
      <h2 className="panel-title">Metadata</h2>
      <p className="meta-copy">Project insights and chapter details appear here.</p>
    </aside>
  );
}

export function AppShell(): JSX.Element {
  return (
    <main className="app-shell">
      <Toolbar />
      <div className="shell-main">
        <Sidebar />
        <EditorPane />
        <MetadataPane />
      </div>
    </main>
  );
}
