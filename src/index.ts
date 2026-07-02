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
  SourceFormat,
} from "./types/editor";
export type {
  Division,
  DivisionType,
  // Deprecated aliases kept for migration compatibility
  /** @deprecated Use `DivisionType` instead. */
  DocumentSectionType,
  /** @deprecated Use `Division` instead. */
  DocumentSection,
  /** @deprecated Chapters are now plain `Division` records with type `"chapter"`. */
  DocumentChapter,
} from "./types/sections";
export type { DivisionTreeNode } from "./sectionUtils";
export {
  assembleProjectSource,
  assembleFullProjectSource,
  // Division ref utilities (new architecture)
  parseDivisionRefs,
  insertDivisionRef,
  removeDivisionRef,
  moveDivisionRef,
  renameDivisionRef,
  findDivisionParent,
  reorderDivisionRefs,
  getOrphanedDivisions,
  getOrphanRoots,
  buildDivisionTree,
  wrapDivisionForPreview,
  // Division content utilities
  // TODO: update these to work for generic divisions, not just sections
  updateDivisionTitle,
  createNewSection,
  createIntroduction,
  createConclusion,
  stripSectionWrapper,
  rewrapSection,
  ensureSectionWrapper,
  mergeTwoSections,
  getSectionAttributes,
  updateSectionMetadata,
  extractDivisionMetadata,
  // LaTeX division utilities
  // TODO: update these to work for generic divisions, not just sections
  stripLatexSectionWrapper,
  rewrapLatexSection,
  ensureLatexSectionWrapper,
  updateLatexSectionTitle,
  extractLatexDivisionTitle,
  createNewLatexSection,
  createLatexIntroduction,
  createLatexConclusion,
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
