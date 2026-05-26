import { useSortable } from "@dnd-kit/sortable";
import type { DocumentSection } from "../../types/sections";
import SectionEditForm from "./SectionEditForm";
import { type EditDraft, TYPE_LABELS, isRegularDivision } from "./types";

interface SortableSectionItemProps {
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
  /**
   * Explicit override: when set, controls whether the drag handle is shown
   * regardless of `readonly`.  Used by book mode to keep sections in
   * non-active (read-only) chapters draggable for cross-chapter moves.
   * When undefined, drag follows `!readonly` (the original behavior).
   */
  dragEnabled?: boolean;
}

const SortableSectionItem = ({
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
  dragEnabled,
}: SortableSectionItemProps) => {
  const dragAllowed = dragEnabled ?? !readonly;
  const isDraggable = dragAllowed && isRegularDivision(section.type);
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

      {isEditing && editDraft && (
        <SectionEditForm
          draft={editDraft}
          isLatex={isLatex}
          onDraftChange={onDraftChange}
          onCommit={onEditCommit}
          onCancel={onEditCancel}
        />
      )}
    </li>
  );
};

export default SortableSectionItem;
