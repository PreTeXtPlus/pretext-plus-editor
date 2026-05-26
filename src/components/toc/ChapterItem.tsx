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

export default ChapterItem;
