/**
 * The type of a document section in sectioned editing mode.
 * - `'introduction'` — appears only at the beginning (maps to `<introduction>`)
 * - `'section'`      — a regular `<section>` element
 * - `'conclusion'`   — appears only at the end (maps to `<conclusion>`)
 */
export type DocumentSectionType = 'introduction' | 'section' | 'conclusion';

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
 * The result of splitting a PreTeXt document into its top-level sections.
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
