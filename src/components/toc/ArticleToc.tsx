import { Fragment } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type {
  Division,
  DocumentSection,
  DocumentSectionType,
} from "../../types/sections";
import SectionList from "./SectionList";
import SortableSectionItem from "./SortableSectionItem";
import { useSectionDnd } from "./useSectionDnd";
import { useDivisionDnd } from "./useDivisionDnd";
import { useSectionEdit } from "./useSectionEdit";
import { TYPE_LABELS } from "./types";
import {
  buildDivisionTree,
  getOrphanRoots,
  insertDivisionRef,
  normalizeSelfClosingRefs,
  removeDivisionRef,
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

/** Adapt a `Division` to the `DocumentSection` shape the shared item components
 * expect, normalising `id` to `xmlId` so dnd / selection keys are stable. */
const asSection = (d: Division): DocumentSection => ({ ...d, id: d.xmlId });

/**
 * TOC body.  Handles two modes:
 *
 * **Divisions mode** (when `divisions` is provided): renders the full division
 * tree (depth-first, indented) read from `<plus:* ref="..."/>` placeholders;
 * supports drag-to-reorder and cross-parent moves, an "unplace" action that
 * detaches a division into the "Unplaced divisions" group, and a "+" action to
 * place orphaned divisions back into the root.
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
  const edit = useSectionEdit();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Divisions mode: locate root, build tree + orphan roots ─────────────────
  const rootDivision =
    isDivisionsMode && divisions
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

  const treeNodes =
    isDivisionsMode && rootDivision && divisions
      ? buildDivisionTree(divisions, rootDivision.xmlId)
      : [];
  const orphanRoots =
    isDivisionsMode && rootDivision && divisions
      ? getOrphanRoots(divisions, rootDivision.xmlId)
      : [];

  const divisionDnd = useDivisionDnd({
    nodes: treeNodes,
    divisions: divisions ?? [],
    onDivisionContentChange,
  });

  // ── Legacy mode dnd ────────────────────────────────────────────────────────
  const dnd = useSectionDnd({
    sections: isDivisionsMode ? [] : sections,
    onReorderSections,
    onMergeSections: isDivisionsMode ? undefined : onMergeSections,
  });

  // ── Divisions mode actions ─────────────────────────────────────────────────
  /** Detach a division from its parent (keep the record → it becomes orphaned). */
  const handleUnplace = (xmlId: string, parentXmlId: string) => {
    if (!divisions || !onDivisionContentChange) return;
    const parent = divisions.find((d) => d.xmlId === parentXmlId);
    if (!parent) return;
    onDivisionContentChange(
      parent.xmlId,
      normalizeSelfClosingRefs(removeDivisionRef(parent.content, xmlId)),
    );
  };

  /** Permanently delete a division, first detaching it from its parent. */
  const handleDivisionDelete = (
    division: Division,
    parentXmlId: string | null,
  ) => {
    if (
      !window.confirm(
        `Delete "${division.title || "Untitled"}"? This permanently removes the division.`,
      )
    ) {
      return;
    }
    if (parentXmlId && divisions && onDivisionContentChange) {
      const parent = divisions.find((d) => d.xmlId === parentXmlId);
      if (parent) {
        onDivisionContentChange(
          parent.xmlId,
          normalizeSelfClosingRefs(
            removeDivisionRef(parent.content, division.xmlId),
          ),
        );
      }
    }
    onRemoveSection(division.xmlId);
  };

  /** Place an orphaned division into the root (append a `<plus:* ref/>`). */
  const handlePlaceOrphan = (orphan: Division) => {
    if (!rootDivision || !onDivisionContentChange) return;
    onDivisionContentChange(
      rootDivision.xmlId,
      normalizeSelfClosingRefs(
        insertDivisionRef(
          rootDivision.content,
          orphan.xmlId,
          orphan.type,
          null,
        ),
      ),
    );
  };

  // ── Legacy mode handlers ───────────────────────────────────────────────────
  const handleRemove = (section: DocumentSection) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      onRemoveSection(section.id);
    }
  };

  const handleLegacyDragStart = (
    e: Parameters<typeof dnd.handleDragStart>[0],
  ) => {
    edit.cancelEdit();
    dnd.handleDragStart(e);
  };

  const handleDivisionDragStart = (
    e: Parameters<typeof divisionDnd.handleDragStart>[0],
  ) => {
    edit.cancelEdit();
    divisionDnd.handleDragStart(e);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Divisions mode render
  // ─────────────────────────────────────────────────────────────────────────
  if (isDivisionsMode) {
    const activeNode = treeNodes.find(
      (n) => n.division.xmlId === divisionDnd.activeId,
    );

    return (
      <>
        {rootDivision && (
          <button
            type="button"
            className={`pretext-plus-editor__toc-root-btn${
              activeDivisionId === rootDivision.xmlId
                ? " pretext-plus-editor__toc-root-btn--active"
                : ""
            }`}
            onClick={() => onSelectSection(rootDivision.xmlId)}
            title={`Edit root ${rootDivision.type} — contains the structural <plus:*> refs\nxml:id="${rootDivision.xmlId}"`}
          >
            <span className="pretext-plus-editor__toc-type-badge">
              {TYPE_LABELS[rootDivision.type] ?? rootDivision.type}
            </span>
            <span className="pretext-plus-editor__toc-section-title">
              {rootDivision.title || "Root document"}
            </span>
          </button>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDivisionDragStart}
          onDragMove={divisionDnd.handleDragMove}
          onDragEnd={divisionDnd.handleDragEnd}
          onDragCancel={divisionDnd.clearDragState}
        >
          <SortableContext
            items={treeNodes.map((n) => n.division.xmlId)}
            strategy={() => null}
          >
            <ul className="pretext-plus-editor__toc-list" role="list">
              {treeNodes.length === 0 ? (
                <li className="pretext-plus-editor__toc-no-sections">
                  <span>No placed divisions</span>
                </li>
              ) : (
                treeNodes.map((node) => {
                  const section = asSection(node.division);
                  return (
                    <SortableSectionItem
                      key={node.division.xmlId}
                      section={section}
                      depth={node.depth}
                      isActive={node.division.xmlId === activeDivisionId}
                      isBeingDragged={
                        divisionDnd.activeId === node.division.xmlId
                      }
                      isDropBefore={
                        divisionDnd.dropTarget?.id === node.division.xmlId &&
                        divisionDnd.dropTarget.position === "before"
                      }
                      isDropAfter={
                        divisionDnd.dropTarget?.id === node.division.xmlId &&
                        divisionDnd.dropTarget.position === "after"
                      }
                      isMergeTarget={false}
                      editDraft={
                        edit.editingId === node.division.xmlId
                          ? edit.editDraft
                          : null
                      }
                      onSelect={() => onSelectSection(node.division.xmlId)}
                      onStartEdit={() => edit.startEdit(section)}
                      onRemove={() =>
                        handleDivisionDelete(node.division, node.parentXmlId)
                      }
                      onUnplace={() =>
                        handleUnplace(node.division.xmlId, node.parentXmlId)
                      }
                      onDraftChange={edit.setEditDraft}
                      onEditCommit={() => edit.commitEdit(onUpdateSection)}
                      onEditCancel={edit.cancelEdit}
                      canRemove={true}
                      readonly={false}
                      isLatex={node.division.sourceFormat === "latex"}
                      dragEnabled={true}
                    />
                  );
                })
              )}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeNode && (
              <div className="pretext-plus-editor__toc-drag-overlay">
                <span className="pretext-plus-editor__toc-drag-overlay-badge">
                  {TYPE_LABELS[activeNode.division.type] ??
                    activeNode.division.type}
                </span>
                <span className="pretext-plus-editor__toc-drag-overlay-title">
                  {activeNode.division.title || "Untitled"}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {orphanRoots.length > 0 && (
          <div className="pretext-plus-editor__toc-orphans">
            <div className="pretext-plus-editor__toc-orphans-heading">
              Unplaced divisions
            </div>
            <ul className="pretext-plus-editor__toc-list">
              {orphanRoots.map((root) => {
                const subtree = divisions
                  ? buildDivisionTree(divisions, root.xmlId)
                  : [];
                return (
                  <Fragment key={root.xmlId}>
                    <li className="pretext-plus-editor__toc-item pretext-plus-editor__toc-item--orphan">
                      <button
                        type="button"
                        className="pretext-plus-editor__toc-section-btn"
                        onClick={() => onSelectSection(root.xmlId)}
                        title={`xml:id="${root.xmlId}"`}
                      >
                        <span className="pretext-plus-editor__toc-type-badge">
                          {TYPE_LABELS[root.type] ?? root.type}
                        </span>
                        <span className="pretext-plus-editor__toc-section-title">
                          {root.title || "Untitled"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="pretext-plus-editor__toc-orphan-place-btn"
                        onClick={() => handlePlaceOrphan(root)}
                        title="Place in document (append to root)"
                      >
                        +
                      </button>
                    </li>
                    {subtree.map((node) => (
                      <li
                        key={node.division.xmlId}
                        className="pretext-plus-editor__toc-item pretext-plus-editor__toc-item--orphan"
                      >
                        <button
                          type="button"
                          className="pretext-plus-editor__toc-section-btn"
                          style={{ paddingLeft: `${(node.depth + 1) * 14 + 6}px` }}
                          onClick={() => onSelectSection(node.division.xmlId)}
                          title={`xml:id="${node.division.xmlId}"`}
                        >
                          <span className="pretext-plus-editor__toc-type-badge">
                            {TYPE_LABELS[node.division.type] ??
                              node.division.type}
                          </span>
                          <span className="pretext-plus-editor__toc-section-title">
                            {node.division.title || "Untitled"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </Fragment>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Legacy mode render
  // ─────────────────────────────────────────────────────────────────────────
  const isLatex = sections.some((s) => s.sourceFormat === "latex");
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
        onDragStart={handleLegacyDragStart}
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
