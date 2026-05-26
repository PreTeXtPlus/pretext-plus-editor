import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type {
  DocumentChapter,
  DocumentSection,
  DocumentSectionType,
} from "../../types/sections";
import ChapterItem from "./ChapterItem";
import SectionList from "./SectionList";
import { useSectionEdit } from "./useSectionEdit";
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
  onAddFirstSection?: () => void;
  editMode: "document" | "sectioned";
  onToggleEditMode: () => void;
  readonly: boolean;
  chapters: DocumentChapter[];
  currentChapterId: string | null | undefined;
  onChapterSelect?: (chapterId: string) => void;
  onChaptersReorder?: (chapters: DocumentChapter[]) => void;
  /** Ids of chapters currently expanded.  Provided by `useBookChapters`. */
  expandedChapterIds: Set<string>;
  /** Toggle a chapter's expanded state. */
  onToggleChapterExpanded: (chapterId: string) => void;
  /**
   * Parsed `{sections, wrapper}` for a non-active chapter, or `null` when
   * the chapter hasn't been loaded yet.  Used to render section lists for
   * chapters other than the currently active one.
   */
  getChapterParse: (chapterId: string) => ChapterParseResult | null;
  /**
   * Called when a chapter is expanded for the first time and its content
   * has not yet been fetched.  The host is expected to load the content
   * and update the `chapters` array with `content` populated.
   */
  onChapterRequestLoad?: (chapterId: string) => void;
  /**
   * Called when the user clicks the "+ Add chapter" row.  The host
   * creates a new chapter record and appends it to `chapters`.
   * `afterChapterId` is the chapter the new one should be inserted
   * after, or `null` for "at the end."
   */
  onChapterAdd?: (afterChapterId: string | null) => void;
  /**
   * Called when the user removes a chapter (×).  When omitted, the
   * remove button is hidden.
   */
  onChapterRemove?: (chapterId: string) => void;
}

/**
 * Book-mode TOC body.  Renders a unified chapter tree where each chapter
 * can be independently expanded (via its chevron) to show its section list.
 *
 *   - The **active** chapter's sections come from `useSectionedEditing`
 *     and are fully editable / dnd-orderable within the chapter.
 *   - **Non-active expanded** chapters render their parsed sections from
 *     `useBookChapters` in a read-only list (drag handles re-enabled in
 *     Phase 4 for cross-chapter section moves).
 *
 * Lazy load: expanding a chapter whose `content` is `undefined` fires
 * `onChapterRequestLoad`; until the content arrives a "Loading…" line
 * is shown.
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
}: BookTocProps) => {
  const edit = useSectionEdit();
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const isLatex = sections.some((s) => !s.content.trimStart().startsWith("<"));

  const handleRemove = (section: DocumentSection) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      onRemoveSection(section.id);
    }
  };

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

  /**
   * Toggle expansion for `ch`.  If we're expanding a chapter whose content
   * hasn't been loaded yet, fire `onChapterRequestLoad` so the host can
   * fetch it.  The host is expected to update `chapters[i].content` once
   * the fetch resolves; the section list then renders automatically.
   */
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

  return (
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
            const isExpanded = expandedChapterIds.has(ch.id);
            return (
              <ChapterItem
                key={ch.id}
                chapter={ch}
                isActive={isActive}
                isExpanded={isExpanded}
                canReorder={!!onChaptersReorder}
                isBeingDragged={activeChapterId === ch.id}
                onSelect={() => {
                  // Clicking the active chapter while in sectioned mode →
                  // pop back to whole-chapter (document) editing.  Clicking
                  // a different chapter selects it for editing; the
                  // useSectionedEditing chapterKey effect handles the mode
                  // reset automatically.
                  if (ch.id === currentChapterId) {
                    if (editMode === "sectioned") onToggleEditMode();
                    return;
                  }
                  // Ensure the newly-selected chapter is expanded too so
                  // its sections become visible without a second click.
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
                {isExpanded && renderChapterChildren({
                  chapter: ch,
                  isActive,
                  activeSections: sections,
                  currentSectionId,
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
                  getChapterParse,
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
        {activeChapterId &&
          (() => {
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
  );
};

// ---------------------------------------------------------------------------
// renderChapterChildren — pure rendering for the section list (or loading
// placeholder) shown under an expanded chapter.  Kept as a separate function
// to avoid deep nesting in the main JSX.
// ---------------------------------------------------------------------------

interface ChildrenOpts {
  chapter: DocumentChapter;
  isActive: boolean;
  activeSections: DocumentSection[];
  currentSectionId: string | null;
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
  getChapterParse: (chapterId: string) => ChapterParseResult | null;
}

function renderChapterChildren(opts: ChildrenOpts) {
  const {
    chapter,
    isActive,
    activeSections,
    currentSectionId,
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
    getChapterParse,
  } = opts;

  if (isActive) {
    return (
      <SectionList
        sections={activeSections}
        currentSectionId={currentSectionId}
        activeDragId={null}
        dropTarget={null}
        mergeTargetId={null}
        editingId={edit.editingId}
        editDraft={edit.editDraft}
        isLatex={isLatex}
        readonly={readonly}
        listClassName="pretext-plus-editor__toc-section-children"
        role="group"
        onSelectSection={onSelectSection}
        onStartEdit={edit.startEdit}
        onRemove={handleRemove}
        onDraftChange={edit.setEditDraft}
        onEditCommit={() => edit.commitEdit(onUpdateSection)}
        onEditCancel={edit.cancelEdit}
        onAddFirstSection={onAddFirstSection}
        onAddSection={() => onAddSection(null)}
        onAddIntroduction={onAddIntroduction}
        onAddConclusion={onAddConclusion}
      />
    );
  }

  // Non-active expanded chapter: render parsed sections (read-only).
  if (chapter.content === undefined) {
    return (
      <div className="pretext-plus-editor__toc-chapter-loading">
        Loading…
      </div>
    );
  }
  const parsed = getChapterParse(chapter.id);
  if (!parsed) {
    return (
      <div className="pretext-plus-editor__toc-chapter-loading">
        (No sections)
      </div>
    );
  }
  return (
    <SectionList
      sections={parsed.sections}
      currentSectionId={null}
      activeDragId={null}
      dropTarget={null}
      mergeTargetId={null}
      editingId={null}
      editDraft={null}
      isLatex={false}
      readonly={true}
      listClassName="pretext-plus-editor__toc-section-children"
      role="group"
      onSelectSection={() => {
        /* not actionable in read-only chapter view (Phase 3) */
      }}
      onStartEdit={() => {}}
      onRemove={() => {}}
      onDraftChange={() => {}}
      onEditCommit={() => {}}
      onEditCancel={() => {}}
      onAddSection={() => {}}
      onAddIntroduction={() => {}}
      onAddConclusion={() => {}}
    />
  );
}

export default BookToc;
