/**
 * The type of a document section in sectioned editing mode.
 *
 * Each value is the XML tag name used for that division so that the type can
 * be used directly when serialising (`<${type}>…</${type}>`).
 *
 * - `'introduction'`      — positional: always first; maps to `<introduction>`
 * - `'conclusion'`        — positional: always last;  maps to `<conclusion>`
 * - `'section'`           — ordinary `<section>` division
 * - `'worksheet'`         — `<worksheet>` division
 * - `'handout'`           — `<handout>` division
 * - `'exercises'`         — `<exercises>` division
 * - `'references'`        — `<references>` division
 * - `'glossary'`          — `<glossary>` division
 * - `'solutions'`         — `<solutions>` division
 * - `'reading-questions'` — `<reading-questions>` division
 */
export type DocumentSectionType =
  | 'introduction'
  | 'conclusion'
  | 'section'
  | 'worksheet'
  | 'handout'
  | 'exercises'
  | 'references'
  | 'glossary'
  | 'solutions'
  | 'reading-questions';

/**
 * Represents a single top-level division of a PreTeXt article when the
 * editor is in sectioned editing mode.
 */
export interface DocumentSection {
  /** Stable unique identifier (generated on split; preserved through reorder/rename). */
  id: string;
  /** The plain-text title of this section (extracted from `<title>`). */
  title: string;
  /** The full XML string for this section, e.g. `<section>...</section>`. */
  content: string;
  /** The structural role of this section within the document. */
  type: DocumentSectionType;
}

/**
 * A book chapter entry used to populate the TOC when the editor is in
 * `"book"` project mode.  Chapters are managed by the host (typically
 * persisted as separate database records) and provided to the editor as
 * a list.  Each chapter optionally carries its own PreTeXt source in
 * `content`; chapters without `content` are considered not-yet-loaded
 * and may be loaded on demand via `onChapterRequestLoad`.
 */
export interface DocumentChapter {
  /** Stable identifier for this chapter (e.g. a Rails record id or UUID). */
  id: string;
  /** Plain-text chapter title displayed in the TOC. */
  title: string;
  /** Optional `xml:id` attribute from the PreTeXt source. */
  xmlId?: string;
  /** Optional `label` attribute from the PreTeXt source. */
  label?: string;
  /**
   * Full PreTeXt XML source for this chapter.  `undefined` means the
   * chapter has not yet been loaded from the back-end; the editor will
   * call `onChapterRequestLoad(id)` when it needs the content.
   */
  content?: string;
}

/**
 * The result of splitting a PreTeXt document or chapter into its (top-level) sections.
 */
export interface DocumentSplitResult {
  /**
   * An opaque XML template string representing the document shell (article
   * tag, docinfo, and any non-section content).  Pass this back to
   * `mergeDocument` together with a `sections` array to reconstruct the
   * full document.  Consumers do not need to inspect or modify this value.
   */
  wrapper: string;
  /** The ordered list of top-level sections extracted from the document. */
  sections: DocumentSection[];
}
