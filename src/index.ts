// Main entry point for the npm package
// Import CSS styles - the visual-editor exports its CSS via this path
// This import works in both development and production
import "@pretextbook/visual-editor/styles";

// Import own styles
import "./index.css";

export { default as Editors } from "./components/Editors";
export type { editorProps } from "./components/Editors";
export {
  convertLatexToPretext,
  derivePretextContent,
  detectSourceFormat,
} from "./contentConversion";
export type {
  Asset,
  AssetKind,
  EditorContentChange,
  EditorContentState,
  FeedbackSubmission,
  PretextProjectCopyRequest,
  SourceFormat,
} from "./types/editor";
export type {
  DocumentSection,
  DocumentSectionType,
  /** @deprecated Use `DocumentChapter` directly. */
  DocumentChapter as ChapterSummary,
  DocumentChapter,
  /** @deprecated The wrapper/split-result pattern is being removed. Use `splitContentIntoSections` instead. */
  DocumentSplitResult,
} from "./types/sections";
export {
  // New architecture helpers
  splitContentIntoSections,
  // Section CRUD utilities
  updateSectionTitle,
  createNewSection,
  createIntroduction,
  createConclusion,
  stripSectionWrapper,
  rewrapSection,
  ensureSectionWrapper,
  mergeTwoSections,
  getSectionAttributes,
  updateSectionMetadata,
  // LaTeX section utilities
  stripLatexSectionWrapper,
  rewrapLatexSection,
  ensureLatexSectionWrapper,
  updateLatexSectionTitle,
  createNewLatexSection,
  createLatexIntroduction,
  createLatexConclusion,
  // Deprecated: full-document split/merge (wrapper pattern)
  /** @deprecated Use `splitContentIntoSections` instead. */
  splitDocument,
  /** @deprecated Rails now owns document reconstruction. */
  mergeDocument,
  /** @deprecated Use `splitContentIntoSections` instead. */
  splitLatexDocument,
  /** @deprecated Rails now owns document reconstruction. */
  mergeLatexDocument,
  /** @deprecated */
  wrapDocumentAsSection,
  /** @deprecated */
  wrapLatexDocumentAsSection,
  /** @deprecated */
  wrapSectionAsDocument,
  /** @deprecated */
  wrapLatexSectionAsDocument,
} from "./sectionUtils";

// Export components
export { default as CodeEditor } from "./components/CodeEditor";
export { VisualEditor } from "@pretextbook/visual-editor";
export { default as FullPreview } from "./components/FullPreview";
export { default as FeedbackLink } from "./components/FeedbackLink";
export { default as DocinfoEditor } from "./components/DocinfoEditor";
export type {
  DocinfoEditorProps,
  DocinfoEditorCloseValue,
} from "./components/DocinfoEditor";
export { postToIframe } from "./components/postToIframe";
