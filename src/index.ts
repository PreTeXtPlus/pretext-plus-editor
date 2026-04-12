// Main entry point for the npm package
// Import styles to ensure they are bundled
import './index.css';

export { default as Editors } from './components/Editors';
export type { editorProps } from './components/Editors';
export {
  convertLatexToPretext,
  derivePretextContent,
  detectSourceFormat,
} from './contentConversion';
export type {
  EditorContentChange,
  EditorContentState,
  SourceFormat,
} from './types/editor';
export type {
  DocumentSection,
  DocumentSectionType,
  DocumentSplitResult,
} from './types/sections';
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
} from './sectionUtils';

// Export other useful components if needed
export { default as CodeEditor } from './components/CodeEditor';
export { default as VisualEditor } from './components/VisualEditor';
export { default as FullPreview } from './components/FullPreview';
export { postToIframe } from './components/postToIframe';
