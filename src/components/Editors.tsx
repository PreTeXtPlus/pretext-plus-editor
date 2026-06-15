import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CodeEditor, { type CodeEditorHandle } from "./CodeEditor";
import { VisualEditor } from "@pretextbook/visual-editor";
import FullPreview, { type FullPreviewHandle } from "./FullPreview";
import LatexImportDialog from "./LatexImportDialog";
import ConvertToPretextDialog from "./ConvertToPretextDialog";
import DocinfoEditor from "./DocinfoEditor";
import AssetManagerModal from "./AssetManagerModal";
import FeedbackLink from "./FeedbackLink";
import MenuBar from "./MenuBar";
import TableOfContents from "./TableOfContents";
import ErrorBoundary from "./ErrorBoundary";
import { useSectionedEditing } from "./useSectionedEditing";
import "./Editors.css";

import { derivePretextContent } from "../contentConversion";
import { defaultContent } from "../defaultContent";
import type {
  EditorContentChange,
  EditorContentState,
  Asset,
  FeedbackSubmission,
  PretextProjectCopyRequest,
  SourceFormat,
} from "../types/editor";
import type { Division, DivisionType } from "../types/sections";
import {
  createNewSection,
  rewrapSection,
  rewrapLatexSection,
  stripSectionWrapper,
  stripLatexSectionWrapper,
  normalizeSelfClosingRefs,
} from "../sectionUtils";

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
  onSectionsChange?: (sections: Division[]) => void;
  /**
   * Called when the content of a single section is edited.  Only fired in
   * `"sectioned"` mode.
   */
  onSectionChange?: (section: Division) => void;
  /**
   * Whether this is an `"article"` (default) or `"book"` project.
   * When `"book"`, the TOC shows a chapter list that expands to show sections.
   */
  projectType?: "article" | "book";
  // ── Divisions API ────────────────────────────────────────────────────────────
  // When `divisions` is provided the editor operates in "divisions mode":
  // all structural and content state is owned by the host; the editor provides
  // a UI for navigating, editing, and reorganising the flat division pool.
  //
  // Hierarchy is expressed by `<plus:division ref="xmlId"/>` placeholders
  // embedded in parent division content — the editor never reconstructs a
  // full merged document.  When `divisions` is omitted the editor falls back
  // to the legacy `useSectionedEditing` behaviour.

  /**
   * Flat pool of all division records for this project.  Providing this
   * enables divisions mode and bypasses the legacy split/merge path.
   *
   * Hierarchy is implicit: root → parses refs → finds children → recurse.
   * The editor identifies the root division as the one matching
   * `rootDivisionId`, or the first division with type `"book"`, `"article"`,
   * or `"slideshow"`.
   */
  divisions?: Division[];

  /**
   * The `xmlId` of the root division (book, article, or slideshow).
   * When omitted the editor falls back to the first division with a root
   * type (`"book"`, `"article"`, `"slideshow"`).
   */
  rootDivisionId?: string;

  /**
   * The `xmlId` of the division currently open for editing (controlled).
   * When omitted the editor tracks active division internally (uncontrolled).
   */
  activeDivisionId?: string | null;

  /**
   * Called when the user clicks a division in the TOC to open it.
   * The host should update `activeDivisionId`.
   */
  onDivisionSelect?: (xmlId: string) => void;

  /**
   * Called when the user edits the content of the active division.
   * Receives the full rewrapped XML (including outer element tag) so the
   * host can persist it without any further transformation.
   *
   * Also fires when structural edits (drag-reorder, insert orphan) change
   * a *parent* division's content — the `xmlId` identifies which division
   * changed, not necessarily the one being actively edited.
   */
  onDivisionContentChange?: (xmlId: string, content: string) => void;

  /**
   * Called when the user creates a new division via the TOC UI.
   * The host should persist the new record and add it to `divisions`.
   * After adding the division, the caller should also update the parent's
   * content to include a `<plus:division ref="newXmlId"/>` placeholder, which
   * is emitted via `onDivisionContentChange` for the parent.
   */
  onDivisionAdd?: (division: Division) => void;

  /**
   * Called when the user deletes a division via the TOC UI.
   * The host should remove the record from `divisions` and remove any
   * `<plus:* ref="xmlId"/>` placeholders that reference it from parent content.
   * The editor fires `onDivisionContentChange` for the parent before this.
   */
  onDivisionRemove?: (xmlId: string) => void;

  /**
   * Called when the user renames, retypes, or changes the `xml:id` of a
   * division via the inline TOC edit form.
   *
   * When `xmlId` changes the editor also fires `onDivisionContentChange` for
   * every parent division whose content contained a ref to the old id.
   */
  onDivisionUpdate?: (
    xmlId: string,
    changes: {
      title?: string;
      type?: DivisionType;
      xmlId?: string | null;
      sourceFormat?: import("../types/editor").SourceFormat;
      label?: string | null;
    },
  ) => void;

  // ── End divisions API ─────────────────────────────────────────────────────

  /**
   * Assets already associated with this project.  When omitted, the Assets
   * button and modal are hidden entirely.
   */
  projectAssets?: Asset[];
  /**
   * All assets available in the user's library (across all projects).
   * Assets not in `projectAssets` show an "Add to project" affordance.
   * Defaults to `projectAssets` when omitted.
   */
  libraryAssets?: Asset[];
  /** Called after an asset tag is inserted at the cursor. */
  onAssetInsert?: (asset: Asset) => void;
  /** Called when the user picks a library asset not yet in this project. */
  onAssetAddFromLibrary?: (asset: Asset) => Promise<void> | void;
  /** Called when the user uploads an image file. */
  onAssetUpload?: (file: File) => Promise<Asset>;
  /** Called when the user adds an image by URL. */
  onAssetAddUrl?: (url: string, name: string) => Promise<Asset>;
  /** Called when the user creates a new Doenet activity. */
  onCreateDoenet?: (name: string, ref: string) => Promise<Asset>;
  /** Called when the user removes an asset from the project. */
  onAssetRemove?: (asset: Asset) => void;
  /** Called when the asset modal opens to fetch the latest project assets. */
  onLoadAssets?: () => Promise<Asset[]>;
  /** Called when the asset modal opens to fetch the full library asset list. */
  onLoadLibraryAssets?: () => Promise<Asset[]>;
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
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
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
  const codeEditorRef = useRef<CodeEditorHandle>(null);

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
    isBookChapterBody,
    updateChapterBodyContent,
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
    parseError,
  } = useSectionedEditing({
    contentState,
    controlledEditMode: props.editMode,
    defaultEditMode: props.defaultEditMode,
    onEditModeChange: props.onEditModeChange,
    onSectionsChange: props.onSectionsChange,
    onSectionChange: props.onSectionChange,
    onContentUpdate: updateContentState,
  });

  // ── Divisions mode ────────────────────────────────────────────────────────
  // When `props.divisions` is provided the editor is in divisions mode: the
  // host owns all division state; we track which division is active and wire
  // the CRUD callbacks.  When omitted, the legacy `useSectionedEditing` path
  // remains active for backward compatibility.
  const isDivisionsMode = props.divisions !== undefined;

  // Locate the root division (book / article / slideshow).
  const rootDivision =
    props.divisions?.find((d) =>
      props.rootDivisionId
        ? d.xmlId === props.rootDivisionId
        : d.type === "book" || d.type === "article" || d.type === "slideshow",
    ) ??
    props.divisions?.[0] ??
    null;

  // Internal active-division xmlId for uncontrolled usage.
  const [internalActiveDivisionId, setInternalActiveDivisionId] = useState<
    string | null
  >(() => rootDivision?.xmlId ?? null);

  // Controlled prop takes precedence over internal state.
  const activeDivisionId =
    props.activeDivisionId !== undefined
      ? props.activeDivisionId
      : internalActiveDivisionId;

  const activeDivision = isDivisionsMode
    ? (props.divisions?.find((d) => d.xmlId === activeDivisionId) ??
       props.divisions?.[0] ??
       null)
    : null;

  // In divisions mode the format comes from the active division, not the project.
  const activeDivisionFormat =
    activeDivision?.sourceFormat ?? contentState.sourceFormat;

  // Inner body of the active division (outer tag stripped) shown in Monaco.
  const divisionActiveSource = activeDivision
    ? activeDivisionFormat === "latex"
      ? stripLatexSectionWrapper(activeDivision.content, activeDivision.type)
      : stripSectionWrapper(activeDivision.content)
    : contentState.sourceContent;

  // Handler for Monaco changes in divisions mode: rewrap and call back.
  const handleDivisionContentChange = (newContent: string | undefined) => {
    if (!activeDivision) {
      updateContentState(newContent);
      return;
    }
    const inner = newContent || "";
    const wrapped =
      activeDivisionFormat === "latex"
        ? rewrapLatexSection(
            inner,
            activeDivision.type,
            activeDivision.title,
            activeDivision.content,
          )
        : // Collapse any `<plus:* ...></plus:*>` the XML round-trip expanded
          // back to canonical self-closing form so the source stays tidy and
          // the TOC's ref parser keeps matching.
          normalizeSelfClosingRefs(rewrapSection(inner, activeDivision.type));
    if (wrapped === activeDivision.content) return;
    props.onDivisionContentChange?.(activeDivision.xmlId, wrapped);
    props.onContentChange(wrapped, {
      sourceContent: wrapped,
      sourceFormat: activeDivisionFormat,
      pretextSource:
        activeDivisionFormat === "pretext" ? wrapped : undefined,
    });
  };

  // Handler for division select in divisions mode.
  const handleDivisionSelect = (xmlId: string) => {
    setInternalActiveDivisionId(xmlId);
    props.onDivisionSelect?.(xmlId);
  };

  // Handler for adding a new division via the TOC.
  const handleDivisionAdd = () => {
    const newDiv = createNewSection();
    props.onDivisionAdd?.(newDiv);
    setInternalActiveDivisionId(newDiv.xmlId);
  };

  // ── Asset insertion ────────────────────────────────────────────────────────
  const buildAssetSnippet = (asset: Asset): string => {
    if (!asset.ref) return "";
    return `<plus:${asset.kind} ref="${asset.ref}"/>`;
  };

  /**
   * Insert the asset snippet at the Monaco cursor, then notify the host via
   * `onAssetInsert` (optional — useful for host-side analytics or side-effects).
   */
  const handleAssetInsert = (asset: Asset) => {
    const snippet = buildAssetSnippet(asset);
    if (snippet) codeEditorRef.current?.insertAtCursor(snippet);
    props.onAssetInsert?.(asset);
  };

  // ── Sync props → internal state ────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsNarrowScreen(window.innerWidth < 800);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Derived preview content ────────────────────────────────────────────────
  /** In sectioned / divisions mode, preview uses the active division/section. */
  const previewContent = (() => {
    if (isDivisionsMode) {
      if (activeDivision && activeDivisionFormat === "pretext") {
        return activeDivision.content || undefined;
      }
      return contentState.pretextSource ?? undefined;
    }
    const effectiveEditMode = editMode;
    if (effectiveEditMode === "sectioned" && currentSection) {
      if (contentState.sourceFormat === "pretext") {
        return currentSection.content || undefined;
      }
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
    !isDivisionsMode &&
    editMode !== "sectioned" &&
    contentState.pretextError !== undefined;

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
      ref={codeEditorRef}
      content={isDivisionsMode ? divisionActiveSource : activeSourceContent}
      sourceFormat={isDivisionsMode ? activeDivisionFormat : contentState.sourceFormat}
      onChange={
        isDivisionsMode
          ? handleDivisionContentChange
          : editMode === "sectioned"
          ? (c) => updateSectionContent(c)
          : isBookChapterBody
          ? (c) => updateChapterBodyContent(c)
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
      onOpenAssets={
        props.projectAssets !== undefined && contentState.sourceFormat === "pretext"
          ? () => setIsAssetPickerOpen(true)
          : undefined
      }
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
      isDivisionsMode && activeDivision
        ? divisionActiveSource
        : editMode === "sectioned" && currentSection
        ? activeSourceContent
        : previewContent || "";
    const effectiveFormat = isDivisionsMode
      ? activeDivisionFormat
      : contentState.sourceFormat;
    const canEditVisually = effectiveFormat === "pretext";
    const editDisabledReason = effectiveFormat === "markdown"
      ? "Visual editing is not available for Markdown documents."
      : effectiveFormat === "latex"
      ? "Visual editing is not available for LaTeX documents."
      : "";
    preview = (
      <VisualEditor
        content={visualContent}
        canEdit={canEditVisually}
        editDisabledReason={editDisabledReason}
        onChange={(content) => {
          if (isDivisionsMode) {
            handleDivisionContentChange(content);
          } else if (editMode === "sectioned") {
            updateSectionContent(content);
          } else {
            updateContentState(content);
          }
        }}
      />
    );
  }

  // ── TOC sidebar ────────────────────────────────────────────────────────────
  // Hide for markdown with no assets (nothing useful to show).
  const tocSidebar =
    isMarkdownDoc && props.projectAssets === undefined ? null : (
    <TableOfContents
      // ── Legacy (non-divisions) mode props ───────────────────────────────
      sections={sections}
      currentSectionId={currentSectionId ?? sections[0]?.id ?? null}
      isCollapsed={isTocCollapsed}
      onToggleCollapse={() => setIsTocCollapsed((c) => !c)}
      onSelectSection={
        isDivisionsMode
          ? handleDivisionSelect
          : editMode === "sectioned"
          ? setCurrentSectionId
          : handleSelectSectionInDocMode
      }
      onAddSection={isDivisionsMode ? handleDivisionAdd : handleAddSection}
      onAddIntroduction={handleAddIntroduction}
      onAddConclusion={handleAddConclusion}
      onRemoveSection={
        isDivisionsMode
          ? (xmlId) => props.onDivisionRemove?.(xmlId)
          : handleRemoveSection
      }
      onUpdateSection={
        isDivisionsMode
          ? (xmlId, changes) => props.onDivisionUpdate?.(xmlId, changes)
          : handleUpdateSectionMetadata
      }
      onReorderSections={handleReorderSections}
      onMergeSections={isDivisionsMode ? undefined : handleMergeSection}
      onAddFirstSection={isDivisionsMode ? undefined : handleAddFirstSection}
      onRefresh={
        isDivisionsMode || editMode !== "sectioned"
          ? undefined
          : handleRefreshSections
      }
      editMode={isDivisionsMode ? "sectioned" : editMode}
      onToggleEditMode={
        isDivisionsMode
          ? undefined
          : () =>
              switchEditMode(editMode === "document" ? "sectioned" : "document")
      }
      readonly={isDivisionsMode ? false : editMode === "document"}
      projectType={props.projectType}
      parseError={isDivisionsMode ? null : parseError}
      hideSectionList={isMarkdownDoc}
      // ── Divisions mode props ─────────────────────────────────────────────
      divisions={props.divisions}
      rootDivisionId={rootDivision?.xmlId}
      activeDivisionId={activeDivisionId}
      onDivisionContentChange={props.onDivisionContentChange}
      // ── Assets ──────────────────────────────────────────────────────────
      assets={props.projectAssets}
      onAssetInsert={handleAssetInsert}
      onOpenAssetPicker={
        props.projectAssets !== undefined
          ? () => setIsAssetPickerOpen(true)
          : undefined
      }
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
        <ErrorBoundary
          resetKeys={[
            isDivisionsMode ? divisionActiveSource : activeSourceContent,
            activeDivisionId,
          ]}
        >
          {editorDisplays}
        </ErrorBoundary>
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
        {isAssetPickerOpen && props.projectAssets !== undefined ? (
          <AssetManagerModal
            open={isAssetPickerOpen}
            onClose={() => setIsAssetPickerOpen(false)}
            source={activeSourceContent}
            projectAssets={props.projectAssets}
            libraryAssets={props.libraryAssets}
            onLoadAssets={props.onLoadAssets}
            onLoadLibraryAssets={props.onLoadLibraryAssets}
            onAddFromLibrary={props.onAssetAddFromLibrary}
            onUpload={props.onAssetUpload}
            onAddUrl={props.onAssetAddUrl}
            onCreateDoenet={props.onCreateDoenet}
            onRemoveAsset={props.onAssetRemove}
            onInsert={handleAssetInsert}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Editors;
