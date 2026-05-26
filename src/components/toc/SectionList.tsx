import { SortableContext } from "@dnd-kit/sortable";
import type { DocumentSection } from "../../types/sections";
import AddSectionItem from "./AddSectionItem";
import SortableSectionItem from "./SortableSectionItem";
import type { EditDraft } from "./types";

interface SectionListProps {
  sections: DocumentSection[];
  currentSectionId: string | null;
  activeDragId: string | null;
  dropTarget: { id: string; position: "before" | "after" } | null;
  mergeTargetId: string | null;
  editingId: string | null;
  editDraft: EditDraft | null;
  isLatex: boolean;
  readonly: boolean;
  listClassName: string;
  role: "list" | "group";
  onSelectSection: (id: string) => void;
  onStartEdit: (section: DocumentSection) => void;
  onRemove: (section: DocumentSection) => void;
  onDraftChange: (draft: EditDraft) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onAddFirstSection?: () => void;
  onAddSection: () => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
  /**
   * Override for the per-item drag toggle.  See `SortableSectionItem.dragEnabled`.
   * Forwarded to every section in the list.
   */
  dragEnabled?: boolean;
}

/**
 * Renders a single sortable list of sections.  Does NOT include its own
 * `DndContext` or `DragOverlay` — the caller wraps this in a `DndContext`
 * and is responsible for rendering the overlay alongside it.
 */
const SectionList = ({
  sections,
  currentSectionId,
  activeDragId,
  dropTarget,
  mergeTargetId,
  editingId,
  editDraft,
  isLatex,
  readonly,
  listClassName,
  role,
  onSelectSection,
  onStartEdit,
  onRemove,
  onDraftChange,
  onEditCommit,
  onEditCancel,
  onAddFirstSection,
  onAddSection,
  onAddIntroduction,
  onAddConclusion,
  dragEnabled,
}: SectionListProps) => {
  const hasIntroduction = sections.some((s) => s.type === "introduction");
  const hasConclusion = sections.some((s) => s.type === "conclusion");

  return (
    <SortableContext items={sections.map((s) => s.id)} strategy={() => null}>
      <ul className={listClassName} role={role}>
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
            {sections.map((section) => (
              <SortableSectionItem
                key={section.id}
                section={section}
                isActive={section.id === currentSectionId}
                isBeingDragged={activeDragId === section.id}
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
                onStartEdit={() => onStartEdit(section)}
                onRemove={() => onRemove(section)}
                onDraftChange={onDraftChange}
                onEditCommit={onEditCommit}
                onEditCancel={onEditCancel}
                canRemove={true}
                readonly={readonly}
                isLatex={isLatex}
                dragEnabled={dragEnabled}
              />
            ))}
            {!readonly && (
              <AddSectionItem
                hasIntroduction={hasIntroduction}
                hasConclusion={hasConclusion}
                onAddSection={onAddSection}
                onAddIntroduction={onAddIntroduction}
                onAddConclusion={onAddConclusion}
              />
            )}
          </>
        )}
      </ul>
    </SortableContext>
  );
};

export default SectionList;
