import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CodeEditor, { type CodeEditorHandle } from "./CodeEditor";
import { VisualEditor } from "@pretextbook/visual-editor";
import FullPreview, { type FullPreviewHandle } from "./FullPreview";
import LatexImportDialog from "./LatexImportDialog";
import ConvertToPretextDialog from "./ConvertToPretextDialog";
import DocinfoEditor from "./DocinfoEditor";
import AssetManagerModal from "./AssetManagerModal";
import MenuBar from "./MenuBar";
import TableOfContents from "./TableOfContents";
import ErrorBoundary from "./ErrorBoundary";
import "./Editors.css";

import { derivePretextContent } from "../contentConversion";
import type {
  EditorContentChange,
  Asset,
  FeedbackSubmission,
  SourceFormat,
} from "../types/editor";
import type { Division, DivisionType } from "../types/sections";
import {
  createNewSection,
  rewrapSection,
  normalizeSelfClosingRefs,
  parseDivisionRefsWithTypes,
  createDivisionWithId,
  wrapDivisionForPreview,
  extractDivisionMetadata,
  extractLatexDivisionTitle,
  findDivisionParent,
  renameDivisionRef,
} from "../sectionUtils";
import {
  createEditorStore,
  type DivisionChanges,
  type EditorCallbacks,
  type EditorStoreHandle,
} from "../store/editorStore";
import { EditorStoreProvider } from "../store/EditorStoreProvider";
import { useEditorStore } from "../store/hooks";

// ── Public prop interface ─────────────────────────────────────────

export interface editorProps {
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
   * Called whenever content changes — a division edit, a structural reorder
   * (which rewrites a parent division's content), or a document-wide docinfo
   * edit.  The single {@link EditorContentChange} payload carries the affected
   * division's `xmlId` along with the derived content state, so the host can
   * update the right record in its divisions pool.
   */
  onContentChange: (change: EditorContentChange) => void;
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
   * @param source - A standalone PreTeXt fragment document for just the
   * active division: wrapped in a synthetic `<pretext>`/`<book>`/`<article>`
   * root (as needed for the division's type) with `<docinfo>` inserted, but
   * with any `<plus:* ref="..."/>` placeholders inside the division left
   * unexpanded. Not the raw division content, and not the full document.
   * @param title - The current document title.
   * @param postToIframe - Helper to post a message into the preview iframe.
   */
  onPreviewRebuild?: (
    source: string,
    title: string,
    postToIframe: (url: string, data: unknown) => void,
  ) => void;
  /**
   * Whether this is an `"article"` (default) or `"book"` project.
   * When `"book"`, the TOC shows a chapter list that expands to show sections.
   */
  projectType?: "article" | "book";
  // ── Divisions API ────────────────────────────────────────────────────────────
  /**
   * Flat pool of all division records for this project.  The editor's content
   * is always sourced from these divisions.
   */
  divisions: Division[];

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

// ── Helper: find the root division for a divisions pool ─────────────────────

const findRootDivision = (
  divisions: Division[],
  rootDivisionId?: string,
): Division | null =>
  divisions.find((d) =>
    rootDivisionId
      ? d.xmlId === rootDivisionId
      : d.type === "book" || d.type === "article" || d.type === "slideshow",
  ) ??
  divisions[0] ??
  null;

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
    const initRootDivision = findRootDivision(
      props.divisions,
      props.rootDivisionId,
    );
    const initActiveId = props.activeDivisionId ?? initRootDivision?.xmlId ?? null;
    const initActive =
      props.divisions.find((d) => d.xmlId === initActiveId) ?? initRootDivision;

    return createEditorStore({
      source: initActive?.content ?? "",
      sourceFormat: initActive?.sourceFormat ?? "pretext",
      title: props.title ?? "Document Title",
      docinfo: props.docinfo ?? "",
      commonDocinfo: props.commonDocinfo ?? "",
      useCommonDocinfo: props.useCommonDocinfo ?? false,
      projectType: props.projectType,
      divisions: props.divisions,
      activeDivisionId: initActiveId,
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

  // ── Store reads (UI state owned by the store) ───────────────────────────
  const showFullPreview = useEditorStore((s) => s.showFullPreview);
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
  const syncState = useEditorStore((s) => s.syncState);

  // ── Authoritative editing buffer (read from the store, not props) ─────────
  // The store owns the live edit after the initial seed.  Reading these here
  // means a local edit displays immediately without the host having to echo
  // anything back as new props.
  const divisions = useEditorStore((s) => s.divisions) ?? [];
  const activeDivisionId = useEditorStore((s) => s.activeDivisionId);
  const title = useEditorStore((s) => s.title);
  const docinfo = useEditorStore((s) => s.docinfo);
  const commonDocinfo = useEditorStore((s) => s.commonDocinfo);
  const useCommonDocinfo = useEditorStore((s) => s.useCommonDocinfo);

  // Editing-buffer mutators (optimistic; host callbacks fire as notifications).
  const applyExternalUpdate = useEditorStore((s) => s.applyExternalUpdate);
  const setDivisionContent = useEditorStore((s) => s.setDivisionContent);
  const patchDivision = useEditorStore((s) => s.patchDivision);
  const addDivisionToPool = useEditorStore((s) => s.addDivisionToPool);
  const removeDivisionFromPool = useEditorStore((s) => s.removeDivisionFromPool);
  const setActiveDivisionId = useEditorStore((s) => s.setActiveDivisionId);
  const setTitle = useEditorStore((s) => s.setTitle);
  const setDocinfo = useEditorStore((s) => s.setDocinfo);

  const fullPreviewRef = useRef<FullPreviewHandle>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);

  // ── Active division (derived from the store's authoritative pool) ─────────
  const rootDivision = findRootDivision(divisions, props.rootDivisionId);

  const activeDivision =
    divisions.find((d) => d.xmlId === activeDivisionId) ??
    divisions[0] ??
    null;

  const activeDivisionFormat = activeDivision?.sourceFormat ?? "pretext";

  // The code editor now shows (and edits) the division's full source,
  // wrapper tag included, rather than a stripped-down body — the wrapper
  // (with its xml:id/label attributes and title) is the source of truth.
  const divisionActiveSource = activeDivision?.content ?? "";

  // ── Content-change emitter ───────────────────────────────────────────────
  // Single channel for every content change: a division edit, a structural
  // reorder, or a docinfo edit.  Always carries the affected division's xmlId.
  // Updates the store's pool optimistically first (so the edit displays without
  // the host echoing it back), then notifies the host.
  const emitContentChange = (
    xmlId: string,
    content: string,
    format: SourceFormat,
    extra?: Partial<EditorContentChange>,
  ) => {
    setDivisionContent(xmlId, content);
    props.onContentChange({
      xmlId,
      sourceContent: content,
      sourceFormat: format,
      pretextSource: format === "pretext" ? content : undefined,
      ...extra,
    });
  };

  // The remaining structural mutations follow the same pattern: update the
  // store's authoritative pool optimistically, then fire the (optional) host
  // callback as a persistence notification.
  const applyDivisionUpdate = (xmlId: string, changes: DivisionChanges) => {
    patchDivision(xmlId, changes);
    props.onDivisionUpdate?.(xmlId, changes);
  };

  const applyDivisionAdd = (division: Division) => {
    addDivisionToPool(division);
    props.onDivisionAdd?.(division);
  };

  const applyDivisionRemove = (xmlId: string) => {
    removeDivisionFromPool(xmlId);
    props.onDivisionRemove?.(xmlId);
  };

  const applyDivisionSelect = (xmlId: string) => {
    setActiveDivisionId(xmlId);
    props.onDivisionSelect?.(xmlId);
  };

  // Lazily convert the active division's source to PreTeXt for the convert
  // dialog.  Only computed when the active division is non-PreTeXt.
  const divisionConvertedPretext = useMemo(() => {
    if (!activeDivision || activeDivisionFormat === "pretext") return undefined;
    const result = derivePretextContent(divisionActiveSource, activeDivisionFormat);
    return result.pretextError ? undefined : result.pretextSource;
  }, [activeDivision, activeDivisionFormat, divisionActiveSource]);

  const handleDivisionContentChange = (newContent: string | undefined) => {
    if (!activeDivision) return;
    // The user now edits the division's full source (wrapper tag included),
    // so it's stored as-is — only the `<plus:* ref="..."/>` placeholder form
    // is normalized, matching what an XML round-trip would otherwise produce.
    const wrapped =
      activeDivisionFormat === "pretext"
        ? normalizeSelfClosingRefs(newContent || "")
        : newContent || "";
    if (wrapped === activeDivision.content) return;
    emitContentChange(activeDivision.xmlId, wrapped, activeDivisionFormat);

    // The source is the source of truth for title/type/xml:id/label: re-derive
    // them from the edited content so the TOC stays in sync even when the
    // dropdown form is never used.  These flow through the apply* wrappers so
    // the store reflects them whether or not the host wired the callbacks.
    if (activeDivisionFormat === "pretext") {
      const meta = extractDivisionMetadata(wrapped);
      if (meta) {
        applyDivisionUpdate(activeDivision.xmlId, {
          title: meta.title,
          type: meta.type,
          xmlId: meta.xmlId || null,
          label: meta.label || null,
        });

        // Keep the parent's <plus:* ref="..."/> placeholder in sync with an
        // xml:id rename or type change, so editing the source doesn't
        // orphan the division from its place in the tree.
        const newXmlId = meta.xmlId || activeDivision.xmlId;
        if (newXmlId !== activeDivision.xmlId || meta.type !== activeDivision.type) {
          const parent = findDivisionParent(divisions, activeDivision.xmlId);
          if (parent) {
            const newParentContent = renameDivisionRef(
              parent.content,
              activeDivision.xmlId,
              newXmlId,
              meta.type,
            );
            if (newParentContent !== parent.content) {
              emitContentChange(parent.xmlId, newParentContent, parent.sourceFormat);
            }
          }
        }

        // Follow an xml:id rename so the user isn't bumped to a different
        // division once the pool re-supplies it under the new id.
        if (meta.xmlId && meta.xmlId !== activeDivision.xmlId) {
          applyDivisionSelect(meta.xmlId);
        }
      }
    } else if (activeDivisionFormat === "latex" && activeDivision.type === "section") {
      const latexTitle = extractLatexDivisionTitle(wrapped);
      if (latexTitle !== null) {
        applyDivisionUpdate(activeDivision.xmlId, { title: latexTitle });
      }
    }

    // Auto-create Division records for any new <plus:TYPE ref="id"/> placeholders
    // that appeared in the edited content but don't yet have a matching division.
    const existingIds = new Set(divisions.map((d) => d.xmlId));
    for (const { xmlId, type } of parseDivisionRefsWithTypes(wrapped)) {
      if (!existingIds.has(xmlId)) {
        applyDivisionAdd(createDivisionWithId(xmlId, type, activeDivisionFormat));
        existingIds.add(xmlId); // prevent duplicates within the same edit
      }
    }
  };

  const handleDivisionSelect = (xmlId: string) => {
    applyDivisionSelect(xmlId);
  };

  const handleDivisionAdd = () => {
    const newDiv = createNewSection();
    applyDivisionAdd(newDiv);
    setActiveDivisionId(newDiv.xmlId);
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

  const isNonPretextDoc = activeDivisionFormat !== "pretext";

  // ── Bind callbacks after every render ────────────────────────────────────
  // Store actions call through the internal bag so they always invoke the
  // latest callbacks (which close over the current render's state/props)
  // without requiring stable identities for any of the callback functions.
  useLayoutEffect(() => {
    bindCallbacks({
      selectDivision: handleDivisionSelect,
      addDivision: () => handleDivisionAdd(),
      removeDivision: (xmlId) => applyDivisionRemove(xmlId),
      updateDivision: (xmlId, changes) => applyDivisionUpdate(xmlId, changes),
      // Structural reorders rewrite a parent division's content; route them
      // through the same unified content-change channel as direct edits.
      divisionContentChange: (xmlId, content) => {
        const division = divisions.find((d) => d.xmlId === xmlId);
        emitContentChange(xmlId, content, division?.sourceFormat ?? "pretext");
      },
      handleDivisionContentChange,
      assetInsert: handleAssetInsert,
      insertContentAtCursor: (content) => codeEditorRef.current?.insertAtCursor(content),
      updateTitle: (value) => {
        setTitle(value);
        props.onTitleChange?.(value);
      },
      feedbackSubmit: props.onFeedbackSubmit,
    });
  });

  // ── Sync derived/config state into store ─────────────────────────────────
  // Only fields that are NEVER edited locally are mirrored from props/derived
  // values on every render — the editing buffer itself (divisions, title,
  // docinfo, activeDivisionId) is owned by the store and handled separately
  // (optimistic edits above + external-update detection below).  `source` /
  // `sourceFormat` track the active division (read by the feedback link).
  useEffect(() => {
    syncState({
      source: divisionActiveSource,
      sourceFormat: activeDivisionFormat,
      projectAssets: props.projectAssets,
      libraryAssets: props.libraryAssets,
      projectType: props.projectType,
      projectUrl: props.projectUrl,
      rootDivisionId: rootDivision?.xmlId,
      canConvertToPretext: divisionConvertedPretext !== undefined,
      activeEditorSource: divisionActiveSource,
      hasFeedback: props.onFeedbackSubmit !== undefined,
    });
  });

  // ── Detect genuine external updates from the host ────────────────────────
  // The store owns the live editing buffer, so we must NOT clobber it with a
  // stale prop the host simply never updated.  A buffer field is pushed into
  // the store only when its controlled prop actually *changed* since the last
  // render (host-initiated) — which is how a real reset (e.g. reconciling
  // server-assigned ids after a save, or switching projects) wins, while a
  // host that ignores the change callbacks keeps its local edits.
  const externalRef = useRef({
    divisions: props.divisions,
    title: props.title,
    docinfo: props.docinfo,
    commonDocinfo: props.commonDocinfo,
    useCommonDocinfo: props.useCommonDocinfo,
    activeDivisionId: props.activeDivisionId,
  });
  useEffect(() => {
    const prev = externalRef.current;
    const update: Parameters<typeof applyExternalUpdate>[0] = {};
    let changed = false;

    if (props.divisions !== prev.divisions) {
      update.divisions = props.divisions;
      const newRoot = findRootDivision(props.divisions, props.rootDivisionId);
      // If the active division no longer exists in the incoming pool, fall back
      // to the root so the editor never points at a missing division.
      if (
        activeDivisionId == null ||
        !props.divisions.some((d) => d.xmlId === activeDivisionId)
      ) {
        update.activeDivisionId = newRoot?.xmlId ?? null;
      }
      changed = true;
    }
    if (props.title !== undefined && props.title !== prev.title) {
      update.title = props.title;
      changed = true;
    }
    if (props.docinfo !== undefined && props.docinfo !== prev.docinfo) {
      update.docinfo = props.docinfo;
      changed = true;
    }
    if (
      props.commonDocinfo !== undefined &&
      props.commonDocinfo !== prev.commonDocinfo
    ) {
      update.commonDocinfo = props.commonDocinfo;
      changed = true;
    }
    if (
      props.useCommonDocinfo !== undefined &&
      props.useCommonDocinfo !== prev.useCommonDocinfo
    ) {
      update.useCommonDocinfo = props.useCommonDocinfo;
      changed = true;
    }
    if (
      props.activeDivisionId !== undefined &&
      props.activeDivisionId !== prev.activeDivisionId
    ) {
      update.activeDivisionId = props.activeDivisionId;
      changed = true;
    }

    if (changed) applyExternalUpdate(update);

    externalRef.current = {
      divisions: props.divisions,
      title: props.title,
      docinfo: props.docinfo,
      commonDocinfo: props.commonDocinfo,
      useCommonDocinfo: props.useCommonDocinfo,
      activeDivisionId: props.activeDivisionId,
    };
  });

  // ── Preview content ──────────────────────────────────────────────────────
  // The docinfo that actually governs rendering: the user's common
  // docinfo/preamble when opted in, otherwise the project's own.  Read from the
  // store's authoritative buffer.
  const effectiveDocinfo = useCommonDocinfo ? commonDocinfo : docinfo;

  // The active division's own tagged XML (outer element included), with no
  // conversion performed here — `divisionConvertedPretext` is already kept
  // up to date for non-PreTeXt divisions.
  const divisionTaggedXml = activeDivision
    ? activeDivisionFormat === "pretext"
      ? activeDivision.content
      : divisionConvertedPretext !== undefined
      ? `<${activeDivision.type} xml:id="${activeDivision.xmlId}">\n<title>${activeDivision.title}</title>\n\n${divisionConvertedPretext}\n</${activeDivision.type}>`
      : undefined
    : undefined;

  const previewContent =
    activeDivision && divisionTaggedXml !== undefined
      ? wrapDivisionForPreview(
          activeDivision.type,
          divisionTaggedXml,
          effectiveDocinfo,
        )
      : undefined;

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
    applyDivisionAdd(newDiv);
  };

  // ── Code editor ──────────────────────────────────────────────────────────
  const codeEditor = (
    <CodeEditor
      ref={codeEditorRef}
      content={divisionActiveSource}
      sourceFormat={activeDivisionFormat}
      onChange={handleDivisionContentChange}
      onRebuild={props.onPreviewRebuild ? triggerRebuild : undefined}
      onSave={triggerSaveAndRebuild}
      onOpenLatexImport={() => openModal("isLatexDialogOpen")}
      onOpenDocinfoEditor={() => openModal("isDocinfoEditorOpen")}
      onOpenConvertToPretext={
        isNonPretextDoc && divisionConvertedPretext !== undefined
          ? () => openModal("isConvertDialogOpen")
          : undefined
      }
      canConvertToPretext={divisionConvertedPretext !== undefined}
      onOpenAssets={
        props.projectAssets !== undefined && activeDivisionFormat === "pretext"
          ? () => openModal("isAssetPickerOpen")
          : undefined
      }
    />
  );

  // ── Preview panel ─────────────────────────────────────────────────────────
  let preview: ReactNode;
  if (showFullPreview && props.onPreviewRebuild) {
    preview = (
      <FullPreview
        ref={fullPreviewRef}
        content={previewContent || ""}
        title={title}
        onRebuild={props.onPreviewRebuild}
      />
    );
  } else {
    const canEditVisually = activeDivisionFormat === "pretext";
    const editDisabledReason =
      activeDivisionFormat === "markdown"
        ? "Visual editing is not available for Markdown documents."
        : activeDivisionFormat === "latex"
        ? "Visual editing is not available for LaTeX documents."
        : "";
    preview = (
      <VisualEditor
        content={divisionActiveSource}
        canEdit={canEditVisually}
        editDisabledReason={editDisabledReason}
        onChange={(content) => handleDivisionContentChange(content)}
      />
    );
  }

  // ── TOC sidebar ──────────────────────────────────────────────────────────
  // Deep data + callbacks come from the store.
  const tocSidebar = (
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

  return (
    <div className="pretext-plus-editor" onKeyDown={handleKeyDown}>
      <MenuBar
        onSaveButton={props.onSaveButton}
        saveButtonLabel={props.saveButtonLabel}
        onCancelButton={props.onCancelButton}
        cancelButtonLabel={props.cancelButtonLabel}
        showPreviewModeToggle={props.onPreviewRebuild !== undefined}
      />
      <div className="pretext-plus-editor__editor-displays">
        <ErrorBoundary resetKeys={[divisionActiveSource, activeDivisionId]}>
          {editorDisplays}
        </ErrorBoundary>
        {isLatexDialogOpen ? (
          <LatexImportDialog onClose={() => closeModal("isLatexDialogOpen")} />
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
            docinfo={docinfo}
            showCommonDocinfoControls
            commonDocinfo={commonDocinfo}
            initialUseCommonDocinfo={useCommonDocinfo}
            onClose={(value) => {
              closeModal("isDocinfoEditorOpen");
              if (value !== undefined) {
                setDocinfo({
                  docinfo: value.docinfo,
                  commonDocinfo: value.commonDocinfo,
                  useCommonDocinfo: value.useCommonDocinfo,
                });
                props.onCommonDocinfoChange?.(value.commonDocinfo);
                props.onUseCommonDocinfoChange?.(value.useCommonDocinfo);
                // Docinfo is document-wide: report it against the root
                // division through the unified content-change channel.
                const docinfoTarget = rootDivision ?? activeDivision;
                emitContentChange(
                  docinfoTarget?.xmlId ?? "",
                  docinfoTarget?.content ?? "",
                  docinfoTarget?.sourceFormat ?? "pretext",
                  {
                    docinfo: value.docinfo,
                    commonDocinfo: value.commonDocinfo,
                    useCommonDocinfo: value.useCommonDocinfo,
                  },
                );
              }
            }}
          />
        ) : null}
        {isAssetPickerOpen && props.projectAssets !== undefined ? (
          <AssetManagerModal
            open={isAssetPickerOpen}
            onClose={() => closeModal("isAssetPickerOpen")}
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
