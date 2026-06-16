/**
 * Per-instance Zustand store for the Editors component.
 *
 * ARCHITECTURE NOTE — host data always wins:
 * Editors.tsx syncs all controlled props into the store on every render via
 * syncState(). This means when the host pushes fresh `divisions` (e.g. after a
 * refetchOnWindowFocus), every deep component automatically re-renders with the
 * new data. Never let store mutations "win" over incoming props — always call
 * the host callbacks and let the host's state update propagate back in.
 *
 * Callback stability: createEditorStore returns a `bindCallbacks` function that
 * EditorsInner calls from useLayoutEffect after every render. Store actions
 * close over an internal mutable bag (`bag.cbs`) rather than React refs, so
 * they are stable while always calling the latest mode-routed callback.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Asset, SourceFormat } from "../types/editor";
import type { Division, DivisionType } from "../types/sections";
import type { EditDraft } from "../components/toc/types";
import { getSectionAttributes } from "../sectionUtils";

// ── Types ───────────────────────────────────────────────────────────────────

export type SectionChanges = {
  title?: string;
  type?: DivisionType;
  xmlId?: string | null;
  sourceFormat?: SourceFormat;
  label?: string | null;
};

type ModalKey =
  | "isLatexDialogOpen"
  | "isConvertDialogOpen"
  | "isDocinfoEditorOpen"
  | "isAssetPickerOpen";

/**
 * All callbacks wired by Editors.tsx that deep components need to call.
 * Updated on every render via `callbacksRef.current = { ... }`.
 * Actions in the store call through this ref, so they stay stable even as
 * the callbacks close over changing state.
 */
export interface EditorCallbacks {
  // TOC section / division actions (pre-routed for current mode)
  selectSection: (id: string) => void;
  addSection: (afterId: string | null) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, changes: SectionChanges) => void;
  reorderSections: (sections: Division[]) => void;
  mergeSections?: (sourceId: string, targetId: string) => void;
  addFirstSection?: () => void;
  refresh?: () => void;
  addIntroduction: () => void;
  addConclusion: () => void;
  toggleEditMode?: () => void;
  divisionContentChange?: (xmlId: string, content: string) => void;

  // Content updates
  updateContent: (content: string | undefined) => void;
  updateSectionContent: (content: string | undefined) => void;
  updateChapterBodyContent: (content: string | undefined) => void;
  handleDivisionContentChange: (content: string | undefined) => void;

  // Asset insertion into Monaco cursor
  assetInsert: (asset: Asset) => void;

  // Title
  updateTitle: (title: string) => void;
}

export interface EditorStoreState {
  // ── Data synced from host props + useSectionedEditing ─────────────────────

  source: string;
  sourceFormat: SourceFormat;
  pretextSource: string | undefined;
  pretextError: string | undefined;
  projectAssets: Asset[] | undefined;
  libraryAssets: Asset[] | undefined;
  title: string;
  docinfo: string;
  commonDocinfo: string;
  useCommonDocinfo: boolean;
  projectType: "article" | "book" | undefined;
  projectUrl: string | undefined;

  // Divisions (host-controlled pool)
  divisions: Division[] | undefined;
  rootDivisionId: string | undefined;
  activeDivisionId: string | null;

  // Sections — legacy sectioned-editing mode (from useSectionedEditing)
  sections: Division[];
  currentSectionId: string | null;
  editMode: "document" | "sectioned";
  parseError: string | null;
  activeSourceContent: string;
  isBookChapterBody: boolean;

  // Computed flags (re-derived each sync)
  isDivisionsMode: boolean;
  tocReadonly: boolean;
  hideSectionList: boolean;
  isMarkdownDoc: boolean;
  isLatexDoc: boolean;
  isNonPretextDoc: boolean;
  canConvertToPretext: boolean;

  // ── UI state owned by the store ────────────────────────────────────────────

  isTocCollapsed: boolean;
  showFull: boolean;
  isNarrowScreen: boolean;
  activeTab: "editor" | "preview";
  isLatexDialogOpen: boolean;
  isConvertDialogOpen: boolean;
  isDocinfoEditorOpen: boolean;
  isAssetPickerOpen: boolean;
  internalTitle: string;
  internalDocinfo: string;
  internalCommonDocinfo: string;
  internalUseCommonDocinfo: boolean;

  // TOC inline edit form
  editingId: string | null;
  editDraft: EditDraft | null;

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Sync a batch of derived/controlled data from Editors into the store. */
  syncState: (partial: Partial<EditorSyncableState>) => void;

  // UI
  setShowFull: (show: boolean) => void;
  setActiveTab: (tab: "editor" | "preview") => void;
  setIsNarrowScreen: (narrow: boolean) => void;
  setIsTocCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  openModal: (modal: ModalKey) => void;
  closeModal: (modal: ModalKey) => void;
  setInternalTitle: (title: string) => void;

  // TOC section actions (stable — delegate to callbacksRef)
  selectSection: (id: string) => void;
  addSection: (afterId: string | null) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, changes: SectionChanges) => void;
  reorderSections: (sections: Division[]) => void;
  addIntroduction: () => void;
  addConclusion: () => void;
  /** Merge two sections (legacy mode only — no-ops in divisions mode). */
  mergeSections: (sourceId: string, targetId: string) => void;
  /** Wrap document content into a first section (legacy mode only). */
  addFirstSection: () => void;
  /** Toggle between document / sectioned edit mode (legacy mode only). */
  toggleEditMode: () => void;
  /** Update a parent division's content after a structural DnD change. */
  divisionContentChange: (xmlId: string, content: string) => void;
  /** Refresh sections (only active in legacy sectioned mode, no-ops otherwise). */
  refreshSections: () => void;
  setCurrentSectionId: (id: string | null) => void;

  // TOC inline edit form
  startSectionEdit: (section: Division) => void;
  setEditDraft: (draft: EditDraft) => void;
  commitSectionEdit: () => void;
  cancelSectionEdit: () => void;

  // Assets / content
  insertAsset: (asset: Asset) => void;
  updateTitle: (title: string) => void;
}

/** The subset of EditorStoreState that Editors.tsx syncs on each render. */
export type EditorSyncableState = Pick<
  EditorStoreState,
  | "source"
  | "sourceFormat"
  | "pretextSource"
  | "pretextError"
  | "projectAssets"
  | "libraryAssets"
  | "title"
  | "docinfo"
  | "commonDocinfo"
  | "useCommonDocinfo"
  | "projectType"
  | "projectUrl"
  | "divisions"
  | "rootDivisionId"
  | "activeDivisionId"
  | "sections"
  | "currentSectionId"
  | "editMode"
  | "parseError"
  | "activeSourceContent"
  | "isBookChapterBody"
  | "isDivisionsMode"
  | "tocReadonly"
  | "hideSectionList"
  | "isMarkdownDoc"
  | "isLatexDoc"
  | "isNonPretextDoc"
  | "canConvertToPretext"
  // Internal fallback state that can be updated by Editors on docinfo save
  | "internalDocinfo"
  | "internalCommonDocinfo"
  | "internalUseCommonDocinfo"
>;

// ── Factory ─────────────────────────────────────────────────────────────────

export interface EditorStoreInit {
  source: string;
  sourceFormat: SourceFormat;
  title: string;
  docinfo: string;
  commonDocinfo: string;
  useCommonDocinfo: boolean;
  projectType: "article" | "book" | undefined;
  divisions: Division[] | undefined;
  activeDivisionId: string | null;
}

/** The Zustand vanilla store instance type. */
export type EditorStoreInstance = StoreApi<EditorStoreState>;

/** Return value of createEditorStore. */
export interface EditorStoreHandle {
  /** The Zustand vanilla store — pass to EditorStoreProvider. */
  store: EditorStoreInstance;
  /**
   * Update the mutable callbacks bag.  Call from useLayoutEffect after every
   * render so store actions always invoke the latest mode-routed callbacks.
   */
  bindCallbacks: (cbs: EditorCallbacks) => void;
}

export function createEditorStore(init: EditorStoreInit): EditorStoreHandle {
  // Plain mutable bag — NOT React state.  Not tracked by Zustand, so updating
  // it does not trigger any re-renders.  Store actions close over this object.
  const noop = () => {};
  const bag: { cbs: EditorCallbacks } = {
    cbs: {
      selectSection: noop,
      addSection: noop,
      removeSection: noop,
      updateSection: noop,
      reorderSections: noop,
      addIntroduction: noop,
      addConclusion: noop,
      updateContent: noop,
      updateSectionContent: noop,
      updateChapterBodyContent: noop,
      handleDivisionContentChange: noop,
      assetInsert: noop,
      updateTitle: noop,
    },
  };

  const store = createStore<EditorStoreState>()((set, get) => ({
    // ── Initial data ───────────────────────────────────────────────────────
    source: init.source,
    sourceFormat: init.sourceFormat,
    pretextSource: undefined,
    pretextError: undefined,
    projectAssets: undefined,
    libraryAssets: undefined,
    title: init.title,
    docinfo: init.docinfo,
    commonDocinfo: init.commonDocinfo,
    useCommonDocinfo: init.useCommonDocinfo,
    projectType: init.projectType,
    projectUrl: undefined,
    divisions: init.divisions,
    rootDivisionId: undefined,
    activeDivisionId: init.activeDivisionId,
    sections: [],
    currentSectionId: null,
    editMode: "document",
    parseError: null,
    activeSourceContent: init.source,
    isBookChapterBody: false,
    isDivisionsMode: init.divisions !== undefined,
    tocReadonly: false,
    hideSectionList: false,
    isMarkdownDoc: init.sourceFormat === "markdown",
    isLatexDoc: init.sourceFormat === "latex",
    isNonPretextDoc: init.sourceFormat !== "pretext",
    canConvertToPretext: true,

    // ── Initial UI state ───────────────────────────────────────────────────
    isTocCollapsed: false,
    showFull: true,
    isNarrowScreen:
      typeof window !== "undefined" ? window.innerWidth < 800 : false,
    activeTab: "editor",
    isLatexDialogOpen: false,
    isConvertDialogOpen: false,
    isDocinfoEditorOpen: false,
    isAssetPickerOpen: false,
    internalTitle: init.title,
    internalDocinfo: init.docinfo,
    internalCommonDocinfo: init.commonDocinfo,
    internalUseCommonDocinfo: init.useCommonDocinfo,
    editingId: null,
    editDraft: null,

    // ── Actions ────────────────────────────────────────────────────────────
    syncState: (partial) => set(partial),

    setShowFull: (showFull) => set({ showFull }),
    setActiveTab: (activeTab) => set({ activeTab }),
    setIsNarrowScreen: (isNarrowScreen) => set({ isNarrowScreen }),
    setIsTocCollapsed: (value) =>
      set((s) => ({
        isTocCollapsed:
          typeof value === "function" ? value(s.isTocCollapsed) : value,
      })),
    openModal: (modal) => set({ [modal]: true } as Pick<EditorStoreState, ModalKey>),
    closeModal: (modal) => set({ [modal]: false } as Pick<EditorStoreState, ModalKey>),
    setInternalTitle: (internalTitle) => set({ internalTitle }),

    // TOC section actions — stable closures that read through bag.cbs
    selectSection: (id) => bag.cbs.selectSection(id),
    addSection: (afterId) => bag.cbs.addSection(afterId),
    removeSection: (id) => bag.cbs.removeSection(id),
    updateSection: (id, changes) => bag.cbs.updateSection(id, changes),
    reorderSections: (sections) => bag.cbs.reorderSections(sections),
    addIntroduction: () => bag.cbs.addIntroduction(),
    addConclusion: () => bag.cbs.addConclusion(),
    mergeSections: (sourceId, targetId) =>
      bag.cbs.mergeSections?.(sourceId, targetId),
    addFirstSection: () => bag.cbs.addFirstSection?.(),
    toggleEditMode: () => bag.cbs.toggleEditMode?.(),
    divisionContentChange: (xmlId, content) =>
      bag.cbs.divisionContentChange?.(xmlId, content),
    refreshSections: () => bag.cbs.refresh?.(),
    setCurrentSectionId: (id) => set({ currentSectionId: id }),

    // TOC inline edit form
    startSectionEdit: (section) => {
      const { xmlId, label } = getSectionAttributes(section.content);
      set({
        editingId: section.xmlId,
        editDraft: {
          title: section.title,
          type: section.type as DivisionType,
          xmlId,
          label,
        },
      });
    },
    setEditDraft: (editDraft) => set({ editDraft }),
    commitSectionEdit: () => {
      const { editingId, editDraft } = get();
      if (editingId && editDraft) {
        bag.cbs.updateSection(editingId, {
          title: editDraft.title.trim() || undefined,
          type: editDraft.type,
          xmlId: editDraft.xmlId.trim() || null,
          label: editDraft.label.trim() || null,
        });
      }
      set({ editingId: null, editDraft: null });
    },
    cancelSectionEdit: () => set({ editingId: null, editDraft: null }),

    insertAsset: (asset) => bag.cbs.assetInsert(asset),
    updateTitle: (title) => bag.cbs.updateTitle(title),
  }));

  return { store, bindCallbacks: (cbs) => { bag.cbs = cbs; } };
}
