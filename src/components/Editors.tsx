import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview, { type FullPreviewHandle } from "./FullPreview";
import LatexImportDialog from "./LatexImportDialog";
import ConvertToPretextDialog from "./ConvertToPretextDialog";
import DocinfoEditor from "./DocinfoEditor";
import MenuBar from "./MenuBar";
import TableOfContents from "./TableOfContents";
import "./Editors.css";

import { derivePretextContent } from "../contentConversion";
import { defaultContent } from "../defaultContent";
import type {
  EditorContentChange,
  EditorContentState,
  SourceFormat,
} from "../types/editor";
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
  wrapSectionAsDocument,
  wrapLatexSectionAsDocument,
} from "../sectionUtils";

const startingContent = defaultContent;

export interface editorProps {
  /** The source content string (PreTeXt XML or LaTeX). */
  source: string;
  /**
   * The format of `source`.  Defaults to `"pretext"` when omitted.
   * When set to `"latex"`, the editor displays a LaTeX code editor and
   * derives a read-only PreTeXt preview via conversion.
   */
  sourceFormat?: SourceFormat;
  /**
   * Pre-computed PreTeXt XML corresponding to `source`.
   * Providing this avoids running the conversion on first render when the
   * host already has a cached result.  Only meaningful when
   * `sourceFormat` is not `"pretext"`.
   */
  pretextSource?: string;
  /**
   * The docinfo element for a pretext document, which can contain macros and similar
   * document wide information.
   */
  docinfo?: string;
  /**
   * Called whenever the source content changes (user edits in the code
   * editor or WYSIWYG editor).
   *
   * @param value - The new source string (`undefined` is passed by Monaco on
   *   certain edge cases; treat it as an empty string).
   * @param meta - The full derived {@link EditorContentChange} state at the
   *   time of the change, including the converted PreTeXt and any error.
   */
  onContentChange: (
    value: string | undefined,
    meta?: EditorContentChange,
  ) => void;
  /** Document title shown in the menu bar title field. */
  title?: string;
  /** Called when the user edits the title field. */
  onTitleChange?: (value: string) => void;
  /** If provided, a Save button is rendered in the menu bar. */
  onSaveButton?: () => void;
  /** Label for the Save button.  Defaults to `"Save"`. */
  saveButtonLabel?: string;
  /** If provided, a Cancel button is rendered in the menu bar. */
  onCancelButton?: () => void;
  /** Label for the Cancel button.  Defaults to `"Cancel"`. */
  cancelButtonLabel?: string;
  /**
   * If provided, `onSave` is called on Ctrl+S in addition to `onSaveButton`.
   * Useful when the host wants a keyboard shortcut to trigger saving without
   * necessarily showing an explicit Save button.
   */
  onSave?: () => void;
  /**
   * If provided, the right-hand panel shows a full iframe-based preview
   * instead of the Tiptap visual editor, and a rebuild button / Ctrl+Enter
   * shortcut become active.
   *
   * @param source - The current PreTeXt XML to render.
   * @param title - The current document title.
   * @param postToIframe - Helper to post a message into the preview iframe.
   */
  onPreviewRebuild?: (
    source: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
  /**
   * Controls the editing mode from the outside.  When provided, the
   * component operates in controlled mode; omit to use internal state
   * (uncontrolled).
   */
  editMode?: "document" | "sectioned";
  /**
   * Initial editing mode for uncontrolled usage.  Defaults to `"document"`.
   */
  defaultEditMode?: "document" | "sectioned";
  /**
   * Called when the user switches between `"document"` and `"sectioned"` mode.
   */
  onEditModeChange?: (mode: "document" | "sectioned") => void;
  /**
   * Called when the section list changes structurally (add, remove, reorder,
   * or rename).  Only fired in `"sectioned"` mode.
   */
  onSectionsChange?: (sections: DocumentSection[]) => void;
  /**
   * Called when the content of a single section is edited.  Only fired in
   * `"sectioned"` mode.
   */
  onSectionChange?: (section: DocumentSection) => void;
}

/**
 * Builds the initial {@link EditorContentState} from the props passed to
 * {@link Editors}.  Runs once per render cycle via `useMemo`.
 *
 * If the source is already PreTeXt, `pretextSource` mirrors `sourceContent`
 * with no conversion.  For other formats the function either uses the
 * caller-supplied `pretextSource` (avoiding redundant work) or runs the
 * conversion via {@link derivePretextContent}.
 */
const createEditorContentState = ({
  source: source,
  sourceFormat,
  pretextSource: pretextSource,
}: Pick<
  editorProps,
  "source" | "sourceFormat" | "pretextSource"
>): EditorContentState => {
  const sourceContent = source ?? startingContent;
  const resolvedSourceFormat = sourceFormat ?? "pretext";
  const derivedPretext =
    resolvedSourceFormat === "pretext"
      ? { pretextSource: sourceContent, pretextError: undefined }
      : pretextSource !== undefined
      ? { pretextSource, pretextError: undefined }
      : derivePretextContent(sourceContent, resolvedSourceFormat);
  return {
    sourceContent,
    sourceFormat: resolvedSourceFormat,
    ...derivedPretext,
  };
};

/**
 * Top-level editor component that wires together the Monaco code editor and
 * the right-hand preview panel (either Tiptap visual editor or full iframe
 * preview).  Also owns the menu bar and responsive layout logic.
 *
 * Content state is derived from props on every render via `useMemo` so the
 * parent always controls the source of truth; the component itself holds no
 * long-lived content state.
 */
const Editors = (props: editorProps) => {
  //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
  const { source: source, sourceFormat, pretextSource: pretextSource } = props;
  const contentState: EditorContentState = useMemo(
    () =>
      createEditorContentState({
        source: source,
        sourceFormat,
        pretextSource: pretextSource,
      }),
    [source, sourceFormat, pretextSource],
  );
  const [internalTitle, setInternalTitle] = useState(
    props.title || "Document Title",
  );
  const title = props.title ?? internalTitle;
  const [showFull, setShowFull] = useState(true);
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth < 800);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [isLatexDialogOpen, setIsLatexDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isDocinfoEditorOpen, setIsDocinfoEditorOpen] = useState(false);
  const [internalDocinfo, setInternalDocinfo] = useState(props.docinfo ?? "");
  const editorTabId = "pretext-plus-tab-editor";
  const previewTabId = "pretext-plus-tab-preview";
  const tabPanelId = "pretext-plus-tabpanel";
  const fullPreviewRef = useRef<FullPreviewHandle>(null);

  // ── Sectioned editing mode state ──────────────────────────────────────────
  const [internalEditMode, setInternalEditMode] = useState<
    "document" | "sectioned"
  >(props.defaultEditMode ?? "document");
  const editMode = props.editMode ?? internalEditMode;

  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [documentWrapper, setDocumentWrapper] = useState<string>("");
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [isTocCollapsed, setIsTocCollapsed] = useState(false);

  // Pending section title to navigate to after a mode switch
  const pendingNavTitle = useRef<string | null>(null);
  // Debounce timer for auto-refreshing the TOC in document mode
  const tocRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate sections on initial mount so TOC works in document mode too
  useEffect(() => {
    const { sourceContent, sourceFormat } = contentState;
    const toSplit = sourceFormat === "latex" ? sourceContent : (
      sourceFormat === "pretext" ? sourceContent : (contentState.pretextSource ?? "")
    );
    if (!toSplit.trim()) return;
    try {
      const { wrapper, sections: split } = sourceFormat === "latex"
        ? splitLatexDocument(toSplit)
        : splitDocument(toSplit);
      setDocumentWrapper(wrapper);
      setSections(split);
      setCurrentSectionId(split[0]?.id ?? null);
    } catch {
      // ignore parse errors; TOC will be empty
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  /**
   * Re-parse the current full document and refresh the sections array.
   * In document mode this keeps the readonly TOC in sync as the user types.
   * In sectioned mode it is only triggered explicitly (refresh button) so the
   * user can split a section they have manually sub-divided.
   *
   * Existing section IDs are re-used where the title matches an existing entry
   * so that the selected section is preserved where possible.
   */
  const handleRefreshSections = () => {
    const isLatex = contentState.sourceFormat === "latex";
    const source = contentState.sourceContent;
    let fresh: DocumentSection[];
    let wrapper: string;
    try {
      ({ wrapper, sections: fresh } = isLatex
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
    props.onSectionsChange?.(remapped);
    // Keep the current section selected if it still exists
    if (
      editMode === "sectioned" &&
      currentSectionId &&
      !remapped.some((s) => s.id === currentSectionId)
    ) {
      setCurrentSectionId(remapped[0]?.id ?? null);
    }
  };

  // In document mode, debounce-refresh the sections whenever the content changes
  // so the readonly TOC stays in sync without a manual refresh.
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

  /** The section currently being edited (or null in document mode). */
  const currentSection =
    editMode === "sectioned"
      ? (sections.find((s) => s.id === currentSectionId) ?? sections[0] ?? null)
      : null;

  /** Switch to the given mode, splitting or merging the document as needed. */
  const switchEditMode = (newMode: "document" | "sectioned") => {
    if (newMode === "sectioned" && editMode === "document") {
      const isLatex = contentState.sourceFormat === "latex";
      const toSplit = isLatex
        ? contentState.sourceContent
        : (contentState.sourceFormat === "pretext"
            ? contentState.sourceContent
            : (contentState.pretextSource ?? ""));
      const { wrapper, sections: split } = isLatex
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
      const merged = contentState.sourceFormat === "latex"
        ? mergeLatexDocument(documentWrapper, sections)
        : mergeDocument(documentWrapper, sections);
      updateContentState(merged);
    }
    setInternalEditMode(newMode);
    props.onEditModeChange?.(newMode);
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

  // ── Derived preview content ───────────────────────────────────────────────
  /** In sectioned mode, preview uses the current section; otherwise full doc. */
  const activeSourceContent =
    editMode === "sectioned" && currentSection
      ? currentSection.content
      : contentState.sourceContent;

  const previewContent = (() => {
    if (editMode === "sectioned" && currentSection) {
      try {
        return contentState.sourceFormat === "pretext"
          ? wrapSectionAsDocument(currentSection, internalDocinfo, title)
          : wrapLatexSectionAsDocument(currentSection, documentWrapper);
      } catch {
        return undefined;
      }
    }
    return contentState.pretextSource ??
      (contentState.sourceFormat === "pretext"
        ? contentState.sourceContent
        : undefined);
  })();

  const previewUnavailable =
    editMode !== "sectioned" && contentState.pretextError !== undefined;

  /** Triggers a full-page preview rebuild without saving. */
  const triggerRebuild = () => {
    fullPreviewRef.current?.rebuild();
  };

  /** Calls the host's `onSave` callback then triggers a preview rebuild. */
  const triggerSaveAndRebuild = () => {
    props.onSave?.();
    fullPreviewRef.current?.rebuild();
  };

  /**
   * Keyboard shortcuts captured at the root editor div:
   * - Ctrl/Cmd+Enter → rebuild preview (when `onPreviewRebuild` is set).
   * - Ctrl/Cmd+S     → save and rebuild.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === "Enter" && props.onPreviewRebuild) {
      e.preventDefault();
      triggerRebuild();
    } else if (isCtrl && e.key === "s") {
      e.preventDefault();
      triggerSaveAndRebuild();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * Called by either sub-editor when the user changes the source content.
   * Re-derives the PreTeXt content (or records an error) then propagates the
   * full state snapshot to the host via `onContentChange`.
   *
   * @param sourceContent - The new raw source string from the editor.
   */
  const updateContentState = (sourceContent: string | undefined) => {
    const normalizedSourceContent = sourceContent || "";
    const derivedPretext =
      contentState.sourceFormat === "pretext"
        ? { pretextSource: normalizedSourceContent, pretextError: undefined }
        : derivePretextContent(
            normalizedSourceContent,
            contentState.sourceFormat,
          );
    const nextState: EditorContentState = {
      sourceContent: normalizedSourceContent,
      sourceFormat: contentState.sourceFormat,
      ...derivedPretext,
    };
    props.onContentChange(normalizedSourceContent, nextState);
  };

  /**
   * Handle a content change that originated from within sectioned mode.
   * Updates the current section, fires callbacks, and propagates the merged
   * full document via `onContentChange`.
   */
  const updateSectionContent = (newContent: string | undefined) => {
    if (!currentSection) return;
    const normalized = newContent || "";
    const isLatex = contentState.sourceFormat === "latex";
    const updatedSection: DocumentSection = {
      ...currentSection,
      content: normalized,
    };
    const nextSections = sections.map((s) =>
      s.id === currentSection.id ? updatedSection : s,
    );
    setSections(nextSections);
    props.onSectionChange?.(updatedSection);
    try {
      const merged = isLatex
        ? mergeLatexDocument(documentWrapper, nextSections)
        : mergeDocument(documentWrapper, nextSections);
      updateContentState(merged);
    } catch {
      // Section XML is currently invalid (e.g. user is mid-edit of a tag name).
      // Keep the section content updated in state, but don't attempt to re-merge
      // the broken XML into the full document — it will sync when fixed.
    }
  };

  /**
   * Promotes the derived PreTeXt content to be the new canonical source,
   * switching `sourceFormat` to `"pretext"`.  Only callable when conversion
   * has succeeded (i.e. `pretextError` is undefined).
   */
  const handleConvertToPretext = () => {
    if (contentState.pretextError) {
      return;
    }
    const convertedPretext = contentState.pretextSource || "";
    const nextState: EditorContentState = {
      sourceContent: convertedPretext,
      sourceFormat: "pretext",
      pretextSource: convertedPretext,
      pretextError: undefined,
    };
    props.onContentChange(convertedPretext, nextState);
  };

  // ── TOC action handlers ───────────────────────────────────────────────────

  const isLatexDoc = contentState.sourceFormat === "latex";

  const doMerge = (secs: DocumentSection[], wrapper = documentWrapper) =>
    isLatexDoc
      ? mergeLatexDocument(wrapper, secs)
      : mergeDocument(wrapper, secs);

  /**
   * Wrap the entire current document content as a single section and switch
   * to sectioned editing mode.  Called when the user adds a section to a
   * document that has none.
   */
  const handleAddFirstSection = () => {
    const { wrapper, sections: wrapped } = isLatexDoc
      ? wrapLatexDocumentAsSection(contentState.sourceContent)
      : wrapDocumentAsSection(contentState.sourceContent);
    setDocumentWrapper(wrapper);
    setSections(wrapped);
    setCurrentSectionId(wrapped[0]?.id ?? null);
    const merged = doMerge(wrapped, wrapper);
    updateContentState(merged);
    setInternalEditMode("sectioned");
    props.onEditModeChange?.("sectioned");
  };

  const handleAddSection = (afterId: string | null) => {
    // When the document has no sections yet, wrap the whole content as one section first.
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
    props.onSectionsChange?.(nextSections);
    const merged = doMerge(nextSections);
    updateContentState(merged);
  };

  const handleAddIntroduction = () => {
    if (sections.some((s) => s.type === "introduction")) return;
    const intro = isLatexDoc ? createLatexIntroduction() : createIntroduction();
    const nextSections = [intro, ...sections];
    setSections(nextSections);
    setCurrentSectionId(intro.id);
    props.onSectionsChange?.(nextSections);
    const merged = doMerge(nextSections);
    updateContentState(merged);
  };

  const handleAddConclusion = () => {
    if (sections.some((s) => s.type === "conclusion")) return;
    const conc = isLatexDoc ? createLatexConclusion() : createConclusion();
    const nextSections = [...sections, conc];
    setSections(nextSections);
    setCurrentSectionId(conc.id);
    props.onSectionsChange?.(nextSections);
    const merged = doMerge(nextSections);
    updateContentState(merged);
  };

  const handleRemoveSection = (id: string) => {
    const nextSections = sections.filter((s) => s.id !== id);
    setSections(nextSections);
    if (currentSectionId === id) {
      setCurrentSectionId(nextSections[0]?.id ?? null);
    }
    // If all sections are gone, switch back to document mode automatically.
    if (nextSections.length === 0 && editMode === "sectioned") {
      const merged = doMerge(nextSections);
      updateContentState(merged);
      setInternalEditMode("document");
      props.onEditModeChange?.("document");
    } else {
      props.onSectionsChange?.(nextSections);
      const merged = doMerge(nextSections);
      updateContentState(merged);
    }
  };

  /**
   * Update a section's title, type, xml:id, and/or label from the TOC editor.
   * Replaces the standalone rename handler for PreTeXt documents.
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
    if (updated) props.onSectionChange?.(updated);
    props.onSectionsChange?.(nextSections);
    const merged = doMerge(nextSections);
    updateContentState(merged);
  };

  const handleReorderSections = (nextSections: DocumentSection[]) => {
    setSections(nextSections);
    props.onSectionsChange?.(nextSections);
    const merged = doMerge(nextSections);
    updateContentState(merged);
  };

  /**
   * Merge the section with the given id into its successor section.
   * The merged section keeps the title and id of the first.
   */
  const handleMergeSection = (id: string) => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1 || idx >= sections.length - 1) return;
    const merged = mergeTwoSections(sections[idx], sections[idx + 1], isLatexDoc);
    const nextSections = [
      ...sections.slice(0, idx),
      merged,
      ...sections.slice(idx + 2),
    ];
    setSections(nextSections);
    if (currentSectionId === sections[idx + 1].id) {
      setCurrentSectionId(merged.id);
    }
    props.onSectionsChange?.(nextSections);
    const mergedDoc = doMerge(nextSections);
    updateContentState(mergedDoc);
  };

  // ── Build editor sub-components ───────────────────────────────────────────

  // Always use the actual source format; for PreTeXt in sectioned mode this
  // remains "pretext" (section content is PreTeXt XML), for LaTeX it stays "latex".
  const editorSourceFormat: SourceFormat = contentState.sourceFormat;

  // In sectioned mode, show the full section content (including the outer
  // <section> / \section{} wrapper) so the user can see and edit the structure.
  const codeEditorContent =
    editMode === "sectioned" && currentSection
      ? currentSection.content
      : contentState.sourceContent;

  const codeEditor = (
    <CodeEditor
      content={codeEditorContent}
      sourceFormat={editorSourceFormat}
      onChange={
        editMode === "sectioned"
          ? (c) => updateSectionContent(c)
          : updateContentState
      }
      onRebuild={props.onPreviewRebuild ? triggerRebuild : undefined}
      onSave={triggerSaveAndRebuild}
      onOpenLatexImport={() => setIsLatexDialogOpen(true)}
      onOpenDocinfoEditor={() => setIsDocinfoEditorOpen(true)}
      onOpenConvertToPretext={
        editMode !== "sectioned" && contentState.sourceFormat === "latex"
          ? () => setIsConvertDialogOpen(true)
          : undefined
      }
      canConvertToPretext={contentState.pretextError === undefined}
    />
  );

  // `preview` will either be the visual editor or the full preview based on `showFull`
  let preview: ReactNode;
  if (previewUnavailable) {
    preview = (
      <div className="pretext-plus-editor__preview-placeholder">
        <p className="pretext-plus-editor__preview-placeholder-title">
          Preview unavailable
        </p>
        <p>
          {contentState.pretextError ||
            "Could not generate PreTeXt preview content."}
        </p>
      </div>
    );
  } else if (showFull && props.onPreviewRebuild) {
    preview = (
      <FullPreview
        ref={fullPreviewRef}
        content={previewContent || ""}
        title={title}
        onRebuild={props.onPreviewRebuild}
      />
    );
  } else {
    const visualContent =
      editMode === "sectioned" && currentSection
        ? currentSection.content
        : (previewContent || "");
    // The Tiptap visual editor only understands PreTeXt XML — disable editing
    // when the document source is LaTeX (either in full-doc or sectioned mode).
    const canEditVisually = contentState.sourceFormat === "pretext";
    preview = (
      <VisualEditor
        content={visualContent}
        canEdit={canEditVisually}
        editDisabledReason={isLatexDoc ? "Visual editing is not available for LaTeX documents." : ""}
        onChange={(content) => {
          if (editMode === "sectioned") {
            updateSectionContent(content);
          } else {
            updateContentState(content);
          }
        }}
      />
    );
  }

  // ── Build the TOC sidebar (sectioned mode only) ────────────────────────────

  const tocSidebar = (
    <TableOfContents
      sections={sections}
      currentSectionId={currentSectionId ?? (sections[0]?.id ?? null)}
      isCollapsed={isTocCollapsed}
      onToggleCollapse={() => setIsTocCollapsed((c) => !c)}
      onSelectSection={
        editMode === "sectioned"
          ? setCurrentSectionId
          : handleSelectSectionInDocMode
      }
      onAddSection={handleAddSection}
      onAddIntroduction={handleAddIntroduction}
      onAddConclusion={handleAddConclusion}
      onRemoveSection={handleRemoveSection}
      onUpdateSection={handleUpdateSectionMetadata}
      onReorderSections={handleReorderSections}
      onMergeWithNext={handleMergeSection}
      onAddFirstSection={handleAddFirstSection}
      onRefresh={editMode === "sectioned" ? handleRefreshSections : undefined}
      editMode={editMode}
      onToggleEditMode={() =>
        switchEditMode(editMode === "document" ? "sectioned" : "document")
      }
      readonly={editMode === "document"}
    />
  );

  // ── Build the editor displays ─────────────────────────────────────────────

  let editorDisplays: ReactNode;

  // On narrow screens: show TOC as a collapsible drawer above the tab layout
  const narrowTocDrawer = isNarrowScreen ? (
    <div className="pretext-plus-editor__toc-drawer">
      {isTocCollapsed ? (
        <button
          type="button"
          className="pretext-plus-editor__toc-drawer-toggle"
          onClick={() => setIsTocCollapsed(false)}
        >
          ☰ Contents
        </button>
      ) : (
        <div className="pretext-plus-editor__toc-drawer-open">
          {tocSidebar}
        </div>
      )}
    </div>
  ) : null;

  if (isNarrowScreen) {
    editorDisplays = (
      <div className="pretext-plus-editor__tabs">
        {narrowTocDrawer}
        <div className="pretext-plus-editor__tab-list" role="tablist">
          <button
            type="button"
            id={editorTabId}
            role="tab"
            aria-controls={tabPanelId}
            aria-selected={activeTab === "editor"}
            tabIndex={activeTab === "editor" ? 0 : -1}
            className={`pretext-plus-editor__tab-button ${
              activeTab === "editor" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            id={previewTabId}
            role="tab"
            aria-controls={tabPanelId}
            aria-selected={activeTab === "preview"}
            tabIndex={activeTab === "preview" ? 0 : -1}
            className={`pretext-plus-editor__tab-button ${
              activeTab === "preview" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("preview")}
          >
            Preview
          </button>
        </div>
        <div
          id={tabPanelId}
          className="pretext-plus-editor__tab-panel"
          role="tabpanel"
          aria-labelledby={activeTab === "editor" ? editorTabId : previewTabId}
        >
          <div style={{ height: "100%" }}>
            {activeTab === "editor" ? codeEditor : preview}
          </div>
        </div>
      </div>
    );
  } else {
    editorDisplays = (
      <div className="pretext-plus-editor__sectioned-layout">
        {tocSidebar}
        <Group
          orientation="horizontal"
          className="pretext-plus-editor__splitter"
        >
          <Panel className="pretext-plus-editor__editor-panel">
            {codeEditor}
          </Panel>
          <Separator className="pretext-plus-editor__resize-handle">
            <div className="pretext-plus-editor__resize-dots"></div>
          </Separator>
          <Panel className="pretext-plus-editor__preview-panel">
            {preview}
          </Panel>
        </Group>
      </div>
    );
  }

  // Suppress unused variable warnings for activeSourceContent in document mode.
  void activeSourceContent;

  return (
    <div className="pretext-plus-editor" onKeyDown={handleKeyDown}>
      <MenuBar
        isChecked={showFull}
        onChange={() => setShowFull(!showFull)}
        title={title}
        onTitleChange={(value) => {
          setInternalTitle(value);
          props.onTitleChange?.(value);
        }}
        onSaveButton={props.onSaveButton}
        saveButtonLabel={props.saveButtonLabel}
        onCancelButton={props.onCancelButton}
        cancelButtonLabel={props.cancelButtonLabel}
        showPreviewModeToggle={props.onPreviewRebuild !== undefined}
      />
      <div className="pretext-plus-editor__editor-displays">
        {editorDisplays}
        {isLatexDialogOpen ? (
          <LatexImportDialog onClose={() => setIsLatexDialogOpen(false)} />
        ) : null}
        {isConvertDialogOpen ? (
          <ConvertToPretextDialog
            latexSource={contentState.sourceContent}
            pretextSource={contentState.pretextSource ?? ""}
            onConfirm={handleConvertToPretext}
            onClose={() => setIsConvertDialogOpen(false)}
          />
        ) : null}
        {isDocinfoEditorOpen ? (
          <DocinfoEditor
            docinfo={props.docinfo ?? internalDocinfo}
            onClose={(value) => {
              setIsDocinfoEditorOpen(false);
              if (value !== undefined) {
                setInternalDocinfo(value);
                props.onContentChange(contentState.sourceContent, {
                  ...contentState,
                  docinfo: value,
                });
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Editors;
