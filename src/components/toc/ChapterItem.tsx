import { useSortable } from "@dnd-kit/sortable";
import type { DocumentChapter } from "../../types/sections";

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
      {isExpanded && children && (
        <div className="pretext-plus-editor__toc-chapter-sections">
          {children}
        </div>
      )}
    </li>
  );
};

export default ChapterItem;
