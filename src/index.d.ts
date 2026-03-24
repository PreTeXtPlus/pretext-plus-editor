// Type definitions for @pretextbook/web-editor

export type SourceFormat = "pretext" | "latex";

export interface EditorContentState {
  sourceContent: string;
  sourceFormat: SourceFormat;
  pretextContent?: string;
  pretextError?: string;
}

export type EditorContentChange = EditorContentState;

export interface DerivedPretextResult {
  pretextContent?: string;
  pretextError?: string;
}

export function detectSourceFormat(content: string): SourceFormat;

export function convertLatexToPretext(latexContent: string): string;

export function derivePretextContent(
  sourceContent: string,
  sourceFormat: SourceFormat,
): DerivedPretextResult;

export interface editorProps {
  content: string;
  sourceFormat?: SourceFormat;
  pretextContent?: string;
  onContentChange: (
    value: string | undefined,
    meta?: EditorContentChange,
  ) => void;
  title?: string;
  onTitleChange?: (value: string) => void;
  onSaveButton?: () => void;
  saveButtonLabel?: string;
  onCancelButton?: () => void;
  cancelButtonLabel?: string;
  onSave?: () => void;
  onPreviewRebuild?: (
    content: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

export function Editors(props: editorProps): JSX.Element;

export function CodeEditor(props: any): JSX.Element;

export function VisualEditor(props: any): JSX.Element;

export function FullPreview(props: any): JSX.Element;
