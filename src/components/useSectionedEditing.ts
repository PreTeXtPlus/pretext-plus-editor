/**
 * Custom hook that owns all sectioned-editing state and handlers, extracted
 * from the `Editors` component to keep it manageable.
 *
 * Callers supply the current `EditorContentState` and a callback
 * (`onContentUpdate`) that is invoked whenever a section change produces a
 * new merged full-document source string.  All other section-related
 * callbacks mirror the corresponding `editorProps`.
 */
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import type { EditorContentState } from "../types/editor";
import type { DocumentSection } from "../types/sections";
import {
  splitDocument,
  mergeDocument,
  createNewSection,
  createIntroduction,
  createConclusion,
  splitLatexDocument,
  mergeLatexDocument,
  updateLatexSectionTitle,
  createNewLatexSection,
  createLatexIntroduction,
  createLatexConclusion,
  wrapDocumentAsSection,
  wrapLatexDocumentAsSection,
  mergeTwoSections,
  updateSectionMetadata,
  stripSectionWrapper,
  stripLatexSectionWrapper,
  rewrapSection,
  rewrapLatexSection,
} from "../sectionUtils";

export interface SectionedEditingOptions {
  contentState: EditorContentState;
  /** Externally controlled edit mode (controlled usage). */
  controlledEditMode?: "document" | "sectioned";
  /** Initial edit mode for uncontrolled usage. */
  defaultEditMode?: "document" | "sectioned";
  onEditModeChange?: (mode: "document" | "sectioned") => void;
  onSectionsChange?: (sections: DocumentSection[]) => void;
  onSectionChange?: (section: DocumentSection) => void;
  /** Called with the merged full-document source whenever section content changes. */
  onContentUpdate: (source: string) => void;
  /**
   * When set (book mode), changing this value triggers an immediate section
   * re-parse and resets to document mode so the newly-loaded chapter is
   * reflected in the TOC even when the editor was previously in sectioned mode.
   */
  chapterKey?: string | null;
}

export interface SectionedEditingResult {
  editMode: "document" | "sectioned";
  sections: DocumentSection[];
  currentSectionId: string | null;
  setCurrentSectionId: Dispatch<SetStateAction<string | null>>;
  documentWrapper: string;
  /** The section currently being edited, or `null` in document mode. */
  currentSection: DocumentSection | null;
  isTocCollapsed: boolean;
  setIsTocCollapsed: Dispatch<SetStateAction<boolean>>;
  /**
   * The source content to display in the code editor.
   * In sectioned mode this is the *inner* content of the current section
   * (outer division tag stripped); in document mode it is the full source.
   */
  activeSourceContent: string;
  /** Called by the code editor when the user edits section content. */
  updateSectionContent: (content: string | undefined) => void;
  handleRefreshSections: () => void;
  switchEditMode: (mode: "document" | "sectioned") => void;
  handleSelectSectionInDocMode: (id: string) => void;
  handleAddFirstSection: () => void;
  handleAddSection: (afterId: string | null) => void;
  handleAddIntroduction: () => void;
  handleAddConclusion: () => void;
  handleRemoveSection: (id: string) => void;
  handleUpdateSectionMetadata: (
    id: string,
    changes: {
      title?: string;
      type?: DocumentSection["type"];
      xmlId?: string | null;
      label?: string | null;
    },
  ) => void;
  handleReorderSections: (nextSections: DocumentSection[]) => void;
  handleMergeSection: (sourceId: string, targetId: string) => void;
}

export function useSectionedEditing({
  contentState,
  controlledEditMode,
  defaultEditMode,
  onEditModeChange,
  onSectionsChange,
  onSectionChange,
  onContentUpdate,
  chapterKey,
}: SectionedEditingOptions): SectionedEditingResult {
  const [internalEditMode, setInternalEditMode] = useState<
    "document" | "sectioned"
  >(defaultEditMode ?? "document");

  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [documentWrapper, setDocumentWrapper] = useState<string>("");
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [isTocCollapsed, setIsTocCollapsed] = useState(true);

  // Pending section title to navigate to after a mode switch
  const pendingNavTitle = useRef<string | null>(null);
  // Debounce timer for auto-refreshing the TOC in document mode
  const tocRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLatexDoc = contentState.sourceFormat === "latex";
  // Markdown doesn't support sectioned editing
  const supportsSectioned = contentState.sourceFormat !== "markdown";
  const rawEditMode = controlledEditMode ?? internalEditMode;
  const editMode = supportsSectioned ? rawEditMode : "document";

  useEffect(() => {
    if (supportsSectioned) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSections([]);
     
    setDocumentWrapper("");
     
    setCurrentSectionId(null);
    pendingNavTitle.current = null;
     
    setInternalEditMode("document");
  }, [supportsSectioned]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const doMerge = (
    secs: DocumentSection[],
    wrapper = documentWrapper,
  ): string =>
    isLatexDoc
      ? mergeLatexDocument(wrapper, secs)
      : mergeDocument(wrapper, secs);

  // ── Populate sections on mount ─────────────────────────────────────────────

  useEffect(() => {
    const { sourceContent, sourceFormat } = contentState;
    if (sourceFormat === "markdown") return;
    const toSplit =
      sourceFormat === "latex"
        ? sourceContent
        : sourceFormat === "pretext"
        ? sourceContent
        : contentState.pretextSource ?? "";
    if (!toSplit.trim()) return;
    try {
      const { wrapper, sections: split } =
        sourceFormat === "latex"
          ? splitLatexDocument(toSplit)
          : splitDocument(toSplit);
      setDocumentWrapper(wrapper); // eslint-disable-line react-hooks/set-state-in-effect
      setSections(split);  
      setCurrentSectionId(split[0]?.id ?? null);  
    } catch {
      // ignore parse errors; TOC will be empty
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Chapter-key change: reset sections when the host loads a new chapter ───
  // This is needed in book mode: when the host fetches a new chapter and updates
  // `source`, the sections must be re-parsed even if the editor was in sectioned
  // mode (where the normal debounced refresh is suppressed to avoid clobbering
  // in-progress edits).  We also reset to document mode so the user starts fresh
  // on the newly-loaded chapter rather than landing in a potentially stale section.
  const isFirstChapterKeyRender = useRef(true);
  useEffect(() => {
    if (chapterKey == null) return;
    // Skip the initial render — mount-time parsing handles the first chapter.
    if (isFirstChapterKeyRender.current) {
      isFirstChapterKeyRender.current = false;
      return;
    }
    const { sourceContent, sourceFormat } = contentState;
    if (sourceFormat === "markdown") return;
    const toSplit =
      sourceFormat === "latex"
        ? sourceContent
        : sourceFormat === "pretext"
        ? sourceContent
        : contentState.pretextSource ?? "";
    if (!toSplit.trim()) {
      setSections([]); // eslint-disable-line react-hooks/set-state-in-effect
      setDocumentWrapper("");  
      setCurrentSectionId(null);  
    } else {
      try {
        const { wrapper, sections: split } =
          sourceFormat === "latex"
            ? splitLatexDocument(toSplit)
            : splitDocument(toSplit);
        setDocumentWrapper(wrapper);  
        setSections(split);  
        setCurrentSectionId(split[0]?.id ?? null);  
        onSectionsChange?.(split);
      } catch {
        setSections([]);  
        setDocumentWrapper("");  
        setCurrentSectionId(null);  
      }
    }
    // Switch back to document mode so the user starts fresh on the new chapter.
    setInternalEditMode("document");  
    onEditModeChange?.("document");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]); // only fire when the chapter changes

  // ── Refresh sections ───────────────────────────────────────────────────────

  /**
   * Re-parse the current full document and refresh the sections array.
   * In document mode this keeps the readonly TOC in sync as the user types.
   * In sectioned mode it is only triggered explicitly (refresh button).
   *
   * Existing section IDs are re-used where the title matches an existing entry
   * so that the selected section is preserved where possible.
   */
  const handleRefreshSections = () => {
    if (!supportsSectioned) return;
    const source = contentState.sourceContent;
    let fresh: DocumentSection[];
    let wrapper: string;
    try {
      ({ wrapper, sections: fresh } = isLatexDoc
        ? splitLatexDocument(source)
        : splitDocument(source));
    } catch {
      return; // ignore parse errors
    }
    // Carry forward existing IDs where titles match to keep selection stable
    const titleToId = new Map(sections.map((s) => [s.title, s.id]));
    const remapped = fresh.map((s) => ({
      ...s,
      id: titleToId.get(s.title) ?? s.id,
    }));
    setDocumentWrapper(wrapper);
    setSections(remapped);
    onSectionsChange?.(remapped);
    // Keep the current section selected if it still exists
    if (
      editMode === "sectioned" &&
      currentSectionId &&
      !remapped.some((s) => s.id === currentSectionId)
    ) {
      setCurrentSectionId(remapped[0]?.id ?? null);
    }
  };

  // In document mode, debounce-refresh the sections whenever the content
  // changes so the readonly TOC stays in sync without a manual refresh.
  useEffect(() => {
    if (editMode !== "document") return;
    if (tocRefreshTimer.current) clearTimeout(tocRefreshTimer.current);
    tocRefreshTimer.current = setTimeout(() => {
      handleRefreshSections();
    }, 800);
    return () => {
      if (tocRefreshTimer.current) clearTimeout(tocRefreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentState.sourceContent, editMode]);

  // ── Derived values ─────────────────────────────────────────────────────────

  /** The section currently being edited (or null in document mode). */
  const currentSection =
    editMode === "sectioned"
      ? sections.find((s) => s.id === currentSectionId) ?? sections[0] ?? null
      : null;

  /**
   * The content to show in the code editor.  In sectioned mode the outer
   * division wrapper is stripped so the user edits inner content only.
   */
  const activeSourceContent = (() => {
    if (editMode === "sectioned" && currentSection) {
      return isLatexDoc
        ? stripLatexSectionWrapper(currentSection.content, currentSection.type)
        : stripSectionWrapper(currentSection.content);
    }
    return contentState.sourceContent;
  })();

  // ── Mode switching ─────────────────────────────────────────────────────────

  /** Switch to the given mode, splitting or merging the document as needed. */
  const switchEditMode = (newMode: "document" | "sectioned") => {
    if (newMode === "sectioned" && !supportsSectioned) return;
    if (newMode === "sectioned" && editMode === "document") {
      const toSplit = isLatexDoc
        ? contentState.sourceContent
        : contentState.sourceFormat === "pretext"
        ? contentState.sourceContent
        : contentState.pretextSource ?? "";
      const { wrapper, sections: split } = isLatexDoc
        ? splitLatexDocument(toSplit)
        : splitDocument(toSplit);
      // If the document has no sections, stay in document mode.
      if (split.length === 0) return;
      setDocumentWrapper(wrapper);
      setSections(split);
      // Navigate to the pending section (by title) if requested
      if (pendingNavTitle.current) {
        const target = split.find((s) => s.title === pendingNavTitle.current);
        setCurrentSectionId(target?.id ?? split[0]?.id ?? null);
        pendingNavTitle.current = null;
      } else {
        setCurrentSectionId(split[0]?.id ?? null);
      }
    } else if (newMode === "document" && editMode === "sectioned") {
      const merged = doMerge(sections);
      onContentUpdate(merged);
    }
    setInternalEditMode(newMode);
    onEditModeChange?.(newMode);
  };

  /**
   * When a section is clicked while in document mode, switch to sectioned mode
   * and navigate to that section.
   */
  const handleSelectSectionInDocMode = (id: string) => {
    const section = sections.find((s) => s.id === id);
    pendingNavTitle.current = section?.title ?? null;
    switchEditMode("sectioned");
  };

  // ── Section content update ─────────────────────────────────────────────────

  /**
   * Handle a content change originating from within sectioned mode.
   * Re-wraps the inner content with the outer division tag, updates sections
   * state, fires callbacks, and propagates the merged full document.
   */
  const updateSectionContent = (newContent: string | undefined) => {
    if (!currentSection) return;
    // Markdown documents don't support sectioned editing
    if (contentState.sourceFormat === "markdown") return;
    const inner = newContent || "";
    const wrapped = isLatexDoc
      ? rewrapLatexSection(
          inner,
          currentSection.type,
          currentSection.title,
          currentSection.content,
        )
      : rewrapSection(inner, currentSection.type);
    if (wrapped === currentSection.content) return;
    const updatedSection: DocumentSection = {
      ...currentSection,
      content: wrapped,
    };
    const nextSections = sections.map((s) =>
      s.id === currentSection.id ? updatedSection : s,
    );
    setSections(nextSections);
    onSectionChange?.(updatedSection);
    try {
      const merged = doMerge(nextSections);
      onContentUpdate(merged);
    } catch {
      // Section XML is currently invalid (e.g. user is mid-edit of a tag name).
      // Keep the section content updated in state, but don't attempt to re-merge
      // the broken XML into the full document — it will sync when fixed.
    }
  };

  // ── TOC action handlers ────────────────────────────────────────────────────

  /**
   * Wrap the entire current document content as a single section and switch
   * to sectioned editing mode.  Called when the user adds a section to a
   * document that has none.
   */
  const handleAddFirstSection = () => {
    if (!supportsSectioned) return;
    const { wrapper, sections: wrapped } = isLatexDoc
      ? wrapLatexDocumentAsSection(contentState.sourceContent)
      : wrapDocumentAsSection(contentState.sourceContent);
    setDocumentWrapper(wrapper);
    setSections(wrapped);
    setCurrentSectionId(wrapped[0]?.id ?? null);
    const merged = doMerge(wrapped, wrapper);
    onContentUpdate(merged);
    setInternalEditMode("sectioned");
    onEditModeChange?.("sectioned");
  };

  const handleAddSection = (afterId: string | null) => {
    if (!supportsSectioned) return;
    // When the document has no sections yet, wrap the whole content first.
    if (sections.length === 0) {
      handleAddFirstSection();
      return;
    }
    const newSec = isLatexDoc ? createNewLatexSection() : createNewSection();
    let nextSections: DocumentSection[];
    if (afterId === null) {
      // Insert before any conclusion, otherwise at the end.
      const conclusionIdx = sections.findIndex((s) => s.type === "conclusion");
      if (conclusionIdx !== -1) {
        nextSections = [
          ...sections.slice(0, conclusionIdx),
          newSec,
          ...sections.slice(conclusionIdx),
        ];
      } else {
        nextSections = [...sections, newSec];
      }
    } else {
      const idx = sections.findIndex((s) => s.id === afterId);
      nextSections = [
        ...sections.slice(0, idx + 1),
        newSec,
        ...sections.slice(idx + 1),
      ];
    }
    setSections(nextSections);
    setCurrentSectionId(newSec.id);
    onSectionsChange?.(nextSections);
    onContentUpdate(doMerge(nextSections));
  };

  const handleAddIntroduction = () => {
    if (!supportsSectioned) return;
    if (sections.some((s) => s.type === "introduction")) return;
    const intro = isLatexDoc ? createLatexIntroduction() : createIntroduction();
    const nextSections = [intro, ...sections];
    setSections(nextSections);
    setCurrentSectionId(intro.id);
    onSectionsChange?.(nextSections);
    onContentUpdate(doMerge(nextSections));
  };

  const handleAddConclusion = () => {
    if (!supportsSectioned) return;
    if (sections.some((s) => s.type === "conclusion")) return;
    const conc = isLatexDoc ? createLatexConclusion() : createConclusion();
    const nextSections = [...sections, conc];
    setSections(nextSections);
    setCurrentSectionId(conc.id);
    onSectionsChange?.(nextSections);
    onContentUpdate(doMerge(nextSections));
  };

  const handleRemoveSection = (id: string) => {
    if (!supportsSectioned) return;
    const nextSections = sections.filter((s) => s.id !== id);
    setSections(nextSections);
    if (currentSectionId === id) {
      setCurrentSectionId(nextSections[0]?.id ?? null);
    }
    // If all sections are gone, switch back to document mode automatically.
    if (nextSections.length === 0 && editMode === "sectioned") {
      onContentUpdate(doMerge(nextSections));
      setInternalEditMode("document");
      onEditModeChange?.("document");
    } else {
      onSectionsChange?.(nextSections);
      onContentUpdate(doMerge(nextSections));
    }
  };

  /**
   * Update a section's title, type, xml:id, and/or label from the TOC editor.
   */
  const handleUpdateSectionMetadata = (
    id: string,
    changes: {
      title?: string;
      type?: DocumentSection["type"];
      xmlId?: string | null;
      label?: string | null;
    },
  ) => {
    if (!supportsSectioned) return;
    const nextSections = sections.map((s) => {
      if (s.id !== id) return s;
      if (isLatexDoc) {
        // LaTeX documents: only title is editable via the metadata form.
        const newTitle = changes.title ?? s.title;
        return {
          ...s,
          title: newTitle,
          content: updateLatexSectionTitle(s.content, newTitle),
        };
      }
      return updateSectionMetadata(s, changes);
    });
    setSections(nextSections);
    const updated = nextSections.find((s) => s.id === id);
    if (updated) onSectionChange?.(updated);
    onSectionsChange?.(nextSections);
    onContentUpdate(doMerge(nextSections));
  };

  const handleReorderSections = (nextSections: DocumentSection[]) => {
    if (!supportsSectioned) return;
    setSections(nextSections);
    onSectionsChange?.(nextSections);
    onContentUpdate(doMerge(nextSections));
  };

  /**
   * Merge the section with `sourceId` into its successor section `targetId`.
   * The merged section keeps the title and id of the target.
   */
  const handleMergeSection = (sourceId: string, targetId: string) => {
    if (!supportsSectioned) return;
    const sourceIdx = sections.findIndex((s) => s.id === sourceId);
    const targetIdx = sections.findIndex((s) => s.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const merged = mergeTwoSections(
      sections[targetIdx],
      sections[sourceIdx],
      isLatexDoc,
    );
    const nextSections = sections
      .filter((s) => s.id !== sourceId)
      .map((s) => (s.id === targetId ? merged : s));
    setSections(nextSections);
    if (currentSectionId === sourceId) {
      setCurrentSectionId(merged.id);
    }
    onSectionsChange?.(nextSections);
    onContentUpdate(doMerge(nextSections));
  };

  return {
    editMode,
    sections,
    currentSectionId,
    setCurrentSectionId,
    documentWrapper,
    currentSection,
    isTocCollapsed,
    setIsTocCollapsed,
    activeSourceContent,
    updateSectionContent,
    handleRefreshSections,
    switchEditMode,
    handleSelectSectionInDocMode,
    handleAddFirstSection,
    handleAddSection,
    handleAddIntroduction,
    handleAddConclusion,
    handleRemoveSection,
    handleUpdateSectionMetadata,
    handleReorderSections,
    handleMergeSection,
  };
}
