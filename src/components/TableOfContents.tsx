import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import type {
  DocumentChapter,
  DocumentSection,
  DocumentSectionType,
} from "../types/sections";
import { getSectionAttributes } from "../sectionUtils";
import "./TableOfContents.css";

export interface TableOfContentsProps {
  sections: DocumentSection[];
  currentSectionId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSection: (id: string) => void;
  onAddSection: (afterId: string | null) => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
  onRemoveSection: (id: string) => void;
  /**
   * Called when the user commits changes from the inline edit form.
   * `changes` may include a new title, type, xml:id, and/or label.
   */
  onUpdateSection: (
    id: string,
    changes: {
      title?: string;
      type?: DocumentSectionType;
      xmlId?: string | null;
      label?: string | null;
    },
  ) => void;
  onReorderSections: (sections: DocumentSection[]) => void;
  /**
   * Called when the user drags one section onto another to merge them.
   * `sourceId` is appended to the end of `targetId`.
   */
  onMergeSections?: (sourceId: string, targetId: string) => void;
  /**
   * Called when the user wants to convert the (currently unsectioned) document
   * into a single section and switch to sectioned mode.
   */
  onAddFirstSection?: () => void;
  /**
   * Called when the user requests a manual TOC refresh (sectioned mode).
   * Re-parses the merged document to pick up any sub-sections the user
   * added inside the current section.
   */
  onRefresh?: () => void;
  /** Current editing mode */
  editMode: "document" | "sectioned";
  /** Called when the user clicks the "Edit full document" link */
  onToggleEditMode: () => void;
  /** When true (document mode), hide all edit controls */
  readonly?: boolean;
  /**
   * Whether this is an `"article"` (default) or `"book"` project.
   * When `"book"`, chapter items are rendered above the section list.
   */
  projectType?: "article" | "book";
  /**
   * Book chapter summaries provided by the host.
   * Only meaningful when `projectType === "book"`.
   */
  chapters?: DocumentChapter[];
  /**
   * The id of the currently loaded/active chapter.
   * Only meaningful when `projectType === "book"`.
   */
  currentChapterId?: string | null;
  /**
   * Called when the user clicks a chapter to request loading it.
   * The host is responsible for fetching the chapter source and updating
   * the `source` prop accordingly.
   */
  onChapterSelect?: (chapterId: string) => void;
  /**
   * Called when the user drags chapters into a new order.
   * Receives the full reordered `DocumentChapter[]`; the host is responsible
   * for persisting the new order (e.g., via a Rails PATCH request).
   * When omitted, chapter drag handles are hidden and reordering is disabled.
   */
  onChaptersReorder?: (chapters: DocumentChapter[]) => void;
}

const TYPE_LABELS: Record<string, string> = {
  introduction: "Intro",
  conclusion: "Conc",
  section: "§",
  worksheet: "WS",
  handout: "HO",
  exercises: "Ex",
  references: "Ref",
  glossary: "Gls",
  solutions: "Sol",
  "reading-questions": "RQ",
};

/** Returns true for section-level divisions that can be freely reordered. */
function isRegularDivision(type: string): boolean {
  return type !== "introduction" && type !== "conclusion";
}

/** All division types that can appear in the TOC as regular sections. */
const REGULAR_DIVISION_TYPES: DocumentSectionType[] = [
  "section",
  "worksheet",
  "handout",
  "exercises",
  "references",
  "glossary",
  "solutions",
  "reading-questions",
];

const TYPE_FULL_LABELS: Record<string, string> = {
  section: "Section",
  worksheet: "Worksheet",
  handout: "Handout",
  exercises: "Exercises",
  references: "References",
  glossary: "Glossary",
  solutions: "Solutions",
  "reading-questions": "Reading Questions",
  introduction: "Introduction",
  conclusion: "Conclusion",
};

/** Draft state for the inline section edit form. */
interface EditDraft {
  title: string;
  type: DocumentSectionType;
  xmlId: string;
  label: string;
}

// ---------------------------------------------------------------------------
// SortableItem — a single draggable section row
// ---------------------------------------------------------------------------
interface SortableItemProps {
  section: DocumentSection;
  isActive: boolean;
  /** The item is currently being dragged — render as invisible placeholder. */
  isBeingDragged: boolean;
  /** Show a drop-target line above this item. */
  isDropBefore: boolean;
  /** Show a drop-target line below this item. */
  isDropAfter: boolean;
  isMergeTarget: boolean;
  editDraft: EditDraft | null;
  onSelect: () => void;
  onStartEdit: () => void;
  onRemove: () => void;
  onDraftChange: (draft: EditDraft) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  canRemove: boolean;
  readonly: boolean;
  isLatex: boolean;
}

const SortableItem = ({
  section,
  isActive,
  isBeingDragged,
  isDropBefore,
  isDropAfter,
  isMergeTarget,
  editDraft,
  onSelect,
  onStartEdit,
  onRemove,
  onDraftChange,
  onEditCommit,
  onEditCancel,
  canRemove,
  readonly,
  isLatex,
}: SortableItemProps) => {
  const isDraggable = !readonly && isRegularDivision(section.type);
  const isEditing = editDraft !== null;
  const { attributes, listeners, setNodeRef } = useSortable({
    id: section.id,
    disabled: !isDraggable || isEditing,
  });

  const style: React.CSSProperties = isBeingDragged
    ? { opacity: 0, pointerEvents: "none" }
    : {};

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "pretext-plus-editor__toc-item",
        `pretext-plus-editor__toc-item--${section.type}`,
        isActive ? "pretext-plus-editor__toc-item--active" : "",
        isEditing ? "pretext-plus-editor__toc-item--editing" : "",
        isMergeTarget ? "pretext-plus-editor__toc-item--merge-target" : "",
        isDropBefore ? "pretext-plus-editor__toc-item--drop-before" : "",
        isDropAfter ? "pretext-plus-editor__toc-item--drop-after" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Normal row */}
      <div className="pretext-plus-editor__toc-item-row">
        {isDraggable && !isEditing && (
          <span
            className="pretext-plus-editor__toc-drag-handle"
            title="Drag to reorder"
            aria-hidden="true"
            {...attributes}
            {...listeners}
          >
            ⠿
          </span>
        )}

        <span className="pretext-plus-editor__toc-type-badge">
          {TYPE_LABELS[section.type] ?? section.type}
        </span>

        <button
          type="button"
          className="pretext-plus-editor__toc-select"
          onClick={onSelect}
          onDoubleClick={!readonly ? onStartEdit : undefined}
          aria-current={isActive ? "true" : undefined}
          title={
            !readonly ? "Click to edit · Double-click to rename" : undefined
          }
        >
          <span className="pretext-plus-editor__toc-title">
            {section.title || <em>Untitled</em>}
          </span>
        </button>

        {!readonly && (
          <div className="pretext-plus-editor__toc-actions">
            {isRegularDivision(section.type) && !isEditing && (
              <button
                type="button"
                className="pretext-plus-editor__toc-action-btn"
                onClick={onStartEdit}
                title="Edit section properties"
                aria-label={`Edit "${section.title}"`}
              >
                ✎
              </button>
            )}
            <button
              type="button"
              className="pretext-plus-editor__toc-action-btn pretext-plus-editor__toc-action-btn--danger"
              onClick={onRemove}
              disabled={!canRemove}
              title="Remove"
              aria-label={`Remove "${section.title}"`}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Inline edit form */}
      {isEditing && editDraft && (
        <div className="pretext-plus-editor__toc-edit-form">
          <label className="pretext-plus-editor__toc-edit-field">
            <span>Title</span>
            <input
              type="text"
              value={editDraft.title}
              onChange={(e) =>
                onDraftChange({ ...editDraft, title: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditCommit();
                if (e.key === "Escape") onEditCancel();
              }}
              autoFocus
            />
          </label>
          {!isLatex && (
            <>
              <label className="pretext-plus-editor__toc-edit-field">
                <span>Type</span>
                <select
                  value={editDraft.type}
                  onChange={(e) =>
                    onDraftChange({
                      ...editDraft,
                      type: e.target.value as DocumentSectionType,
                    })
                  }
                >
                  {REGULAR_DIVISION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_FULL_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pretext-plus-editor__toc-edit-field">
                <span>xml:id</span>
                <input
                  type="text"
                  value={editDraft.xmlId}
                  placeholder="optional"
                  onChange={(e) =>
                    onDraftChange({ ...editDraft, xmlId: e.target.value })
                  }
                />
              </label>
              <label className="pretext-plus-editor__toc-edit-field">
                <span>label</span>
                <input
                  type="text"
                  value={editDraft.label}
                  placeholder="optional"
                  onChange={(e) =>
                    onDraftChange({ ...editDraft, label: e.target.value })
                  }
                />
              </label>
            </>
          )}
          <div className="pretext-plus-editor__toc-edit-actions">
            <button
              type="button"
              className="pretext-plus-editor__toc-edit-save"
              onClick={onEditCommit}
            >
              Save
            </button>
            <button
              type="button"
              className="pretext-plus-editor__toc-edit-cancel"
              onClick={onEditCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

// ---------------------------------------------------------------------------
// AddSectionItem — inline list item that opens a context-aware add menu
// ---------------------------------------------------------------------------
interface AddSectionItemProps {
  hasIntroduction: boolean;
  hasConclusion: boolean;
  onAddSection: () => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
}

const AddSectionItem = ({
  hasIntroduction,
  hasConclusion,
  onAddSection,
  onAddIntroduction,
  onAddConclusion,
}: AddSectionItemProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const pick = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <li ref={containerRef} className="pretext-plus-editor__toc-add-item">
      <button
        type="button"
        className="pretext-plus-editor__toc-add-item-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Add section"
      >
        + add...
      </button>
      {open && (
        <div className="pretext-plus-editor__toc-add-menu-popup">
          {!hasIntroduction && (
            <button
              type="button"
              className="pretext-plus-editor__toc-add-menu-item"
              onClick={() => pick(onAddIntroduction)}
            >
              Introduction
            </button>
          )}
          <button
            type="button"
            className="pretext-plus-editor__toc-add-menu-item"
            onClick={() => pick(onAddSection)}
          >
            Section
          </button>
          {!hasConclusion && (
            <button
              type="button"
              className="pretext-plus-editor__toc-add-menu-item"
              onClick={() => pick(onAddConclusion)}
            >
              Conclusion
            </button>
          )}
        </div>
      )}
    </li>
  );
};

// ---------------------------------------------------------------------------
// ChapterItem — a sortable chapter row (book mode)
// ---------------------------------------------------------------------------
interface ChapterItemProps {
  chapter: DocumentChapter;
  isActive: boolean;
  isExpanded: boolean;
  /** When true a drag handle is shown and the item participates in DnD. */
  canReorder: boolean;
  /** The item is being dragged — render as invisible placeholder. */
  isBeingDragged: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}

const ChapterItem = ({
  chapter,
  isActive,
  isExpanded,
  canReorder,
  isBeingDragged,
  onSelect,
  children,
}: ChapterItemProps) => {
  const { attributes, listeners, setNodeRef } = useSortable({
    id: chapter.id,
    disabled: !canReorder,
  });

  return (
    <li
      ref={setNodeRef}
      style={isBeingDragged ? { opacity: 0, pointerEvents: "none" } : {}}
      className={[
        "pretext-plus-editor__toc-chapter-item",
        isActive ? "pretext-plus-editor__toc-chapter-item--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pretext-plus-editor__toc-chapter-row">
        {canReorder && (
          <span
            className="pretext-plus-editor__toc-drag-handle pretext-plus-editor__toc-chapter-drag-handle"
            title="Drag to reorder chapter"
            aria-hidden="true"
            {...attributes}
            {...listeners}
          >
            ⠿
          </span>
        )}
        <span
          className="pretext-plus-editor__toc-chapter-expand"
          aria-hidden="true"
        >
          {isExpanded ? "▾" : "›"}
        </span>
        <button
          type="button"
          className="pretext-plus-editor__toc-chapter-btn"
          onClick={onSelect}
          aria-current={isActive ? "true" : undefined}
          aria-expanded={isExpanded}
          title={
            isActive
              ? `Chapter loaded: ${chapter.title}`
              : `Load chapter: ${chapter.title}`
          }
        >
          <span className="pretext-plus-editor__toc-type-badge pretext-plus-editor__toc-type-badge--chapter">
            Ch
          </span>
          <span className="pretext-plus-editor__toc-title">
            {chapter.title || <em>Untitled chapter</em>}
          </span>
        </button>
      </div>
      {isExpanded && children && (
        <div className="pretext-plus-editor__toc-chapter-sections">
          {children}
        </div>
      )}
    </li>
  );
};

// ---------------------------------------------------------------------------
// Main TableOfContents component
// ---------------------------------------------------------------------------
const TableOfContents = (props: TableOfContentsProps) => {
  const {
    sections,
    currentSectionId,
    isCollapsed,
    onToggleCollapse,
    onSelectSection,
    onAddSection,
    onAddIntroduction,
    onAddConclusion,
    onRemoveSection,
    onUpdateSection,
    onReorderSections,
    onMergeSections,
    onAddFirstSection,
    onRefresh,
    editMode,
    onToggleEditMode,
    readonly = false,
    projectType = "article",
    chapters = [],
    currentChapterId,
    onChapterSelect,
    onChaptersReorder,
  } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentOverIdRef = useRef<string | null>(null);
  const isLatex = sections.some((s) => !s.content.trimStart().startsWith("<"));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const hasIntroduction = sections.some((s) => s.type === "introduction");
  const hasConclusion = sections.some((s) => s.type === "conclusion");

  // ---------------------------------------------------------------------------
  // Edit helpers
  // ---------------------------------------------------------------------------
  const startEdit = (section: DocumentSection) => {
    const { xmlId, label } = getSectionAttributes(section.content);
    setEditingId(section.id);
    setEditDraft({
      title: section.title,
      type: section.type as DocumentSectionType,
      xmlId,
      label,
    });
  };

  const commitEdit = () => {
    if (editingId && editDraft) {
      onUpdateSection(editingId, {
        title: editDraft.title.trim() || undefined,
        type: editDraft.type,
        xmlId: editDraft.xmlId.trim() || null,
        label: editDraft.label.trim() || null,
      });
    }
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleRemove = (section: DocumentSection) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      onRemoveSection(section.id);
    }
  };

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  const clearDragState = () => {
    if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    mergeTimerRef.current = null;
    currentOverIdRef.current = null;
    setActiveId(null);
    setDropTarget(null);
    setMergeTargetId(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropTarget(null);
    setMergeTargetId(null);
    currentOverIdRef.current = null;
    // Close any open edit form
    setEditingId(null);
    setEditDraft(null);
  };

  /**
   * onDragMove fires every pointer-move tick. Since we use strategy={() => null},
   * items don't displace, so over.rect is always the stable layout position.
   * We use it to:
   *   1. Compute before/after drop indicator (active center vs over center).
   *   2. Drive the 700 ms merge timer: reset whenever the hovered item changes.
   */
  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDropTarget(null);
      if (currentOverIdRef.current !== null) {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = null;
        currentOverIdRef.current = null;
        setMergeTargetId(null);
      }
      return;
    }

    const overId = over.id as string;
    const activeRect = active.rect.current.translated;

    // Determine where the dragged item's center sits relative to the target.
    // Middle 30% of the target → merge zone; outer 70% → reorder zone.
    let inMergeZone = false;
    if (activeRect && isRegularDivision(overId)) {
      const activeCenter = activeRect.top + activeRect.height / 2;
      const overTop = over.rect.top;
      const overHeight = over.rect.height;
      const zoneFraction = 0.15; // 15% from top/bottom edge = 30% centre band
      const mergeTop = overTop + overHeight * zoneFraction;
      const mergeBottom = overTop + overHeight * (1 - zoneFraction);
      inMergeZone = activeCenter >= mergeTop && activeCenter <= mergeBottom;
    }

    // Before/after drop indicator — suppress when in merge zone.
    if (activeRect && !inMergeZone) {
      const activeCenter = activeRect.top + activeRect.height / 2;
      const overCenter = over.rect.top + over.rect.height / 2;
      setDropTarget({
        id: overId,
        position: activeCenter < overCenter ? "before" : "after",
      });
    } else if (inMergeZone) {
      setDropTarget(null);
    }

    // Merge timer: start only inside the merge zone; cancel when leaving it or
    // moving to a different item.
    if (overId !== currentOverIdRef.current) {
      // Entered a new item — reset everything.
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
      currentOverIdRef.current = overId;
      setMergeTargetId(null);
    }

    if (inMergeZone && !mergeTimerRef.current && !mergeTargetId) {
      mergeTimerRef.current = setTimeout(() => {
        setMergeTargetId(overId);
      }, 700);
    } else if (!inMergeZone && mergeTimerRef.current) {
      clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
      setMergeTargetId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const wasMergeTarget = mergeTargetId;
    const savedDropTarget = dropTarget;
    clearDragState();

    const { active } = event;
    const activeSection = sections.find((s) => s.id === active.id);
    if (!activeSection) return;

    if (wasMergeTarget && onMergeSections) {
      const tgt = sections.find((s) => s.id === wasMergeTarget);
      const confirmed = window.confirm(
        `Merge "${activeSection.title ?? "section"}" into "${
          tgt?.title ?? "section"
        }"?\n\nThe dragged section will be appended to the end of the destination section.`,
      );
      if (confirmed) onMergeSections(active.id as string, wasMergeTarget);
      return;
    }

    if (!savedDropTarget) return;

    // Build new ordered array: remove active, then insert at computed position.
    const without = sections.filter((s) => s.id !== active.id);
    const targetIdx = without.findIndex((s) => s.id === savedDropTarget.id);
    if (targetIdx === -1) return;
    const insertAt =
      savedDropTarget.position === "before" ? targetIdx : targetIdx + 1;
    const next = [
      ...without.slice(0, insertAt),
      activeSection,
      ...without.slice(insertAt),
    ];

    // Validate invariant: intro first, conclusion last.
    const introIdx = next.findIndex((s) => s.type === "introduction");
    const conclusionIdx = next.findIndex((s) => s.type === "conclusion");
    const valid =
      (introIdx === -1 || introIdx === 0) &&
      (conclusionIdx === -1 || conclusionIdx === next.length - 1);
    if (valid) onReorderSections(next);
  };

  // ---------------------------------------------------------------------------
  // Chapter drag handlers
  // ---------------------------------------------------------------------------
  const handleChapterDragStart = (event: DragStartEvent) => {
    setActiveChapterId(event.active.id as string);
  };

  const handleChapterDragEnd = (event: DragEndEvent) => {
    setActiveChapterId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex((ch) => ch.id === active.id);
    const newIndex = chapters.findIndex((ch) => ch.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChaptersReorder?.(arrayMove(chapters, oldIndex, newIndex));
  };
  if (isCollapsed) {
    return (
      <div className="pretext-plus-editor__toc pretext-plus-editor__toc--collapsed">
        <button
          type="button"
          className="pretext-plus-editor__toc-toggle"
          onClick={onToggleCollapse}
          aria-label="Expand table of contents"
          title="Expand table of contents"
        >
          ☰
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Build the section list
  // ---------------------------------------------------------------------------
  const items: React.ReactNode[] = sections.map((section) => (
    <SortableItem
      key={section.id}
      section={section}
      isActive={section.id === currentSectionId}
      isBeingDragged={activeId === section.id}
      isDropBefore={
        dropTarget?.id === section.id &&
        dropTarget.position === "before" &&
        mergeTargetId !== section.id
      }
      isDropAfter={
        dropTarget?.id === section.id &&
        dropTarget.position === "after" &&
        mergeTargetId !== section.id
      }
      isMergeTarget={mergeTargetId === section.id}
      editDraft={editingId === section.id ? editDraft : null}
      onSelect={() => onSelectSection(section.id)}
      onStartEdit={() => startEdit(section)}
      onRemove={() => handleRemove(section)}
      onDraftChange={setEditDraft}
      onEditCommit={commitEdit}
      onEditCancel={cancelEdit}
      canRemove={true}
      readonly={readonly}
      isLatex={isLatex}
    />
  ));

  const activeSection = sections.find((s) => s.id === activeId);
  const renderSectionList = (opts: {
    listClassName: string;
    role: "list" | "group";
  }) => (
    <>
      <SortableContext items={sections.map((s) => s.id)} strategy={() => null}>
        <ul className={opts.listClassName} role={opts.role}>
          {sections.length === 0 ? (
            <li className="pretext-plus-editor__toc-no-sections">
              <span>No sections</span>
              {onAddFirstSection && (
                <button
                  type="button"
                  className="pretext-plus-editor__toc-footer-btn"
                  onClick={onAddFirstSection}
                  title="Wrap the document content in a section to enable section editing"
                >
                  + Create sections
                </button>
              )}
            </li>
          ) : (
            <>
              {items}
              {!readonly && (
                <AddSectionItem
                  hasIntroduction={hasIntroduction}
                  hasConclusion={hasConclusion}
                  onAddSection={() => onAddSection(null)}
                  onAddIntroduction={onAddIntroduction}
                  onAddConclusion={onAddConclusion}
                />
              )}
            </>
          )}
        </ul>
      </SortableContext>
      <DragOverlay>
        {activeSection && (
          <div className="pretext-plus-editor__toc-drag-overlay">
            <span className="pretext-plus-editor__toc-drag-overlay-badge">
              {activeSection.type}
            </span>
            <span className="pretext-plus-editor__toc-drag-overlay-title">
              {activeSection.title || "Untitled"}
            </span>
          </div>
        )}
      </DragOverlay>
    </>
  );

  return (
    <div className="pretext-plus-editor__toc">
      <div className="pretext-plus-editor__toc-header">
        <span className="pretext-plus-editor__toc-heading">Contents</span>
        <div className="pretext-plus-editor__toc-header-actions">
          {onRefresh && (
            <button
              type="button"
              className="pretext-plus-editor__toc-toggle"
              onClick={onRefresh}
              aria-label="Refresh table of contents"
              title="Refresh table of contents (re-parse sections)"
            >
              ↻
            </button>
          )}
          <button
            type="button"
            className="pretext-plus-editor__toc-toggle"
            onClick={onToggleCollapse}
            aria-label="Collapse table of contents"
            title="Collapse table of contents"
          >
            ✕
          </button>
        </div>
      </div>

      {/* "Edit full document" link — shown in article mode when in section editing */}
      {editMode === "sectioned" && projectType !== "book" && (
        <button
          type="button"
          className="pretext-plus-editor__toc-fulldoc-link"
          onClick={onToggleEditMode}
          title="Switch to full document editing"
        >
          ← Edit full document
        </button>
      )}

      {/* ── Book mode: unified tree with chapter reordering ── */}
      {projectType === "book" && chapters.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleChapterDragStart}
          onDragEnd={handleChapterDragEnd}
        >
          <SortableContext
            items={chapters.map((ch) => ch.id)}
            strategy={() => null}
          >
            <ul className="pretext-plus-editor__toc-list" role="list">
              {chapters.map((ch) => {
                const isActive = ch.id === currentChapterId;
                return (
                  <ChapterItem
                    key={ch.id}
                    chapter={ch}
                    isActive={isActive}
                    isExpanded={isActive}
                    canReorder={!!onChaptersReorder}
                    isBeingDragged={activeChapterId === ch.id}
                    onSelect={() => {
                      // Clicking the same chapter while in a section → go back
                      // to whole-chapter (document) mode.
                      // Clicking a *different* chapter: the chapterKey effect in
                      // useSectionedEditing handles the mode reset automatically.
                      // Calling onToggleEditMode here for a chapter switch would
                      // merge stale sections and overwrite the incoming source.
                      if (ch.id === currentChapterId) {
                        if (editMode === "sectioned") onToggleEditMode();
                        return;
                      }

                      onChapterSelect?.(ch.id);
                    }}
                  >
                    {/* Sections nested beneath the active chapter */}
                    {renderSectionList({
                      listClassName: "pretext-plus-editor__toc-section-children",
                      role: "group",
                    })}
                  </ChapterItem>
                );
              })}
            </ul>
          </SortableContext>
          {/* Chapter drag overlay */}
          <DragOverlay>
            {activeChapterId && (() => {
              const ch = chapters.find((c) => c.id === activeChapterId);
              return ch ? (
                <div className="pretext-plus-editor__toc-drag-overlay">
                  <span className="pretext-plus-editor__toc-drag-overlay-badge pretext-plus-editor__toc-type-badge--chapter">
                    Ch
                  </span>
                  <span className="pretext-plus-editor__toc-drag-overlay-title">
                    {ch.title || "Untitled chapter"}
                  </span>
                </div>
              ) : null;
            })()}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ── Article mode (or book with no chapters): flat section list ── */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={clearDragState}
        >
          {renderSectionList({
            listClassName: "pretext-plus-editor__toc-list",
            role: "list",
          })}
        </DndContext>
      )}
    </div>
  );
};

export default TableOfContents;
