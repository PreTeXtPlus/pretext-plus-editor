import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DocumentSection } from "../types/sections";
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
  onRenameSection: (id: string, newTitle: string) => void;
  onReorderSections: (sections: DocumentSection[]) => void;
  /**
   * Called when the user requests to merge the section with the given id into
   * the section that immediately follows it.
   */
  onMergeWithNext?: (id: string) => void;
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
}

const TYPE_LABELS: Record<string, string> = {
  introduction: "Intro",
  section: "§",
  conclusion: "Concl",
};

// ---------------------------------------------------------------------------
// SortableItem — a single draggable section row
// ---------------------------------------------------------------------------
interface SortableItemProps {
  section: DocumentSection;
  isActive: boolean;
  isEditing: boolean;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onStartEdit: () => void;
  onRemove: () => void;
  onEditChange: (v: string) => void;
  onEditCommit: () => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  canRemove: boolean;
  readonly: boolean;
}

const SortableItem = ({
  section,
  isActive,
  isEditing,
  editingValue,
  inputRef,
  onSelect,
  onStartEdit,
  onRemove,
  onEditChange,
  onEditCommit,
  onEditKeyDown,
  canRemove,
  readonly,
}: SortableItemProps) => {
  const isDraggable = !readonly && section.type === "section";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: !isDraggable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "pretext-plus-editor__toc-item",
        `pretext-plus-editor__toc-item--${section.type}`,
        isActive ? "pretext-plus-editor__toc-item--active" : "",
        isDragging ? "pretext-plus-editor__toc-item--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isDraggable && (
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
        aria-current={isActive ? "true" : undefined}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            className="pretext-plus-editor__toc-rename-input"
            value={editingValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onKeyDown={onEditKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="pretext-plus-editor__toc-title">
            {section.title || <em>Untitled</em>}
          </span>
        )}
      </button>

      {!readonly && (
        <div className="pretext-plus-editor__toc-actions">
          {section.type === "section" && (
            <button
              type="button"
              className="pretext-plus-editor__toc-action-btn"
              onClick={onStartEdit}
              title="Rename"
              aria-label={`Rename "${section.title}"`}
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
    </li>
  );
};

// ---------------------------------------------------------------------------
// AddDivider — the "+" bar shown between sections
// ---------------------------------------------------------------------------
interface AddDividerProps {
  afterId: string | null;
  onAdd: (afterId: string | null) => void;
  /** When provided, a merge button is shown next to the + button. */
  onMerge?: () => void;
}
const AddDivider = ({ afterId, onAdd, onMerge }: AddDividerProps) => (
  <li className="pretext-plus-editor__toc-add-divider" aria-hidden="true">
    <button
      type="button"
      className="pretext-plus-editor__toc-add-bar"
      onClick={() => onAdd(afterId)}
      title="Add section here"
    >
      <span className="pretext-plus-editor__toc-add-bar-line" />
      <span className="pretext-plus-editor__toc-add-bar-plus">+</span>
      <span className="pretext-plus-editor__toc-add-bar-line" />
    </button>
    {onMerge && (
      <button
        type="button"
        className="pretext-plus-editor__toc-merge-btn"
        onClick={onMerge}
        title="Merge sections above and below"
      >
        ⊕
      </button>
    )}
  </li>
);

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
    onRenameSection,
    onReorderSections,
    onMergeWithNext,
    onAddFirstSection,
    onRefresh,
    editMode,
    onToggleEditMode,
    readonly = false,
  } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const hasIntroduction = sections.some((s) => s.type === "introduction");
  const hasConclusion = sections.some((s) => s.type === "conclusion");

  // Only plain section items are sortable
  const draggableIds = sections
    .filter((s) => s.type === "section")
    .map((s) => s.id);

  // ---------------------------------------------------------------------------
  // Rename helpers
  // ---------------------------------------------------------------------------
  const startEdit = (section: DocumentSection) => {
    setEditingId(section.id);
    setEditingValue(section.title);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (editingId && editingValue.trim()) {
      onRenameSection(editingId, editingValue.trim());
    }
    setEditingId(null);
    setEditingValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setEditingId(null);
      setEditingValue("");
    }
  };

  const handleRemove = (section: DocumentSection) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      onRemoveSection(section.id);
    }
  };

  // ---------------------------------------------------------------------------
  // Drag end handler
  // ---------------------------------------------------------------------------
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(sections, oldIndex, newIndex);

    // Validate invariant: intro first, conclusion last
    const introIdx = next.findIndex((s) => s.type === "introduction");
    const conclusionIdx = next.findIndex((s) => s.type === "conclusion");
    const valid =
      (introIdx === -1 || introIdx === 0) &&
      (conclusionIdx === -1 || conclusionIdx === next.length - 1);

    if (valid) onReorderSections(next);
  };

  // ---------------------------------------------------------------------------
  // Collapsed state
  // ---------------------------------------------------------------------------
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
  // Build the interleaved list: items + add-dividers
  // ---------------------------------------------------------------------------
  // Pre-compute the last plain-section id before each section (for merge logic).
  const prevPlainSectionIds: (string | null)[] = sections.map((_, i) => {
    for (let j = i - 1; j >= 0; j--) {
      if (sections[j].type === "section") return sections[j].id;
    }
    return null;
  });
  const lastPlainSectionId: string | null =
    [...sections].reverse().find((s) => s.type === "section")?.id ?? null;

  const items: React.ReactNode[] = sections.flatMap((section, i) => {
    const isDraggable = section.type === "section";
    const prevId = prevPlainSectionIds[i];
    const canMergeAbove =
      !readonly &&
      onMergeWithNext !== undefined &&
      isDraggable &&
      prevId !== null;

    const divider =
      !readonly && isDraggable ? (
        <AddDivider
          key={`div-before-${section.id}`}
          afterId={prevId}
          onAdd={onAddSection}
          onMerge={canMergeAbove ? () => onMergeWithNext!(prevId!) : undefined}
        />
      ) : null;

    const item = (
      <SortableItem
        key={section.id}
        section={section}
        isActive={section.id === currentSectionId}
        isEditing={editingId === section.id}
        editingValue={editingValue}
        inputRef={inputRef}
        onSelect={() => onSelectSection(section.id)}
        onStartEdit={() => startEdit(section)}
        onRemove={() => handleRemove(section)}
        onEditChange={setEditingValue}
        onEditCommit={commitEdit}
        onEditKeyDown={handleRenameKeyDown}
        canRemove={true}
        readonly={readonly}
      />
    );

    return divider ? [divider, item] : [item];
  });

  // Final add-divider after the last plain section (before conclusion if any)
  if (!readonly && lastPlainSectionId !== null) {
    items.push(
      <AddDivider
        key="div-after-last"
        afterId={lastPlainSectionId}
        onAdd={onAddSection}
      />,
    );
  }

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

      {/* "Edit full document" link — only shown in section editing mode */}
      {editMode === "sectioned" && (
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
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={draggableIds}
          strategy={verticalListSortingStrategy}
        >
          <ul className="pretext-plus-editor__toc-list" role="list">
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
                    + Add first section
                  </button>
                )}
              </li>
            ) : (
              items
            )}
          </ul>
        </SortableContext>
      </DndContext>

      {!readonly && sections.length > 0 && (
        <div className="pretext-plus-editor__toc-footer">
          {!hasIntroduction && (
            <button
              type="button"
              className="pretext-plus-editor__toc-footer-btn"
              onClick={onAddIntroduction}
            >
              + Introduction
            </button>
          )}
          <button
            type="button"
            className="pretext-plus-editor__toc-footer-btn"
            onClick={() => onAddSection(null)}
          >
            + Section
          </button>
          {!hasConclusion && (
            <button
              type="button"
              className="pretext-plus-editor__toc-footer-btn"
              onClick={onAddConclusion}
            >
              + Conclusion
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TableOfContents;
