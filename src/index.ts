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
  EditorContentChange,
  EditorContentState,
  FeedbackSubmission,
  PretextProjectCopyRequest,
  SourceFormat,
} from "./types/editor";
export type {
  DocumentSection,
  DocumentSectionType,
  DocumentSplitResult,
  ChapterSummary,
} from "./types/sections";
export {
  splitDocument,
  mergeDocument,
  updateSectionTitle,
  createNewSection,
  createIntroduction,
  createConclusion,
  stripSectionWrapper,
  rewrapSection,
  ensureSectionWrapper,
  // LaTeX section utilities
  splitLatexDocument,
  mergeLatexDocument,
  stripLatexSectionWrapper,
  rewrapLatexSection,
  ensureLatexSectionWrapper,
  updateLatexSectionTitle,
  createNewLatexSection,
  createLatexIntroduction,
  createLatexConclusion,
  wrapDocumentAsSection,
  wrapLatexDocumentAsSection,
  mergeTwoSections,
  wrapSectionAsDocument,
  wrapLatexSectionAsDocument,
  getSectionAttributes,
  updateSectionMetadata,
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
