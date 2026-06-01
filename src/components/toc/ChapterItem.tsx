import { useSortable } from "@dnd-kit/sortable";
import type { DocumentChapter } from "../../types/sections";
import type { ChapterEditDraft } from "./types";
import ChapterEditForm from "./ChapterEditForm";

interface ChapterItemProps {
  chapter: DocumentChapter;
  isActive: boolean;
  isExpanded: boolean;
  /** When true a drag handle is shown and the item participates in DnD. */
  canReorder: boolean;
  /** The item is being dragged — render as invisible placeholder. */
  isBeingDragged: boolean;
  onSelect: () => void;
  /** Toggle the chevron to expand/collapse this chapter's sections. */
  onToggleExpanded?: () => void;
  /** When true, show a small × button on hover that triggers `onRemove`. */
  onRemove?: () => void;
  /**
   * When provided, an edit (✎) button is shown that opens the inline chapter
   * properties form.  The draft/handlers below drive that form.
   */
  onStartEdit?: () => void;
  /** The active edit draft for this chapter, or `null` when not editing. */
  editDraft?: ChapterEditDraft | null;
  onDraftChange?: (draft: ChapterEditDraft) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
  /** Show a drop-target line above this chapter row. */
  isDropBefore?: boolean;
  /** Show a drop-target line below this chapter row. */
  isDropAfter?: boolean;
  children?: React.ReactNode;
}

const ChapterItem = ({
  chapter,
  isActive,
  isExpanded,
  canReorder,
  isBeingDragged,
  onSelect,
  onToggleExpanded,
  onRemove,
  onStartEdit,
  editDraft,
  onDraftChange,
  onEditCommit,
  onEditCancel,
  isDropBefore,
  isDropAfter,
  children,
}: ChapterItemProps) => {
  const isEditing = editDraft != null;
  const { attributes, listeners, setNodeRef } = useSortable({
    id: chapter.id,
    disabled: !canReorder || isEditing,
  });

  return (
    <li
      ref={setNodeRef}
      style={isBeingDragged ? { opacity: 0, pointerEvents: "none" } : {}}
      className={[
        "pretext-plus-editor__toc-chapter-item",
        isActive ? "pretext-plus-editor__toc-chapter-item--active" : "",
        isDropBefore ? "pretext-plus-editor__toc-chapter-item--drop-before" : "",
        isDropAfter ? "pretext-plus-editor__toc-chapter-item--drop-after" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pretext-plus-editor__toc-chapter-row">
        {canReorder && !isEditing && (
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
        <button
          type="button"
          className="pretext-plus-editor__toc-chapter-expand"
          onClick={onToggleExpanded}
          disabled={!onToggleExpanded}
          aria-label={isExpanded ? "Collapse chapter" : "Expand chapter"}
          title={isExpanded ? "Collapse chapter" : "Expand chapter"}
        >
          {isExpanded ? "▾" : "›"}
        </button>
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
        {onStartEdit && !isEditing && (
          <button
            type="button"
            className="pretext-plus-editor__toc-action-btn"
            onClick={onStartEdit}
            title="Edit chapter properties"
            aria-label={`Edit chapter "${chapter.title}"`}
          >
            ✎
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className="pretext-plus-editor__toc-action-btn pretext-plus-editor__toc-action-btn--danger"
            onClick={onRemove}
            title="Remove chapter"
            aria-label={`Remove chapter "${chapter.title}"`}
          >
            ✕
          </button>
        )}
      </div>
      {isEditing && editDraft && (
        <ChapterEditForm
          draft={editDraft}
          onDraftChange={onDraftChange ?? (() => {})}
          onCommit={onEditCommit ?? (() => {})}
          onCancel={onEditCancel ?? (() => {})}
        />
      )}
      {isExpanded && children && (
        <div className="pretext-plus-editor__toc-chapter-sections">
          {children}
        </div>
      )}
    </li>
  );
};

export default ChapterItem;
