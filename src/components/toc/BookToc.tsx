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
  /**
   * Set of chapter ids currently expanded.  Wired to the chevron toggle
   * in Phase 3; for now only the active chapter is auto-added by the
   * parent so behavior matches the pre-refactor single-expanded design.
   */
  expandedChapterIds?: Set<string>;
  /**
   * Toggle a chapter's expanded state.  Not yet bound to the chevron UI.
   */
  onToggleChapterExpanded?: (chapterId: string) => void;
}

/**
 * Book-mode TOC body.  Renders a unified chapter tree where the currently
 * active chapter is expanded and shows its section list inline.  Chapters
 * can be drag-reordered when `onChaptersReorder` is provided.
 *
 * Section drag is not active in this mode (Phase 0 — preserved from the
 * original implementation).  Section editing (rename / type / xml:id /
 * label) still works in the active chapter.
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
  onToggleChapterExpanded: _onToggleChapterExpanded,
}: BookTocProps) => {
  // Suppress unused warning until Phase 3 wires the chevron.
  void _onToggleChapterExpanded;
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
            const isExpanded = expandedChapterIds
              ? expandedChapterIds.has(ch.id)
              : isActive;
            return (
              <ChapterItem
                key={ch.id}
                chapter={ch}
                isActive={isActive}
                isExpanded={isExpanded}
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
                {/*
                 * Phase 2: only render the section list for the *active*
                 * chapter — its sections live in useSectionedEditing's
                 * editable state.  Non-active expanded chapters will get
                 * their parsed sections from useBookChapters in Phase 3.
                 */}
                {isActive && (
                  <SectionList
                    sections={sections}
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
                )}
              </ChapterItem>
            );
          })}
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

export default BookToc;
