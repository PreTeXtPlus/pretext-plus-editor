import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { mergeDocument } from "../../sectionUtils";
import type {
  DocumentChapter,
  DocumentSection,
  DocumentSectionType,
} from "../../types/sections";
import ChapterItem from "./ChapterItem";
import SectionList from "./SectionList";
import { useSectionEdit } from "./useSectionEdit";
import { TYPE_LABELS } from "./types";
import type { ChapterParseResult } from "./useBookChapters";

export interface BookTocProps {
  sections: DocumentSection[];
  currentSectionId: string | null;
  onSelectSection: (id: string) => void;
  onAddSection: (afterId: string | null) => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
  onRemoveSection: (id: string) => void;
  onUpdateSection: (
    id: string,
    changes: {
      title?: string;
      type?: DocumentSectionType;
      xmlId?: string | null;
      label?: string | null;
    },
  ) => void;
  /** Reorder sections within the currently-active chapter. */
  onReorderSections: (sections: DocumentSection[]) => void;
  onAddFirstSection?: () => void;
  editMode: "document" | "sectioned";
  onToggleEditMode: () => void;
  readonly: boolean;
  chapters: DocumentChapter[];
  currentChapterId: string | null | undefined;
  onChapterSelect?: (chapterId: string) => void;
  onChaptersReorder?: (chapters: DocumentChapter[]) => void;
  expandedChapterIds: Set<string>;
  onToggleChapterExpanded: (chapterId: string) => void;
  getChapterParse: (chapterId: string) => ChapterParseResult | null;
  onChapterRequestLoad?: (chapterId: string) => void;
  onChapterAdd?: (afterChapterId: string | null) => void;
  onChapterRemove?: (chapterId: string) => void;
  /**
   * Persist a chapter's updated content back to the host.  Required for
   * cross-chapter section drag-and-drop to work; without it, drops between
   * chapters are rejected.
   */
  onChapterContentChange?: (chapterId: string, content: string) => void;
  /**
   * Handle a section click in a chapter that isn't currently active.
   * The parent switches the active chapter and lands directly on the
   * named section in sectioned mode.
   */
  onSelectSectionInChapter?: (chapterId: string, sectionTitle: string) => void;
}

interface DropTarget {
  sectionId: string;
  position: "before" | "after";
}

/**
 * Book-mode TOC body with unified drag-and-drop.
 *
 * A single `DndContext` wraps both the chapter sortable and the per-chapter
 * section sortables, so a drag can begin inside one chapter's section list
 * and end inside another.  Section ids are globally unique, so we
 * distinguish chapter vs section drags by id membership in `chapters`.
 *
 * For section drops:
 *   - same chapter, source = active: route through `onReorderSections`.
 *   - same chapter, source = non-active: re-merge the chapter and emit
 *     `onChapterContentChange`.
 *   - cross-chapter: remove from source, splice into target, emit content
 *     changes for both (route the active side through `onReorderSections`
 *     so the live editor state stays in sync).
 *
 * The merge-into-section gesture (700 ms hover) is intentionally omitted
 * here — cross-chapter merge would be confusing and the existing article
 * flow doesn't apply.  Intra-chapter merge can be added back later.
 */
const BookToc = ({
  sections,
  currentSectionId,
  onSelectSection,
  onAddSection,
  onAddIntroduction,
  onAddConclusion,
  onRemoveSection,
  onUpdateSection,
  onReorderSections,
  onAddFirstSection,
  editMode,
  onToggleEditMode,
  readonly,
  chapters,
  currentChapterId,
  onChapterSelect,
  onChaptersReorder,
  expandedChapterIds,
  onToggleChapterExpanded,
  getChapterParse,
  onChapterRequestLoad,
  onChapterAdd,
  onChapterRemove,
  onChapterContentChange,
  onSelectSectionInChapter,
}: BookTocProps) => {
  const edit = useSectionEdit();

  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [chapterDropTarget, setChapterDropTarget] = useState<{
    chapterId: string;
    position: "before" | "after";
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const isLatex = sections.some((s) => !s.content.trimStart().startsWith("<"));

  // ── Per-chapter section views ───────────────────────────────────────────
  // For each expanded chapter, the sections currently displayed.  For the
  // active chapter, these come from props (i.e. useSectionedEditing).  For
  // non-active chapters, they come from the parsed map.
  const chapterSectionsById = useMemo(() => {
    const map = new Map<string, DocumentSection[]>();
    for (const ch of chapters) {
      if (!expandedChapterIds.has(ch.id)) continue;
      if (ch.id === currentChapterId) {
        map.set(ch.id, sections);
      } else {
        const parsed = getChapterParse(ch.id);
        if (parsed) map.set(ch.id, parsed.sections);
      }
    }
    return map;
  }, [chapters, expandedChapterIds, currentChapterId, sections, getChapterParse]);

  // Reverse index for hit-testing during drag: section id → chapter id.
  const sectionToChapter = useMemo(() => {
    const map = new Map<string, string>();
    for (const [chapterId, secs] of chapterSectionsById.entries()) {
      for (const s of secs) map.set(s.id, chapterId);
    }
    return map;
  }, [chapterSectionsById]);

  const chapterIdSet = useMemo(
    () => new Set(chapters.map((c) => c.id)),
    [chapters],
  );

  // Cached snapshot of the section being dragged so the overlay can render
  // it even if the source list shifts during the drag.
  const [draggedSection, setDraggedSection] = useState<DocumentSection | null>(
    null,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleRemoveSectionWithConfirm = (section: DocumentSection) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      onRemoveSection(section.id);
    }
  };

  const toggleExpanded = (ch: DocumentChapter) => {
    const willExpand = !expandedChapterIds.has(ch.id);
    onToggleChapterExpanded(ch.id);
    if (willExpand && ch.content === undefined) {
      onChapterRequestLoad?.(ch.id);
    }
  };

  const handleChapterRemoveClick = (ch: DocumentChapter) => {
    if (!onChapterRemove) return;
    if (
      window.confirm(
        `Remove chapter "${ch.title}"? Its content will be deleted.`,
      )
    ) {
      onChapterRemove(ch.id);
    }
  };

  // ── DnD: shared start/move/end ──────────────────────────────────────────

  const clearDragState = () => {
    setDraggedChapterId(null);
    setDraggedSectionId(null);
    setDropTarget(null);
    setChapterDropTarget(null);
    setDraggedSection(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    edit.cancelEdit();
    const id = event.active.id as string;
    if (chapterIdSet.has(id)) {
      setDraggedChapterId(id);
      return;
    }
    const chapterOfSection = sectionToChapter.get(id);
    if (chapterOfSection) {
      const sec = chapterSectionsById
        .get(chapterOfSection)
        ?.find((s) => s.id === id);
      setDraggedSection(sec ?? null);
      setDraggedSectionId(id);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDropTarget(null);
      setChapterDropTarget(null);
      return;
    }
    const activeRect = active.rect.current.translated;
    if (!activeRect) return;
    const activeCenter = activeRect.top + activeRect.height / 2;
    const overCenter = over.rect.top + over.rect.height / 2;
    const position: "before" | "after" =
      activeCenter < overCenter ? "before" : "after";

    if (draggedChapterId) {
      if (chapterIdSet.has(over.id as string)) {
        setChapterDropTarget({ chapterId: over.id as string, position });
      } else {
        setChapterDropTarget(null);
      }
      return;
    }

    if (!draggedSectionId) return;
    if (!sectionToChapter.has(over.id as string)) {
      setDropTarget(null);
      return;
    }
    setDropTarget({ sectionId: over.id as string, position });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const wasChapter = draggedChapterId;
    const wasSection = draggedSectionId;
    const wasDropTarget = dropTarget;
    const wasChapterDropTarget = chapterDropTarget;
    const wasDraggedSection = draggedSection;
    clearDragState();

    const { active } = event;

    // ── Chapter reorder ──
    if (wasChapter) {
      if (!wasChapterDropTarget) return;
      const activeChapter = chapters.find((ch) => ch.id === active.id);
      if (!activeChapter) return;
      const without = chapters.filter((ch) => ch.id !== active.id);
      const targetIdx = without.findIndex(
        (ch) => ch.id === wasChapterDropTarget.chapterId,
      );
      if (targetIdx === -1) return;
      const insertAt =
        wasChapterDropTarget.position === "before" ? targetIdx : targetIdx + 1;
      const next = [
        ...without.slice(0, insertAt),
        activeChapter,
        ...without.slice(insertAt),
      ];
      onChaptersReorder?.(next);
      return;
    }

    // ── Section drag ──
    if (!wasSection || !wasDraggedSection || !wasDropTarget) return;

    const sourceChapterId = sectionToChapter.get(wasSection);
    const targetChapterId = sectionToChapter.get(wasDropTarget.sectionId);
    if (!sourceChapterId || !targetChapterId) return;

    const sourceSections = chapterSectionsById.get(sourceChapterId) ?? [];
    const targetSections = chapterSectionsById.get(targetChapterId) ?? [];

    if (sourceChapterId === targetChapterId) {
      const without = sourceSections.filter((s) => s.id !== wasSection);
      const targetIdx = without.findIndex(
        (s) => s.id === wasDropTarget.sectionId,
      );
      if (targetIdx === -1) return;
      const insertAt =
        wasDropTarget.position === "before" ? targetIdx : targetIdx + 1;
      const next = [
        ...without.slice(0, insertAt),
        wasDraggedSection,
        ...without.slice(insertAt),
      ];
      if (!validateInvariant(next)) return;
      commitChapterSections(sourceChapterId, next);
      return;
    }

    // Cross-chapter move.  We need a way to persist the non-active side;
    // bail if the host hasn't supplied `onChapterContentChange`.
    if (!onChapterContentChange) return;

    const newSource = sourceSections.filter((s) => s.id !== wasSection);
    if (!validateInvariant(newSource)) return;

    const targetWithout = targetSections.filter((s) => s.id !== wasSection);
    const targetIdx = targetWithout.findIndex(
      (s) => s.id === wasDropTarget.sectionId,
    );
    if (targetIdx === -1) return;
    const insertAt =
      wasDropTarget.position === "before" ? targetIdx : targetIdx + 1;
    const newTarget = [
      ...targetWithout.slice(0, insertAt),
      wasDraggedSection,
      ...targetWithout.slice(insertAt),
    ];
    if (!validateInvariant(newTarget)) return;

    commitChapterSections(sourceChapterId, newSource);
    commitChapterSections(targetChapterId, newTarget);
  };

  /**
   * Persist a chapter's new section ordering.  Uses the live editor state
   * (`onReorderSections`) for the active chapter so the open editor pane
   * stays in sync; uses the `mergeDocument` / `onChapterContentChange`
   * round-trip for other chapters.
   */
  const commitChapterSections = (
    chapterId: string,
    nextSections: DocumentSection[],
  ) => {
    if (chapterId === currentChapterId) {
      onReorderSections(nextSections);
      return;
    }
    if (!onChapterContentChange) return;
    const parsed = getChapterParse(chapterId);
    if (!parsed) return;
    const merged = mergeDocument(parsed.wrapper, nextSections);
    onChapterContentChange(chapterId, merged);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <SortableContext
        items={chapters.map((ch) => ch.id)}
        strategy={() => null}
      >
        <ul className="pretext-plus-editor__toc-list" role="list">
          {chapters.map((ch) => {
            const isActive = ch.id === currentChapterId;
            const isExpanded = expandedChapterIds.has(ch.id);
            return (
              <ChapterItem
                key={ch.id}
                chapter={ch}
                isActive={isActive}
                isExpanded={isExpanded}
                canReorder={!!onChaptersReorder}
                isBeingDragged={draggedChapterId === ch.id}
                isDropBefore={
                  chapterDropTarget?.chapterId === ch.id &&
                  chapterDropTarget.position === "before"
                }
                isDropAfter={
                  chapterDropTarget?.chapterId === ch.id &&
                  chapterDropTarget.position === "after"
                }
                onSelect={() => {
                  if (ch.id === currentChapterId) {
                    if (editMode === "sectioned") onToggleEditMode();
                    return;
                  }
                  if (!expandedChapterIds.has(ch.id)) {
                    onToggleChapterExpanded(ch.id);
                    if (ch.content === undefined) {
                      onChapterRequestLoad?.(ch.id);
                    }
                  }
                  onChapterSelect?.(ch.id);
                }}
                onToggleExpanded={() => toggleExpanded(ch)}
                onRemove={
                  onChapterRemove ? () => handleChapterRemoveClick(ch) : undefined
                }
              >
                {isExpanded &&
                  renderChapterChildren({
                    chapter: ch,
                    isActive,
                    sectionsForChapter: chapterSectionsById.get(ch.id),
                    currentSectionId,
                    draggedSectionId,
                    dropTarget,
                    edit,
                    isLatex,
                    readonly,
                    onSelectSection,
                    onAddSection,
                    onAddIntroduction,
                    onAddConclusion,
                    onAddFirstSection,
                    onUpdateSection,
                    handleRemove: handleRemoveSectionWithConfirm,
                    onSelectSectionInChapter,
                  })}
              </ChapterItem>
            );
          })}
          {onChapterAdd && (
            <li className="pretext-plus-editor__toc-add-item">
              <button
                type="button"
                className="pretext-plus-editor__toc-add-item-trigger"
                onClick={() => onChapterAdd(null)}
                title="Add a new chapter"
              >
                + Add chapter
              </button>
            </li>
          )}
        </ul>
      </SortableContext>
      <DragOverlay>
        {draggedChapterId &&
          (() => {
            const ch = chapters.find((c) => c.id === draggedChapterId);
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
        {draggedSectionId && draggedSection && (
          <div className="pretext-plus-editor__toc-drag-overlay">
            <span className="pretext-plus-editor__toc-drag-overlay-badge">
              {TYPE_LABELS[draggedSection.type] ?? draggedSection.type}
            </span>
            <span className="pretext-plus-editor__toc-drag-overlay-title">
              {draggedSection.title || "Untitled"}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

/** Intro must be first, conclusion must be last (per chapter). */
function validateInvariant(next: DocumentSection[]): boolean {
  const introIdx = next.findIndex((s) => s.type === "introduction");
  const conclusionIdx = next.findIndex((s) => s.type === "conclusion");
  return (
    (introIdx === -1 || introIdx === 0) &&
    (conclusionIdx === -1 || conclusionIdx === next.length - 1)
  );
}

// ---------------------------------------------------------------------------
// renderChapterChildren — section list (or loading placeholder) shown
// under an expanded chapter.
// ---------------------------------------------------------------------------

interface ChildrenOpts {
  chapter: DocumentChapter;
  isActive: boolean;
  sectionsForChapter: DocumentSection[] | undefined;
  currentSectionId: string | null;
  draggedSectionId: string | null;
  dropTarget: DropTarget | null;
  edit: ReturnType<typeof useSectionEdit>;
  isLatex: boolean;
  readonly: boolean;
  onSelectSection: (id: string) => void;
  onAddSection: (afterId: string | null) => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
  onAddFirstSection?: () => void;
  onUpdateSection: (
    id: string,
    changes: {
      title?: string;
      type?: DocumentSectionType;
      xmlId?: string | null;
      label?: string | null;
    },
  ) => void;
  handleRemove: (s: DocumentSection) => void;
  onSelectSectionInChapter?: (chapterId: string, sectionTitle: string) => void;
}

function renderChapterChildren(opts: ChildrenOpts) {
  const {
    chapter,
    isActive,
    sectionsForChapter,
    currentSectionId,
    draggedSectionId,
    dropTarget,
    edit,
    isLatex,
    readonly,
    onSelectSection,
    onAddSection,
    onAddIntroduction,
    onAddConclusion,
    onAddFirstSection,
    onUpdateSection,
    handleRemove,
    onSelectSectionInChapter,
  } = opts;

  if (sectionsForChapter === undefined) {
    if (chapter.content === undefined) {
      return (
        <div className="pretext-plus-editor__toc-chapter-loading">Loading…</div>
      );
    }
    return (
      <div className="pretext-plus-editor__toc-chapter-loading">
        (No sections)
      </div>
    );
  }

  return (
    <SectionList
      sections={sectionsForChapter}
      currentSectionId={isActive ? currentSectionId : null}
      activeDragId={draggedSectionId}
      dropTarget={
        dropTarget
          ? { id: dropTarget.sectionId, position: dropTarget.position }
          : null
      }
      mergeTargetId={null}
      editingId={isActive ? edit.editingId : null}
      editDraft={isActive ? edit.editDraft : null}
      isLatex={isLatex}
      readonly={!isActive || readonly}
      dragEnabled={true}
      listClassName="pretext-plus-editor__toc-section-children"
      role="group"
      onSelectSection={
        isActive
          ? onSelectSection
          : (sectionId: string) => {
              if (!onSelectSectionInChapter) return;
              const sec = sectionsForChapter?.find((s) => s.id === sectionId);
              if (!sec) return;
              onSelectSectionInChapter(chapter.id, sec.title);
            }
      }
      onStartEdit={isActive ? edit.startEdit : () => {}}
      onRemove={isActive ? handleRemove : () => {}}
      onDraftChange={isActive ? edit.setEditDraft : () => {}}
      onEditCommit={isActive ? () => edit.commitEdit(onUpdateSection) : () => {}}
      onEditCancel={isActive ? edit.cancelEdit : () => {}}
      onAddFirstSection={isActive ? onAddFirstSection : undefined}
      onAddSection={isActive ? () => onAddSection(null) : () => {}}
      onAddIntroduction={isActive ? onAddIntroduction : () => {}}
      onAddConclusion={isActive ? onAddConclusion : () => {}}
    />
  );
}

export default BookToc;
