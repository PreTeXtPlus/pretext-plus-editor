// Type definitions for @pretextbook/web-editor

/** The format of the source content being edited. */
export type SourceFormat = "pretext" | "latex";

/**
 * Represents the full content state of the editor at any point in time.
 * When `sourceFormat` is `"pretext"`, `pretextSource` mirrors `sourceContent`.
 * When `sourceFormat` is `"latex"`, `pretextSource` holds the converted XML,
 * or `pretextError` holds an error description if conversion failed.
 */
export interface EditorContentState {
  /** The raw source string as typed/loaded by the user. */
  sourceContent: string;
  /** The format of `sourceContent`. */
  sourceFormat: SourceFormat;
  /** The PreTeXt XML derived from `sourceContent` (present when conversion succeeded). */
  pretextSource?: string;
  /** Human-readable error set when conversion fails.  When present, `pretextSource` is undefined. */
  pretextError?: string;
}

/** The value passed to `onContentChange` — identical to `EditorContentState`. */
export type EditorContentChange = EditorContentState;

/** Returned by {@link derivePretextContent}. Exactly one of the two fields will be set. */
export interface DerivedPretextResult {
  /** The converted (or pass-through) PreTeXt XML string. */
  pretextSource?: string;
  /** Human-readable error when conversion fails. */
  pretextError?: string;
}

/**
 * Inspects `source` and returns the most likely {@link SourceFormat}.
 * Returns `"latex"` when LaTeX markers are detected, otherwise `"pretext"`.
 */
export function detectSourceFormat(source: string): SourceFormat;

/**
 * Converts a LaTeX document string to formatted PreTeXt XML.
 * @throws If the underlying conversion library throws.
 */
export function convertLatexToPretext(latexContent: string): string;

/**
 * Derives PreTeXt content from `sourceContent`.  For PreTeXt input the
 * content is returned as-is; for other formats conversion is attempted and
 * errors are caught and returned as `pretextError`.
 */
export function derivePretextContent(
  sourceContent: string,
  sourceFormat: SourceFormat,
): DerivedPretextResult;

/** Props accepted by the top-level {@link Editors} component. */
export interface editorProps {
  /** The source content string (PreTeXt XML or LaTeX). */
  source: string;
  /** The format of `source`.  Defaults to `"pretext"` when omitted. */
  sourceFormat?: SourceFormat;
  /** Pre-computed PreTeXt XML for `source`; avoids redundant conversion on first render. */
  pretextSource?: string;
  /**
   * Called whenever the source content changes.
   * @param value - The new source string.
   * @param meta  - Full derived state snapshot at the time of the change.
   */
  onContentChange: (
    value: string | undefined,
    meta?: EditorContentChange,
  ) => void;
  /** Document title shown in the menu bar. */
  title?: string;
  /** Called when the user edits the title field. */
  onTitleChange?: (value: string) => void;
  /** If provided, a Save button is rendered in the menu bar. */
  onSaveButton?: () => void;
  /** Label for the Save button.  Defaults to `"Save"`. */
  saveButtonLabel?: string;
  /** If provided, a Cancel button is rendered in the menu bar. */
  onCancelButton?: () => void;
  /** Label for the Cancel button.  Defaults to `"Cancel"`. */
  cancelButtonLabel?: string;
  /** Called on Ctrl+S (in addition to `onSaveButton`). */
  onSave?: () => void;
  /**
   * If provided, the preview panel shows a full iframe preview and
   * Ctrl+Enter / rebuild controls become active.
   */
  onPreviewRebuild?: (
    source: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

export function Editors(props: editorProps): JSX.Element;

export function CodeEditor(props: any): JSX.Element;

export function VisualEditor(props: any): JSX.Element;

export function FullPreview(props: any): JSX.Element;
