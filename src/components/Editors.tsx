import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CodeEditor from "./CodeEditor";
import { VisualEditor } from "@pretextbook/visual-editor";
import FullPreview, { type FullPreviewHandle } from "./FullPreview";
import LatexImportDialog from "./LatexImportDialog";
import ConvertToPretextDialog from "./ConvertToPretextDialog";
import DocinfoEditor from "./DocinfoEditor";
import FeedbackLink from "./FeedbackLink";
import MenuBar from "./MenuBar";
import TableOfContents from "./TableOfContents";
import { useBookChapters } from "./toc/useBookChapters";
import { useSectionedEditing } from "./useSectionedEditing";
import "./Editors.css";

import { derivePretextContent } from "../contentConversion";
import { defaultContent } from "../defaultContent";
import type {
  EditorContentChange,
  EditorContentState,
  FeedbackSubmission,
  PretextProjectCopyRequest,
  SourceFormat,
} from "../types/editor";
import type { DocumentSection, DocumentChapter } from "../types/sections";

const startingContent = defaultContent;

export interface editorProps {
  /** The source content string (PreTeXt XML, LaTeX, or Markdown). */
  source: string;
  /**
   * The format of `source`.  Defaults to `"pretext"` when omitted.
   * When set to `"latex"`, the editor displays a LaTeX code editor, `"markdown"` displays a Markdown code editor, and
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
   * Optional user-level common docinfo/preamble that project docinfo can import.
   */
  commonDocinfo?: string;
  /**
   * Whether this project should use the user's common docinfo/preamble.
   */
  useCommonDocinfo?: boolean;
  /**
   * Called when the project-level "use common docinfo" choice changes.
   */
  onUseCommonDocinfoChange?: (value: boolean) => void;
  /**
   * Called when the user edits their common docinfo from the project dialog.
   */
  onCommonDocinfoChange?: (value: string) => void;
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
  /** Called when a user submits feedback from any built-in feedback link. */
  onFeedbackSubmit?: (feedback: FeedbackSubmission) => void | Promise<void>;
  /** Optional URL for the current project, included in feedback submissions. */
  projectUrl?: string;
  /**
   * Called when user confirms creating a new project copy from LaTeX using
   * converted PreTeXt source.
   */
  onCreatePretextProjectCopy?: (
    request: PretextProjectCopyRequest,
  ) => void | Promise<void>;
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
   * (uncontrolled).  "document" can also mean a single chapter in a book project.
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
  /**
   * Whether this is an `"article"` (default) or `"book"` project.
   * When `"book"`, the TOC shows a chapter list that expands to show sections.
   */
  projectType?: "article" | "book";
  /**
   * Book chapter summaries used to populate the TOC chapter list.
   * Only meaningful when `projectType === "book"`.
   */
  chapters?: DocumentChapter[];
  /**
   * The id of the currently loaded/active chapter.
   * Only meaningful when `projectType === "book"`.
   */
  currentChapterId?: string | null;
  /**
   * Called when the user clicks a chapter in the TOC.
   * The host should fetch that chapter's source from the server and update
   * the `source` and `currentChapterId` props accordingly.
   */
  onChapterSelect?: (chapterId: string) => void;
  /**
   * Called when the user drags chapters into a new order.
   * Receives the full reordered `DocumentChapter[]`; the host is responsible
   * for persisting the new order (e.g., via a Rails PATCH request).
   * When omitted, chapter drag handles are hidden.
   */
  onChaptersReorder?: (chapters: DocumentChapter[]) => void;
  /**
   * Called when the editor needs a chapter's `content` and the chapter
   * doesn't already have it.  The host should fetch the chapter source
   * from the back-end and update the `chapters` prop with the loaded
   * `content` for that id.  Wired up in a later phase.
   */
  onChapterRequestLoad?: (chapterId: string) => void;
  /**
   * Called whenever a chapter's `content` changes from within the editor
   * (direct content edit, section reorder, or a section moved in/out of
   * this chapter).  The host is responsible for persisting the change.
   * Wired up in a later phase.
   */
  onChapterContentChange?: (chapterId: string, content: string) => void;
  /**
   * Called when the user clicks the "+ Add chapter" row at the bottom
   * of the chapter list.  The host should create a new chapter record
   * on the back-end and append it to the `chapters` array.
   * `afterChapterId` is the id of the chapter immediately preceding the
   * insertion point, or `null` to append at the end of the list.
   */
  onChapterAdd?: (afterChapterId: string | null) => void;
  /**
   * Called when the user removes a chapter from the TOC.  The host
   * should delete the corresponding back-end record and update the
   * `chapters` array accordingly.  Wired up in a later phase.
   */
  onChapterRemove?: (chapterId: string) => void;
  /**
   * Called when the user edits a chapter's title or other metadata
   * (xml:id, label).  Wired up in a later phase.
   */
  onChapterUpdate?: (
    chapterId: string,
    changes: { title?: string; xmlId?: string | null; label?: string | null },
  ) => void;
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
 *
 * Sectioned-editing state (section list, current section, TOC handlers, etc.)
 * is delegated to {@link useSectionedEditing}.
 */
const Editors = (props: editorProps) => {
  const { source, sourceFormat, pretextSource } = props;
  const contentState: EditorContentState = useMemo(
    () =>
      createEditorContentState({
        source,
        sourceFormat,
        pretextSource,
      }),
    [source, sourceFormat, pretextSource],
  );

  // ── UI state ───────────────────────────────────────────────────────────────
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
  const [internalCommonDocinfo, setInternalCommonDocinfo] = useState(
    props.commonDocinfo ?? "",
  );
  const [internalUseCommonDocinfo, setInternalUseCommonDocinfo] = useState(
    props.useCommonDocinfo ?? false,
  );

  const editorTabId = "pretext-plus-tab-editor";
  const previewTabId = "pretext-plus-tab-preview";
  const tabPanelId = "pretext-plus-tabpanel";
  const fullPreviewRef = useRef<FullPreviewHandle>(null);

  // ── Content update callback ────────────────────────────────────────────────
  /**
   * Called by either sub-editor when the user changes the source content.
   * Re-derives the PreTeXt content (or records an error) then propagates the
   * full state snapshot to the host via `onContentChange`.
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
      docinfo: props.docinfo ?? internalDocinfo,
      commonDocinfo: props.commonDocinfo ?? internalCommonDocinfo,
      useCommonDocinfo: props.useCommonDocinfo ?? internalUseCommonDocinfo,
      ...derivedPretext,
    };
    props.onContentChange(normalizedSourceContent, nextState);
  };

  // ── Sectioned editing ──────────────────────────────────────────────────────
  const {
    editMode,
    sections,
    currentSection,
    currentSectionId,
    setCurrentSectionId,
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
  } = useSectionedEditing({
    contentState,
    controlledEditMode: props.editMode,
    defaultEditMode: props.defaultEditMode,
    onEditModeChange: props.onEditModeChange,
    onSectionsChange: props.onSectionsChange,
    onSectionChange: props.onSectionChange,
    onContentUpdate: updateContentState,
    chapterKey: props.currentChapterId,
  });

  // ── Book-mode chapter state ────────────────────────────────────────────────
  // useBookChapters owns the per-chapter parsed-section map and the set of
  // expanded chapter ids.  When the active chapter changes (currentChapterId),
  // we auto-expand it so behavior matches the pre-refactor "only the active
  // chapter is expanded" baseline.  Phase 3 wires the chevron buttons to
  // toggleChapterExpanded so the set can hold more than one id at a time.
  const bookChapters = useBookChapters({
    chapters: props.chapters ?? [],
  });
  const { expandChapter: _expandChapter } = bookChapters;
  useEffect(() => {
    if (props.projectType !== "book") return;
    if (!props.currentChapterId) return;
    _expandChapter(props.currentChapterId);
  }, [props.projectType, props.currentChapterId, _expandChapter]);

  // ── Sync props → internal state ────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsNarrowScreen(window.innerWidth < 800);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-select the first chapter when a book is loaded with no chapter active.
  const {
    projectType: _projectType,
    chapters: _chapters,
    currentChapterId: _currentChapterId,
    onChapterSelect: _onChapterSelect,
  } = props;
  const _firstChapterId = _chapters?.[0]?.id;
  useEffect(() => {
    if (
      _projectType === "book" &&
      _firstChapterId &&
      !_currentChapterId &&
      _onChapterSelect
    ) {
      _onChapterSelect(_firstChapterId);
    }
  }, [_projectType, _firstChapterId, _currentChapterId, _onChapterSelect]);

  // ── Derived preview content ────────────────────────────────────────────────
  /** In sectioned mode, preview uses the current section; otherwise full doc. */
  const previewContent = (() => {
    if (editMode === "sectioned" && currentSection) {
      if (contentState.sourceFormat === "pretext") {
        // Just the section with its outer division tag — no <pretext>/<article> wrapper.
        return currentSection.content || undefined;
      }
      // For non-PreTeXt sources we fall back to the full converted PreTeXt.
      return contentState.pretextSource ?? undefined;
    }
    return (
      contentState.pretextSource ??
      (contentState.sourceFormat === "pretext"
        ? contentState.sourceContent
        : undefined)
    );
  })();

  const previewUnavailable =
    editMode !== "sectioned" && contentState.pretextError !== undefined;

  // ── Preview rebuild helpers ────────────────────────────────────────────────
  /** Triggers a full-page preview rebuild without saving. */
  const triggerRebuild = () => fullPreviewRef.current?.rebuild();

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

  // ── Convert to PreTeXt ─────────────────────────────────────────────────────
  /**
   * Sends converted PreTeXt content to the host so it can create a new
   * PreTeXt project copy.
   */
  const handleConvertToPretext = () => {
    if (contentState.pretextError) return;
    props.onCreatePretextProjectCopy?.({
      pretextSource: contentState.pretextSource ?? "",
      title,
      projectUrl: props.projectUrl,
    });
  };

  // ── Format-specific flags ──────────────────────────────────────────────────
  const isLatexDoc = contentState.sourceFormat === "latex";
  const isMarkdownDoc = contentState.sourceFormat === "markdown";
  const isNonPretextDoc = isLatexDoc || isMarkdownDoc;

  // ── Build editor sub-components ────────────────────────────────────────────
  const codeEditor = (
    <CodeEditor
      content={activeSourceContent}
      sourceFormat={contentState.sourceFormat}
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
        isNonPretextDoc && props.onCreatePretextProjectCopy
          ? () => setIsConvertDialogOpen(true)
          : undefined
      }
      canConvertToPretext={contentState.pretextError === undefined}
    />
  );

  // `preview` is either the visual editor or the full iframe preview
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
        ? activeSourceContent
        : previewContent || "";
    // The Tiptap visual editor only understands PreTeXt XML.
    const canEditVisually = contentState.sourceFormat === "pretext";
    const editDisabledReason = isMarkdownDoc
      ? "Visual editing is not available for Markdown documents."
      : isLatexDoc
      ? "Visual editing is not available for LaTeX documents."
      : "";
    preview = (
      <VisualEditor
        content={visualContent}
        canEdit={canEditVisually}
        editDisabledReason={editDisabledReason}
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

  // ── TOC sidebar ────────────────────────────────────────────────────────────
  const tocSidebar = isMarkdownDoc ? null : (
    <TableOfContents
      sections={sections}
      currentSectionId={currentSectionId ?? sections[0]?.id ?? null}
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
      onMergeSections={handleMergeSection}
      onAddFirstSection={handleAddFirstSection}
      onRefresh={editMode === "sectioned" ? handleRefreshSections : undefined}
      editMode={editMode}
      onToggleEditMode={() =>
        switchEditMode(editMode === "document" ? "sectioned" : "document")
      }
      readonly={editMode === "document"}
      projectType={props.projectType}
      chapters={props.chapters}
      currentChapterId={props.currentChapterId}
      onChapterSelect={props.onChapterSelect}
      onChaptersReorder={props.onChaptersReorder}
      expandedChapterIds={bookChapters.expandedChapterIds}
      onToggleChapterExpanded={bookChapters.toggleChapterExpanded}
      getChapterParse={bookChapters.getChapterParse}
      onChapterRequestLoad={props.onChapterRequestLoad}
      onChapterAdd={props.onChapterAdd}
      onChapterRemove={props.onChapterRemove}
    />
  );

  // ── Layout ─────────────────────────────────────────────────────────────────
  const narrowTocDrawer = isNarrowScreen && tocSidebar ? (
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
        <div className="pretext-plus-editor__toc-drawer-open">{tocSidebar}</div>
      )}
    </div>
  ) : null;

  let editorDisplays: ReactNode;
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
        feedbackControl={
          props.onFeedbackSubmit ? (
            <FeedbackLink
              label="Give feedback"
              context="main-editor"
              projectUrl={props.projectUrl}
              currentSource={contentState.sourceContent}
              sourceFormat={contentState.sourceFormat}
              title={title}
              onSubmit={props.onFeedbackSubmit}
            />
          ) : undefined
        }
        showPreviewModeToggle={props.onPreviewRebuild !== undefined}
      />
      <div className="pretext-plus-editor__editor-displays">
        {editorDisplays}
        {isLatexDialogOpen ? (
          <LatexImportDialog
            onClose={() => setIsLatexDialogOpen(false)}
            feedbackControl={
              props.onFeedbackSubmit ? (
                <FeedbackLink
                  label="Give feedback on conversion"
                  context="latex-conversion"
                  projectUrl={props.projectUrl}
                  currentSource={contentState.sourceContent}
                  sourceFormat={contentState.sourceFormat}
                  title={title}
                  onSubmit={props.onFeedbackSubmit}
                />
              ) : undefined
            }
          />
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
            showCommonDocinfoControls
            commonDocinfo={props.commonDocinfo ?? internalCommonDocinfo}
            initialUseCommonDocinfo={
              props.useCommonDocinfo ?? internalUseCommonDocinfo
            }
            onClose={(value) => {
              setIsDocinfoEditorOpen(false);
              if (value !== undefined) {
                setInternalDocinfo(value.docinfo);
                setInternalCommonDocinfo(value.commonDocinfo);
                setInternalUseCommonDocinfo(value.useCommonDocinfo);
                props.onCommonDocinfoChange?.(value.commonDocinfo);
                props.onUseCommonDocinfoChange?.(value.useCommonDocinfo);
                props.onContentChange(contentState.sourceContent, {
                  ...contentState,
                  docinfo: value.docinfo,
                  commonDocinfo: value.commonDocinfo,
                  useCommonDocinfo: value.useCommonDocinfo,
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
