import type { ElementTransformer, Transformer } from "@lexical/markdown";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  HEADING,
  ITALIC_STAR,
  ITALIC_UNDERSCORE
} from "@lexical/markdown";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode
} from "@lexical/react/LexicalHorizontalRuleNode";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import {
  $createParagraphNode,
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

const MARKDOWN_TRANSFORMERS: Transformer[] = [
  SCENE_BREAK_TRANSFORMER,
  HEADING,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE
];

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

function Placeholder(): JSX.Element {
  return <div className="lexical-placeholder">Start writing your chapter...</div>;
}

export function LexicalEditor({ initialMarkdown, onChange }: LexicalEditorProps): JSX.Element {
  const initialConfig = useMemo(
    () => ({
      namespace: "atramentum-editor",
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
      <RichTextPlugin
        contentEditable={
          <div className="lexical-content-host">
            <ContentEditable className="lexical-content-editable" />
          </div>
        }
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
    </LexicalComposer>
  );
}
