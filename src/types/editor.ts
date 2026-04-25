/** The format of the source content being edited. */
export type SourceFormat = "pretext" | "latex";

/** Payload emitted when a user submits feedback from the editor UI. */
export interface FeedbackSubmission {
  /** Location where feedback was submitted (for example, "main-editor"). */
  context: string;
  /** Optional email provided by the user when they want a response. */
  email?: string;
  /** Free-form feedback message. */
  message: string;
  /** Whether `currentSource` was included in this submission. */
  includeCurrentSource: boolean;
  /** Current source content when the user opted in. */
  currentSource?: string;
  /** Project URL associated with this feedback, when available. */
  projectUrl?: string;
  /** Optional source format metadata for routing/debugging. */
  sourceFormat?: SourceFormat;
  /** Optional title metadata for routing/debugging. */
  title?: string;
  /** Client-side timestamp of submission. */
  submittedAt: string;
}

/** Payload emitted when a LaTeX document is converted into a new PreTeXt project copy. */
export interface PretextProjectCopyRequest {
  /** Converted PreTeXt source used to create the new project copy. */
  pretextSource: string;
  /** Title to use for the new project copy. */
  title: string;
  /** Optional link to the source project the copy came from. */
  projectUrl?: string;
}

/**
 * Represents the full content state of the editor at any point in time.
 * When `sourceFormat` is `"pretext"`, `pretextSource` mirrors `sourceContent`.
 * When `sourceFormat` is `"latex"`, `pretextSource` holds the result of
 * converting the LaTeX source, or `pretextError` holds a description of why
 * conversion failed.
 * In both cases, `docinfo` contains the pretext docinfo element, which will
 * be inserted into the pretext source when building the preview.  Consumers can use this to store macros
 * and similar document-wide information that may be needed for previewing or other derived state.
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
  /** The docinfo element for a pretext document, which can contain macros and similar
   * document wide information.
   */
  docinfo?: string;
  /** The user-level common docinfo/preamble XML. */
  commonDocinfo?: string;
  /** Whether project rendering should use a user-level common docinfo/preamble. */
  useCommonDocinfo?: boolean;
}

/**
 * The value passed to `onContentChange`.  Identical to `EditorContentState`
 * so consumers can inspect the full derived state on every change.
 */
export type EditorContentChange = EditorContentState;
