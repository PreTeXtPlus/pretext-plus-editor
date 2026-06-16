import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
import {
  createEditorStore,
  type EditorCallbacks,
  type EditorStoreHandle,
} from "../store/editorStore";
import { EditorStoreProvider } from "../store/EditorStoreProvider";
import { useEditorStore } from "../store/hooks";

const startingContent = defaultContent;

// ── Public prop interface (unchanged) ─────────────────────────────────────────

export interface editorProps {
  /** The source content string (PreTeXt XML, LaTeX, or Markdown) of the current editor view. */
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
    postToIframe: (url: string, data: unknown) => void,
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
  /**
   * Flat pool of all division records for this project.  Providing this
   * enables divisions mode and bypasses the legacy split/merge path.
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
   */
  onDivisionContentChange?: (xmlId: string, content: string) => void;

  /**
   * Called when the user creates a new division via the TOC UI.
   */
  onDivisionAdd?: (division: Division) => void;

  /**
   * Called when the user deletes a division via the TOC UI.
   */
  onDivisionRemove?: (xmlId: string) => void;

  /**
   * Called when the user renames, retypes, or changes the `xml:id` of a
   * division via the inline TOC edit form.
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

// ── Content state helper ────────────────────────────────────────────────────

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

// ── Outer component: creates store + provides it ───────────────────────────

/**
 * Top-level editor component.  Creates the per-instance Zustand store and
 * wraps the inner component in the store's Context provider.
 */
const Editors = (props: editorProps) => {
  // Store + bindCallbacks are created once per mount via lazy useState.
  // bindCallbacks is a plain function (not a React ref), so passing it during
  // render does not trigger the react-hooks/refs lint rule.
  const [handle] = useState<EditorStoreHandle>(() => {
    const initRootDivision =
      props.divisions?.find((d) =>
        props.rootDivisionId
          ? d.xmlId === props.rootDivisionId
          : d.type === "book" || d.type === "article" || d.type === "slideshow",
      ) ??
      props.divisions?.[0] ??
      null;

    return createEditorStore({
      source: props.source ?? startingContent,
      sourceFormat: props.sourceFormat ?? "pretext",
      title: props.title ?? "Document Title",
      docinfo: props.docinfo ?? "",
      commonDocinfo: props.commonDocinfo ?? "",
      useCommonDocinfo: props.useCommonDocinfo ?? false,
      projectType: props.projectType,
      divisions: props.divisions,
      activeDivisionId: props.activeDivisionId ?? initRootDivision?.xmlId ?? null,
    });
  });

  return (
    <EditorStoreProvider store={handle.store}>
      <EditorsInner {...props} bindCallbacks={handle.bindCallbacks} />
    </EditorStoreProvider>
  );
};

// ── Inner component: all editing logic ────────────────────────────────────

interface EditorsInnerProps extends editorProps {
  bindCallbacks: (cbs: EditorCallbacks) => void;
}

const EditorsInner = (props: EditorsInnerProps) => {
  const { bindCallbacks } = props;
  const { source, sourceFormat, pretextSource } = props;

  // ── Store reads (UI state owned by the store) ───────────────────────────
  const showFull = useEditorStore((s) => s.showFull);
  const setShowFull = useEditorStore((s) => s.setShowFull);
  const isNarrowScreen = useEditorStore((s) => s.isNarrowScreen);
  const setIsNarrowScreen = useEditorStore((s) => s.setIsNarrowScreen);
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const isTocCollapsed = useEditorStore((s) => s.isTocCollapsed);
  const setIsTocCollapsed = useEditorStore((s) => s.setIsTocCollapsed);
  const isLatexDialogOpen = useEditorStore((s) => s.isLatexDialogOpen);
  const isConvertDialogOpen = useEditorStore((s) => s.isConvertDialogOpen);
  const isDocinfoEditorOpen = useEditorStore((s) => s.isDocinfoEditorOpen);
  const isAssetPickerOpen = useEditorStore((s) => s.isAssetPickerOpen);
  const openModal = useEditorStore((s) => s.openModal);
  const closeModal = useEditorStore((s) => s.closeModal);
  const internalTitle = useEditorStore((s) => s.internalTitle);
  const setInternalTitle = useEditorStore((s) => s.setInternalTitle);
  const internalDocinfo = useEditorStore((s) => s.internalDocinfo);
  const internalCommonDocinfo = useEditorStore((s) => s.internalCommonDocinfo);
  const internalUseCommonDocinfo = useEditorStore(
    (s) => s.internalUseCommonDocinfo,
  );
  const syncState = useEditorStore((s) => s.syncState);

  const title = props.title ?? internalTitle;

  const contentState: EditorContentState = useMemo(
    () => createEditorContentState({ source, sourceFormat, pretextSource }),
    [source, sourceFormat, pretextSource],
  );

  const fullPreviewRef = useRef<FullPreviewHandle>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);

  // ── Content update callback ─────────────────────────────────────────────
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

  // ── Sectioned editing ────────────────────────────────────────────────────
  const {
    editMode,
    sections,
    currentSection,
    currentSectionId,
    setCurrentSectionId,
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

  // ── Divisions mode ───────────────────────────────────────────────────────
  const isDivisionsMode = props.divisions !== undefined;

  const rootDivision =
    props.divisions?.find((d) =>
      props.rootDivisionId
        ? d.xmlId === props.rootDivisionId
        : d.type === "book" || d.type === "article" || d.type === "slideshow",
    ) ??
    props.divisions?.[0] ??
    null;

  const [internalActiveDivisionId, setInternalActiveDivisionId] = useState<
    string | null
  >(() => rootDivision?.xmlId ?? null);

  const activeDivisionId =
    props.activeDivisionId !== undefined
      ? props.activeDivisionId
      : internalActiveDivisionId;

  const activeDivision = isDivisionsMode
    ? (props.divisions?.find((d) => d.xmlId === activeDivisionId) ??
       props.divisions?.[0] ??
       null)
    : null;

  const activeDivisionFormat =
    activeDivision?.sourceFormat ?? contentState.sourceFormat;

  const divisionActiveSource = activeDivision
    ? activeDivisionFormat === "latex"
      ? stripLatexSectionWrapper(activeDivision.content, activeDivision.type)
      : stripSectionWrapper(activeDivision.content)
    : contentState.sourceContent;

  // Lazily convert the active division's source to PreTeXt for the convert dialog.
  // Only computed in divisions mode when the active division is non-PreTeXt.
  const divisionConvertedPretext = useMemo(() => {
    if (!isDivisionsMode || !activeDivision || activeDivisionFormat === "pretext") return undefined;
    const result = derivePretextContent(divisionActiveSource, activeDivisionFormat);
    return result.pretextError ? undefined : result.pretextSource;
  }, [isDivisionsMode, activeDivision, activeDivisionFormat, divisionActiveSource]);

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
        : normalizeSelfClosingRefs(rewrapSection(inner, activeDivision.type));
    if (wrapped === activeDivision.content) return;
    props.onDivisionContentChange?.(activeDivision.xmlId, wrapped);
    props.onContentChange(wrapped, {
      sourceContent: wrapped,
      sourceFormat: activeDivisionFormat,
      pretextSource:
        activeDivisionFormat === "pretext" ? wrapped : undefined,
    });
  };

  const handleDivisionSelect = (xmlId: string) => {
    setInternalActiveDivisionId(xmlId);
    props.onDivisionSelect?.(xmlId);
  };

  const handleDivisionAdd = () => {
    const newDiv = createNewSection();
    props.onDivisionAdd?.(newDiv);
    setInternalActiveDivisionId(newDiv.xmlId);
  };

  // ── Asset insertion ─────────────────────────────────────────────────────
  const buildAssetSnippet = (asset: Asset): string => {
    if (!asset.ref) return "";
    return `<plus:${asset.kind} ref="${asset.ref}"/>`;
  };

  const handleAssetInsert = (asset: Asset) => {
    const snippet = buildAssetSnippet(asset);
    if (snippet) codeEditorRef.current?.insertAtCursor(snippet);
    props.onAssetInsert?.(asset);
  };

  // ── Resize listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsNarrowScreen(window.innerWidth < 800);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setIsNarrowScreen]);

  // ── Computed flags ───────────────────────────────────────────────────────
  const isLatexDoc = contentState.sourceFormat === "latex";
  const isMarkdownDoc = contentState.sourceFormat === "markdown";
  const isNonPretextDoc = isLatexDoc || isMarkdownDoc;

  // ── Bind callbacks after every render ────────────────────────────────────
  // Store actions call through the internal bag so they always invoke the
  // latest callbacks (which close over the current render's state/props)
  // without requiring stable identities for any of the callback functions.
  useLayoutEffect(() => {
    bindCallbacks({
      selectSection: isDivisionsMode
        ? handleDivisionSelect
        : editMode === "sectioned"
        ? setCurrentSectionId
        : handleSelectSectionInDocMode,
      addSection: isDivisionsMode ? handleDivisionAdd : handleAddSection,
      removeSection: isDivisionsMode
        ? (xmlId) => props.onDivisionRemove?.(xmlId)
        : handleRemoveSection,
      updateSection: isDivisionsMode
        ? (xmlId, changes) => props.onDivisionUpdate?.(xmlId, changes)
        : handleUpdateSectionMetadata,
      reorderSections: handleReorderSections,
      mergeSections: isDivisionsMode ? undefined : handleMergeSection,
      addFirstSection: isDivisionsMode ? undefined : handleAddFirstSection,
      refresh:
        isDivisionsMode || editMode !== "sectioned"
          ? undefined
          : handleRefreshSections,
      addIntroduction: handleAddIntroduction,
      addConclusion: handleAddConclusion,
      toggleEditMode: isDivisionsMode
        ? undefined
        : () => switchEditMode(editMode === "document" ? "sectioned" : "document"),
      divisionContentChange: props.onDivisionContentChange,
      updateContent: updateContentState,
      updateSectionContent,
      updateChapterBodyContent,
      handleDivisionContentChange,
      assetInsert: handleAssetInsert,
      updateTitle: (value) => {
        setInternalTitle(value);
        props.onTitleChange?.(value);
      },
    });
  });

  // ── Sync controlled/derived state into store ─────────────────────────────
  // These effects ensure the store always mirrors the latest host data so
  // deep components (which read from the store) stay in sync.
  useEffect(() => {
    syncState({
      source: contentState.sourceContent,
      sourceFormat: contentState.sourceFormat,
      pretextSource: contentState.pretextSource,
      pretextError: contentState.pretextError,
      projectAssets: props.projectAssets,
      libraryAssets: props.libraryAssets,
      title,
      docinfo: props.docinfo ?? internalDocinfo,
      commonDocinfo: props.commonDocinfo ?? internalCommonDocinfo,
      useCommonDocinfo: props.useCommonDocinfo ?? internalUseCommonDocinfo,
      projectType: props.projectType,
      projectUrl: props.projectUrl,
      divisions: props.divisions,
      rootDivisionId: rootDivision?.xmlId,
      activeDivisionId,
      sections,
      currentSectionId,
      editMode,
      parseError,
      activeSourceContent: isDivisionsMode
        ? divisionActiveSource
        : activeSourceContent,
      isBookChapterBody,
      isDivisionsMode,
      tocReadonly: isDivisionsMode ? false : editMode === "document",
      hideSectionList: isMarkdownDoc,
      isMarkdownDoc,
      isLatexDoc,
      isNonPretextDoc,
      canConvertToPretext: divisionConvertedPretext !== undefined,
    });
  });

  // ── Preview content ──────────────────────────────────────────────────────
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

  // ── Preview rebuild helpers ──────────────────────────────────────────────
  const triggerRebuild = () => fullPreviewRef.current?.rebuild();
  const triggerSaveAndRebuild = () => {
    props.onSave?.();
    fullPreviewRef.current?.rebuild();
  };

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

  const handleConvertToPretext = () => {
    if (!activeDivision || !divisionConvertedPretext) return;
    const base = createNewSection();
    const wrappedContent = normalizeSelfClosingRefs(
      rewrapSection(divisionConvertedPretext, activeDivision.type),
    );
    const newDiv: Division = {
      id: base.xmlId,
      xmlId: base.xmlId,
      title: activeDivision.title,
      type: activeDivision.type,
      sourceFormat: "pretext",
      content: wrappedContent,
    };
    props.onDivisionAdd?.(newDiv);
  };

  // ── Code editor ──────────────────────────────────────────────────────────
  const codeEditor = (
    <CodeEditor
      ref={codeEditorRef}
      content={isDivisionsMode ? divisionActiveSource : activeSourceContent}
      sourceFormat={
        isDivisionsMode ? activeDivisionFormat : contentState.sourceFormat
      }
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
      onOpenLatexImport={() => openModal("isLatexDialogOpen")}
      onOpenDocinfoEditor={() => openModal("isDocinfoEditorOpen")}
      onOpenConvertToPretext={
        isDivisionsMode && isNonPretextDoc && divisionConvertedPretext !== undefined
          ? () => openModal("isConvertDialogOpen")
          : undefined
      }
      canConvertToPretext={divisionConvertedPretext !== undefined}
      onOpenAssets={
        props.projectAssets !== undefined &&
        contentState.sourceFormat === "pretext"
          ? () => openModal("isAssetPickerOpen")
          : undefined
      }
    />
  );

  // ── Preview panel ─────────────────────────────────────────────────────────
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
    const editDisabledReason =
      effectiveFormat === "markdown"
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

  // ── TOC sidebar ──────────────────────────────────────────────────────────
  // Now only needs the props TableOfContents still requires externally.
  // Deep data + callbacks come from the store.
  const tocSidebar =
    isMarkdownDoc && props.projectAssets === undefined ? null : (
      <TableOfContents
        isCollapsed={isTocCollapsed}
        onToggleCollapse={() => setIsTocCollapsed((c) => !c)}
        onOpenAssetPicker={
          props.projectAssets !== undefined
            ? () => openModal("isAssetPickerOpen")
            : undefined
        }
      />
    );

  // ── Layout ────────────────────────────────────────────────────────────────
  const editorTabId = "pretext-plus-tab-editor";
  const previewTabId = "pretext-plus-tab-preview";
  const tabPanelId = "pretext-plus-tabpanel";

  const narrowTocDrawer =
    isNarrowScreen && tocSidebar ? (
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
            onClose={() => closeModal("isLatexDialogOpen")}
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
        {isConvertDialogOpen && activeDivision && divisionConvertedPretext ? (
          <ConvertToPretextDialog
            sourceContent={divisionActiveSource}
            sourceFormat={activeDivisionFormat}
            pretextSource={divisionConvertedPretext}
            onConfirm={handleConvertToPretext}
            onClose={() => closeModal("isConvertDialogOpen")}
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
              closeModal("isDocinfoEditorOpen");
              if (value !== undefined) {
                syncState({
                  internalDocinfo: value.docinfo,
                  internalCommonDocinfo: value.commonDocinfo,
                  internalUseCommonDocinfo: value.useCommonDocinfo,
                });
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
            onClose={() => closeModal("isAssetPickerOpen")}
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
