/** The format of the source content being edited. */
export type SourceFormat = "pretext" | "latex" | "markdown";

/** The kind of a project asset — determines the inserted PreTeXt tag. */
export type AssetKind = "image" | "doenet";

/** An asset stored in the project asset library. */
export interface Asset {
  /** Stable server-assigned identifier (hidden from users). */
  id: string;
  /** Human-readable display name shown in the library UI. */
  name: string;
  /** Short reference used when authoring references, e.g. `"euler-painting"`.
   * Authors write e.g. `<plus:image ref="euler-painting"/>` and the build system
   * resolves it to the necessary core PreTeXt markup based upon the kind of
   * asset it is.
   */
  ref?: string;
  /** The kind of asset — determines the tag inserted into the document. */
  kind: AssetKind;
  /** Source content for an asset to be generated. */
  source?: string;
  /** Publicly accessible URL for the asset, if applicable. */
  url?: string;
  /** Mime type for the asset, if applicable.  Used for hints only. */
  contentType?: string;
}

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
