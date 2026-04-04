/** The format of the source content being edited. */
export type SourceFormat = "pretext" | "latex";

/**
 * Represents the full content state of the editor at any point in time.
 * When `sourceFormat` is `"pretext"`, `pretextSource` mirrors `sourceContent`.
 * When `sourceFormat` is `"latex"`, `pretextSource` holds the result of
 * converting the LaTeX source, or `pretextError` holds a description of why
 * conversion failed.
 */
export interface EditorContentState {
  /** The raw source string as typed/loaded by the user. */
  sourceContent: string;
  /** The format of `sourceContent`. */
  sourceFormat: SourceFormat;
  /**
   * The PreTeXt XML derived from `sourceContent`.
   * Present when conversion succeeded (or when the source is already PreTeXt).
   */
  pretextSource?: string;
  /**
   * Human-readable error message set when conversion from a non-PreTeXt
   * format fails.  When present, `pretextSource` will be undefined.
   */
  pretextError?: string;
}

/**
 * The value passed to `onContentChange`.  Identical to `EditorContentState`
 * so consumers can inspect the full derived state on every change.
 */
export type EditorContentChange = EditorContentState;
