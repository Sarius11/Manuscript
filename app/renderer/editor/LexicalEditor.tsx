import type { ElementTransformer, Transformer } from "@lexical/markdown";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { $setBlocksType } from "@lexical/selection";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND
} from "@lexical/react/LexicalHorizontalRuleNode";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $createHeadingNode, HeadingNode } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type EditorThemeClasses,
  type LexicalNode
} from "lexical";
import type { JSX } from "react";
import { useMemo } from "react";

const SCENE_BREAK_REGEX = /^(\*{3,}|-{3,}|_{3,})$/;

const SCENE_BREAK_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    if (!$isHorizontalRuleNode(node)) {
      return null;
    }

    return "***";
  },
  regExp: SCENE_BREAK_REGEX,
  replace: (parentNode, _children, _match, isImport) => {
    const sceneBreak = $createHorizontalRuleNode();
    parentNode.replace(sceneBreak);

    if (!isImport) {
      const trailingParagraph = $createParagraphNode();
      sceneBreak.insertAfter(trailingParagraph);
      trailingParagraph.select();
    }
  },
  type: "element"
};

const MARKDOWN_TRANSFORMERS: Transformer[] = [SCENE_BREAK_TRANSFORMER, ...TRANSFORMERS];

const lexicalTheme: EditorThemeClasses = {
  heading: {
    h1: "lexical-heading lexical-heading-h1",
    h2: "lexical-heading lexical-heading-h2"
  },
  paragraph: "lexical-paragraph",
  text: {
    bold: "lexical-text-bold",
    italic: "lexical-text-italic"
  },
  hr: "lexical-scene-break"
};

interface LexicalEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}

function ToolbarPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();

  const applyParagraph = (): void => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }
      $setBlocksType(selection, () => $createParagraphNode());
    });
  };

  const applyHeading = (): void => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }
      $setBlocksType(selection, () => $createHeadingNode("h2"));
    });
  };

  const insertSceneBreak = (): void => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  };

  return (
    <div className="lexical-toolbar">
      <button
        type="button"
        className="lexical-toolbar-btn"
        onMouseDown={(event) => event.preventDefault()}
        onClick={applyParagraph}
      >
        Paragraph
      </button>
      <button
        type="button"
        className="lexical-toolbar-btn"
        onMouseDown={(event) => event.preventDefault()}
        onClick={applyHeading}
      >
        Heading
      </button>
      <button
        type="button"
        className="lexical-toolbar-btn"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
        }}
      >
        Bold
      </button>
      <button
        type="button"
        className="lexical-toolbar-btn"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
        }}
      >
        Italic
      </button>
      <button
        type="button"
        className="lexical-toolbar-btn"
        onMouseDown={(event) => event.preventDefault()}
        onClick={insertSceneBreak}
      >
        Scene Break
      </button>
    </div>
  );
}

function Placeholder(): JSX.Element {
  return <div className="lexical-placeholder">Start writing your chapter...</div>;
}

export function LexicalEditor({ initialMarkdown, onChange }: LexicalEditorProps): JSX.Element {
  const initialConfig = useMemo(
    () => ({
      namespace: "codex-editor",
      theme: lexicalTheme,
      onError: (error: Error) => {
        throw error;
      },
      nodes: [HeadingNode, HorizontalRuleNode],
      editorState: () => {
        $convertFromMarkdownString(initialMarkdown, MARKDOWN_TRANSFORMERS);
      }
    }),
    [initialMarkdown]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="lexical-editor-shell">
        <ToolbarPlugin />
        <RichTextPlugin
          contentEditable={<ContentEditable className="lexical-content-editable" />}
          placeholder={<Placeholder />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <HorizontalRulePlugin />
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState) => {
            editorState.read(() => {
              const markdown = $convertToMarkdownString(MARKDOWN_TRANSFORMERS);
              onChange(markdown);
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
}
