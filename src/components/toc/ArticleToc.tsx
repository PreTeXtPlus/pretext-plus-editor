import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type {
  DocumentSection,
  DocumentSectionType,
} from "../../types/sections";
import SectionList from "./SectionList";
import { useSectionDnd } from "./useSectionDnd";
import { useSectionEdit } from "./useSectionEdit";
import { TYPE_LABELS } from "./types";

export interface ArticleTocProps {
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
  onReorderSections: (sections: DocumentSection[]) => void;
  onMergeSections?: (sourceId: string, targetId: string) => void;
  onAddFirstSection?: () => void;
  editMode: "document" | "sectioned";
  /**
   * When provided, a "← Edit full document" back-link is shown in sectioned
   * mode so the user can return to full-document editing.  Omit (or pass
   * `undefined`) to hide the link — appropriate in the new sections-as-DB-records
   * mode where there is no document mode to return to.
   */
  onToggleEditMode?: () => void;
  readonly: boolean;
}

/**
 * Article-mode TOC body.  Renders a single flat section list with full
 * section drag-and-drop (reorder + merge gesture) and the "Edit full
 * document" back-link when in sectioned mode.
 */
const ArticleToc = ({
  sections,
  currentSectionId,
  onSelectSection,
  onAddSection,
  onAddIntroduction,
  onAddConclusion,
  onRemoveSection,
  onUpdateSection,
  onReorderSections,
  onMergeSections,
  onAddFirstSection,
  editMode,
  onToggleEditMode,
  readonly,
}: ArticleTocProps) => {
  const edit = useSectionEdit();
  const dnd = useSectionDnd({
    sections,
    onReorderSections,
    onMergeSections,
  });

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

  const handleDragStart = (e: Parameters<typeof dnd.handleDragStart>[0]) => {
    edit.cancelEdit();
    dnd.handleDragStart(e);
  };

  const activeSection = sections.find((s) => s.id === dnd.activeId);

  return (
    <>
      {editMode === "sectioned" && onToggleEditMode && (
        <button
          type="button"
          className="pretext-plus-editor__toc-fulldoc-link"
          onClick={onToggleEditMode}
          title="Switch to full document editing"
        >
          ← Edit full document
        </button>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={dnd.handleDragMove}
        onDragEnd={dnd.handleDragEnd}
        onDragCancel={dnd.clearDragState}
      >
        <SectionList
          sections={sections}
          currentSectionId={currentSectionId}
          activeDragId={dnd.activeId}
          dropTarget={dnd.dropTarget}
          mergeTargetId={dnd.mergeTargetId}
          editingId={edit.editingId}
          editDraft={edit.editDraft}
          isLatex={isLatex}
          readonly={readonly}
          listClassName="pretext-plus-editor__toc-list"
          role="list"
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
        <DragOverlay>
          {activeSection && (
            <div className="pretext-plus-editor__toc-drag-overlay">
              <span className="pretext-plus-editor__toc-drag-overlay-badge">
                {TYPE_LABELS[activeSection.type] ?? activeSection.type}
              </span>
              <span className="pretext-plus-editor__toc-drag-overlay-title">
                {activeSection.title || "Untitled"}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default ArticleToc;
