/**
 * Per-instance Zustand store for the Editors component.
 *
 * ARCHITECTURE NOTE — the store owns the live editing buffer:
 * `createEditorStore(init)` seeds the editing buffer (`divisions`, `title`,
 * `docinfo`, `activeDivisionId`, …) from the host's initial props *once*.
 * After that, the store is authoritative for what's being edited:
 *   • Internal edit actions (`setDivisionContent`, `patchDivision`, `setTitle`,
 *     …) update the store optimistically and the host callbacks are fired
 *     purely as notifications (so the host can persist/autosave).  A host is no
 *     longer required to echo every edit back as new props for it to display.
 *   • Genuine external updates (a save that reconciles server-assigned ids, or
 *     swapping to a different project) still win: Editors.tsx detects when a
 *     controlled prop actually changes since the last render and calls
 *     `applyExternalUpdate()` to overwrite the buffer.  A stale prop that the
 *     host simply never updated is NOT re-applied, so it can't clobber a local
 *     edit.
 *
 * Derived/config fields that are never edited locally (`source`, `sourceFormat`,
 * `projectAssets`, `projectType`, `rootDivisionId`, …) are still mirrored from
 * props every render via `syncState()`.
 *
 * Callback stability: createEditorStore returns a `bindCallbacks` function that
 * EditorsInner calls from useLayoutEffect after every render. Store actions
 * close over an internal mutable bag (`bag.cbs`) rather than React refs, so
 * they are stable while always calling the latest mode-routed callback.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Asset, FeedbackSubmission, SourceFormat } from "../types/editor";
import type { Division, DivisionType } from "../types/sections";
import type { EditDraft } from "../components/toc/types";
import { getSectionAttributes } from "../sectionUtils";

// ── Types ───────────────────────────────────────────────────────────────────

export type DivisionChanges = {
  title?: string;
  type?: DivisionType;
  xmlId?: string | null;
  sourceFormat?: SourceFormat;
  label?: string | null;
};

/**
 * A batch of editing-buffer fields the host has genuinely changed (an external
 * reset).  Only the provided fields are overwritten in the store; omitted
 * fields keep their current — possibly locally edited — value.
 */
export interface ExternalUpdate {
  divisions?: Division[];
  rootDivisionId?: string;
  activeDivisionId?: string | null;
  title?: string;
  docinfo?: string;
  commonDocinfo?: string;
  useCommonDocinfo?: boolean;
}

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
  selectDivision: (id: string) => void;
  addDivision: (afterId: string | null) => void;
  removeDivision: (id: string) => void;
  updateDivision: (id: string, changes: DivisionChanges) => void;
  /** Emit a content change for a specific division (edit or structural reorder). */
  divisionContentChange: (xmlId: string, content: string) => void;
  handleDivisionContentChange: (content: string | undefined) => void;
  assetInsert: (asset: Asset) => void;
  updateTitle: (title: string) => void;
  feedbackSubmit?: (feedback: FeedbackSubmission) => void | Promise<void>;
  insertContentAtCursor?: (content: string) => void;
}

export interface EditorStoreState {
  // ── Data synced from host props ───────────────────────────────────────────

  source: string;
  sourceFormat: SourceFormat;
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

  // Computed flags (re-derived each sync)
  canConvertToPretext: boolean;

  /** The source string currently open in the code editor. */
  activeEditorSource: string;

  /** True when the host passed `onFeedbackSubmit`. Controls whether feedback UI is shown. */
  hasFeedback: boolean;

  // ── UI state owned by the store ────────────────────────────────────────────

  isTocCollapsed: boolean;
  showFullPreview: boolean;
  isNarrowScreen: boolean;
  activeTab: "editor" | "preview";
  isLatexDialogOpen: boolean;
  isConvertDialogOpen: boolean;
  isDocinfoEditorOpen: boolean;
  isAssetPickerOpen: boolean;

  // TOC inline edit form
  editingId: string | null;
  editDraft: EditDraft | null;

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Sync a batch of derived/controlled data from Editors into the store. */
  syncState: (partial: Partial<EditorSyncableState>) => void;

  // ── Authoritative editing-buffer actions ───────────────────────────────────
  /** Apply a genuine external update from the host (host wins). */
  applyExternalUpdate: (partial: ExternalUpdate) => void;
  /** Optimistically set a division's content in the local pool. */
  setDivisionContent: (xmlId: string, content: string) => void;
  /** Optimistically patch a division's metadata (title/type/xml:id/format). */
  patchDivision: (xmlId: string, changes: DivisionChanges) => void;
  /** Optimistically add a division to the local pool (no-op if it exists). */
  addDivisionToPool: (division: Division) => void;
  /** Optimistically remove a division from the local pool. */
  removeDivisionFromPool: (xmlId: string) => void;
  /** Set the active (open-for-editing) division id. */
  setActiveDivisionId: (id: string | null) => void;
  /** Optimistically set the document title. */
  setTitle: (title: string) => void;
  /** Optimistically set the docinfo-related fields together. */
  setDocinfo: (info: {
    docinfo: string;
    commonDocinfo: string;
    useCommonDocinfo: boolean;
  }) => void;

  // UI
  setShowFullPreview: (show: boolean) => void;
  setActiveTab: (tab: "editor" | "preview") => void;
  setIsNarrowScreen: (narrow: boolean) => void;
  setIsTocCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  openModal: (modal: ModalKey) => void;
  closeModal: (modal: ModalKey) => void;

  // TOC section / division actions (stable — delegate to bag.cbs)
  selectSection: (id: string) => void;
  addSection: (afterId: string | null) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, changes: DivisionChanges) => void;
  /** Update a parent division's content after a structural DnD change. */
  divisionContentChange: (xmlId: string, content: string) => void;

  // TOC inline edit form
  startSectionEdit: (section: Division) => void;
  setEditDraft: (draft: EditDraft) => void;
  commitSectionEdit: () => void;
  cancelSectionEdit: () => void;

  // Assets / content
  insertAsset: (asset: Asset) => void;
  insertAtCursor: (content: string) => void;
  updateTitle: (title: string) => void;
  feedbackSubmit: (feedback: FeedbackSubmission) => void;
}

/** The subset of EditorStoreState that Editors.tsx syncs on each render. */
export type EditorSyncableState = Pick<
  EditorStoreState,
  | "source"
  | "sourceFormat"
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
  | "canConvertToPretext"
  | "activeEditorSource"
  | "hasFeedback"
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
  divisions: Division[];
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
      selectDivision: noop,
      addDivision: noop,
      removeDivision: noop,
      updateDivision: noop,
      divisionContentChange: noop,
      handleDivisionContentChange: noop,
      assetInsert: noop,
      updateTitle: noop,
    },
  };

  const store = createStore<EditorStoreState>()((set, get) => ({
    // ── Initial data ───────────────────────────────────────────────────────
    source: init.source,
    sourceFormat: init.sourceFormat,
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
    canConvertToPretext: true,
    activeEditorSource: init.source,
    hasFeedback: false,

    // ── Initial UI state ───────────────────────────────────────────────────
    isTocCollapsed: false,
    showFullPreview: true,
    isNarrowScreen:
      typeof window !== "undefined" ? window.innerWidth < 800 : false,
    activeTab: "editor",
    isLatexDialogOpen: false,
    isConvertDialogOpen: false,
    isDocinfoEditorOpen: false,
    isAssetPickerOpen: false,
    editingId: null,
    editDraft: null,

    // ── Actions ────────────────────────────────────────────────────────────
    syncState: (partial) => set(partial),

    // ── Authoritative editing-buffer actions ─────────────────────────────────
    applyExternalUpdate: (partial) => set(partial),
    setDivisionContent: (xmlId, content) =>
      set((s) => {
        if (!s.divisions) return {};
        let changed = false;
        const divisions = s.divisions.map((d) => {
          if (d.xmlId === xmlId && d.content !== content) {
            changed = true;
            return { ...d, content };
          }
          return d;
        });
        return changed ? { divisions } : {};
      }),
    patchDivision: (xmlId, changes) =>
      set((s) => {
        if (!s.divisions) return {};
        const divisions = s.divisions.map((d) =>
          d.xmlId === xmlId
            ? {
                ...d,
                ...(changes.title !== undefined && { title: changes.title }),
                ...(changes.type !== undefined && { type: changes.type }),
                ...(changes.xmlId != null && { xmlId: changes.xmlId }),
                ...(changes.sourceFormat !== undefined && {
                  sourceFormat: changes.sourceFormat,
                }),
              }
            : d,
        );
        return { divisions };
      }),
    addDivisionToPool: (division) =>
      set((s) => {
        const existing = s.divisions ?? [];
        if (existing.some((d) => d.xmlId === division.xmlId)) return {};
        return { divisions: [...existing, division] };
      }),
    removeDivisionFromPool: (xmlId) =>
      set((s) => ({
        divisions: (s.divisions ?? []).filter((d) => d.xmlId !== xmlId),
      })),
    setActiveDivisionId: (activeDivisionId) => set({ activeDivisionId }),
    setTitle: (title) => set({ title }),
    setDocinfo: ({ docinfo, commonDocinfo, useCommonDocinfo }) =>
      set({ docinfo, commonDocinfo, useCommonDocinfo }),

    setShowFullPreview: (showFullPreview) => set({ showFullPreview: showFullPreview }),
    setActiveTab: (activeTab) => set({ activeTab }),
    setIsNarrowScreen: (isNarrowScreen) => set({ isNarrowScreen }),
    setIsTocCollapsed: (value) =>
      set((s) => ({
        isTocCollapsed:
          typeof value === "function" ? value(s.isTocCollapsed) : value,
      })),
    openModal: (modal) => set({ [modal]: true } as Pick<EditorStoreState, ModalKey>),
    closeModal: (modal) => set({ [modal]: false } as Pick<EditorStoreState, ModalKey>),

    // TOC section / division actions — stable closures that read through bag.cbs
    selectSection: (id) => bag.cbs.selectDivision(id),
    addSection: (afterId) => bag.cbs.addDivision(afterId),
    removeSection: (id) => bag.cbs.removeDivision(id),
    updateSection: (id, changes) => bag.cbs.updateDivision(id, changes),
    divisionContentChange: (xmlId, content) =>
      bag.cbs.divisionContentChange?.(xmlId, content),

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
        bag.cbs.updateDivision(editingId, {
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
    insertAtCursor: (content) => bag.cbs.insertContentAtCursor?.(content),
    updateTitle: (title) => bag.cbs.updateTitle(title),
    feedbackSubmit: (feedback) => bag.cbs.feedbackSubmit?.(feedback),
  }));

  return { store, bindCallbacks: (cbs) => { bag.cbs = cbs; } };
}
