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
 * Represents a single top-level division of a PreTeXt article or chapter.
 *
 * In the new architecture, each section is a first-class database record on
 * the host (Rails) side.  The host passes the full ordered list of sections
 * for the current article/chapter to the TOC, and provides one section's
 * `content` at a time to the editor.
 */
export interface DocumentSection {
  /** Stable server-assigned identifier (Rails record id or UUID). */
  id: string;
  /** The plain-text title of this section (extracted from `<title>`). */
  title: string;
  /** The full XML string for this section, e.g. `<section>...</section>`. */
  content: string;
  /** The structural role of this section within the document. */
  type: DocumentSectionType;
  /**
   * Display order within the parent article/chapter.
   * NOTE: TBD whether the host uses this field or array index as the
   * ordering contract.  Currently array order is the contract; this field
   * is reserved for future use if the Rails side needs an explicit position
   * column.  Easy to activate: sort the incoming `sections` array by this
   * field before rendering the TOC.
   */
  position?: number;
  /**
   * Parent record id (chapter id, article id, or sub-section parent id).
   * NOTE: Sub-sections currently live entirely inside section XML and are
   * never exposed to the TOC.  This field is reserved for a future phase
   * where the TOC manages one nesting level.  The Rails ancestry gem stores
   * hierarchy separately; this mirrors that relationship when the host
   * chooses to include it.
   */
  parentId?: string;
}

/**
 * A book chapter entry used to populate the TOC when the editor is in
 * `"book"` project mode.
 *
 * A chapter is either **section-less** (it holds a `content` blob) or
 * **sectioned** (it holds a `sections` array of DB-backed records).
 * Exactly one of `content` or `sections` should be present; a chapter
 * with neither is considered not-yet-loaded; a chapter with both is a
 * programming error on the host's part.
 *
 * NOTE: This may evolve into a TypeScript discriminated union once the Rails
 * schema is finalized.  The current two-optional-fields approach minimizes
 * the breaking change surface for host consumers.
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
   * Full PreTeXt XML source for this chapter when it has no sections.
   * `undefined` means either not-yet-loaded or the chapter is sectioned.
   */
  content?: string;
  /**
   * Ordered list of section records when the chapter is sectioned.
   * The editor uses this list for TOC rendering only; section XML is
   * provided separately via the `source` prop when a section is selected.
   * `undefined` means the chapter is section-less (use `content` instead).
   */
  sections?: DocumentSection[];
}

/**
 * The result of splitting a PreTeXt document or chapter into its (top-level) sections.
 *
 * @deprecated The `wrapper` concept is being removed as part of the
 * sections-as-DB-records refactor.  The Rails app now owns the document
 * shell; use `splitContentIntoSections` from `sectionUtils` instead.
 * This type will be deleted once all internal callers are migrated.
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
