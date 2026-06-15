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
  Division,
  DocumentSection,
  DocumentSectionType,
} from "../../types/sections";
import SectionList from "./SectionList";
import { useSectionDnd } from "./useSectionDnd";
import { useSectionEdit } from "./useSectionEdit";
import { TYPE_LABELS } from "./types";
import {
  parseDivisionRefs,
  getOrphanedDivisions,
  moveDivisionRef,
} from "../../sectionUtils";

export interface ArticleTocProps {
  // ── Divisions mode ─────────────────────────────────────────────────────────
  /** Flat pool of all project divisions.  When provided, activates divisions mode. */
  divisions?: Division[];
  /** The `xmlId` of the root division. */
  rootDivisionId?: string;
  /** The `xmlId` of the currently active division. */
  activeDivisionId: string | null;
  /** Called when a reorder changes a parent division's ref-placeholder order. */
  onDivisionContentChange?: (xmlId: string, newContent: string) => void;

  // ── Legacy mode ────────────────────────────────────────────────────────────
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
  onToggleEditMode?: () => void;
  readonly: boolean;
}

/**
 * TOC body.  Handles two modes:
 *
 * **Divisions mode** (when `divisions` is provided): reads division order from
 * `<plus:* ref="..."/>` placeholders in the root division's content; shows
 * orphaned divisions (not referenced anywhere) in a separate group at the
 * bottom.  Drag-to-reorder fires `onDivisionContentChange` for the parent.
 *
 * **Legacy mode**: flat section list with drag-and-drop, merge gesture, and
 * "Edit full document" back-link.
 */
const ArticleToc = ({
  divisions,
  rootDivisionId,
  activeDivisionId,
  onDivisionContentChange,
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
  const isDivisionsMode = divisions !== undefined;

  // ── Divisions mode: derive ordered + orphaned lists ────────────────────────
  const rootDivision = isDivisionsMode
    ? (divisions.find((d) => d.xmlId === rootDivisionId) ??
       divisions.find(
         (d) =>
           d.type === "book" ||
           d.type === "article" ||
           d.type === "slideshow",
       ) ??
       divisions[0] ??
       null)
    : null;

  const orderedDivisions: Division[] = [];
  const orphanedDivisions: Division[] = [];

  if (isDivisionsMode && rootDivision) {
    const refs = parseDivisionRefs(rootDivision.content);
    for (const ref of refs) {
      const div = divisions.find((d) => d.xmlId === ref);
      if (div) orderedDivisions.push(div);
    }
    orphanedDivisions.push(
      ...getOrphanedDivisions(divisions, rootDivision.xmlId),
    );
  }

  // ── Reorder handler for divisions mode ────────────────────────────────────
  const handleDivisionsReorder = (reordered: DocumentSection[]) => {
    if (!rootDivision || !onDivisionContentChange) return;
    // Move refs in the root division's content to match the new order.
    let newContent = rootDivision.content;
    const xmlIds = reordered.map((d) => d.xmlId);
    // Rebuild by removing all refs then inserting in new order.
    for (const xmlId of xmlIds) {
      newContent = moveDivisionRef(
        newContent,
        xmlId,
        xmlIds[xmlIds.indexOf(xmlId) - 1] ?? null,
      );
    }
    onDivisionContentChange(rootDivision.xmlId, newContent);
  };

  // ── For legacy mode ────────────────────────────────────────────────────────
  const edit = useSectionEdit();
  const dnd = useSectionDnd({
    sections: isDivisionsMode ? orderedDivisions : sections,
    onReorderSections: isDivisionsMode ? handleDivisionsReorder : onReorderSections,
    onMergeSections: isDivisionsMode ? undefined : onMergeSections,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const displaySections = isDivisionsMode ? orderedDivisions : sections;
  const isLatex = displaySections.some((s) => s.sourceFormat === "latex");

  const handleRemove = (section: DocumentSection) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      onRemoveSection(isDivisionsMode ? section.xmlId : section.id);
    }
  };

  const handleDragStart = (e: Parameters<typeof dnd.handleDragStart>[0]) => {
    edit.cancelEdit();
    dnd.handleDragStart(e);
  };

  const activeSection = displaySections.find((s) => s.id === dnd.activeId);

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
          sections={displaySections}
          currentSectionId={
            isDivisionsMode ? activeDivisionId : currentSectionId
          }
          activeDragId={dnd.activeId}
          dropTarget={dnd.dropTarget}
          mergeTargetId={isDivisionsMode ? null : dnd.mergeTargetId}
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
          onAddFirstSection={isDivisionsMode ? undefined : onAddFirstSection}
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

      {isDivisionsMode && orphanedDivisions.length > 0 && (
        <div className="pretext-plus-editor__toc-orphans">
          <div className="pretext-plus-editor__toc-orphans-heading">
            Unplaced divisions
          </div>
          <ul className="pretext-plus-editor__toc-list">
            {orphanedDivisions.map((div) => (
              <li
                key={div.xmlId}
                className="pretext-plus-editor__toc-item pretext-plus-editor__toc-item--orphan"
              >
                <button
                  type="button"
                  className="pretext-plus-editor__toc-section-btn"
                  onClick={() => onSelectSection(div.xmlId)}
                  title={`xml:id="${div.xmlId}"`}
                >
                  <span className="pretext-plus-editor__toc-type-badge">
                    {TYPE_LABELS[div.type] ?? div.type}
                  </span>
                  <span className="pretext-plus-editor__toc-section-title">
                    {div.title || "Untitled"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default ArticleToc;
