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
import type { Division } from "../../types/sections";
import SectionList from "./SectionList";
import SortableSectionItem from "./SortableSectionItem";
import { useSectionDnd } from "./useSectionDnd";
import { useDivisionDnd } from "./useDivisionDnd";
import { TYPE_LABELS } from "./types";
import {
  buildDivisionTree,
  getOrphanRoots,
  insertDivisionRef,
  normalizeSelfClosingRefs,
  removeDivisionRef,
} from "../../sectionUtils";
import { useEditorStore } from "../../store/hooks";

export interface ArticleTocProps {
  /** When provided, shows an "Open asset picker" button at the bottom of the TOC. */
  onOpenAssetPicker?: () => void;
}

/** Adapt a `Division` to the `DocumentSection` shape the shared item components
 * expect, normalising `id` to `xmlId` so dnd / selection keys are stable. */
const asSection = (d: Division): Division => ({ ...d, id: d.xmlId });

/**
 * TOC body.  Reads all data and action callbacks from the editor store.
 */
const ArticleToc = ({ onOpenAssetPicker }: ArticleTocProps) => {
  const isDivisionsMode = useEditorStore((s) => s.isDivisionsMode);
  const divisions = useEditorStore((s) => s.divisions);
  const rootDivisionId = useEditorStore((s) => s.rootDivisionId);
  const activeDivisionId = useEditorStore((s) => s.activeDivisionId);
  const sections = useEditorStore((s) => s.sections);
  const currentSectionId = useEditorStore((s) => s.currentSectionId);
  const editMode = useEditorStore((s) => s.editMode);
  const readonly = useEditorStore((s) => s.tocReadonly);
  const isLatex = useEditorStore((s) => s.isLatexDoc);

  // Store actions
  const selectSection = useEditorStore((s) => s.selectSection);
  const addSection = useEditorStore((s) => s.addSection);
  const addIntroduction = useEditorStore((s) => s.addIntroduction);
  const addConclusion = useEditorStore((s) => s.addConclusion);
  const removeSection = useEditorStore((s) => s.removeSection);
  const reorderSections = useEditorStore((s) => s.reorderSections);
  const mergeSections = useEditorStore((s) => s.mergeSections);
  const addFirstSection = useEditorStore((s) => s.addFirstSection);
  const toggleEditMode = useEditorStore((s) => s.toggleEditMode);
  const divisionContentChange = useEditorStore((s) => s.divisionContentChange);

  // In legacy mode these are always available; isDivisionsMode gates the UI.
  const canAddFirstSection = !isDivisionsMode;
  const canToggleEditMode = !isDivisionsMode;
  const canMergeSections = !isDivisionsMode;

  // Edit form
  const startSectionEdit = useEditorStore((s) => s.startSectionEdit);
  const setEditDraft = useEditorStore((s) => s.setEditDraft);
  const commitSectionEdit = useEditorStore((s) => s.commitSectionEdit);
  const cancelSectionEdit = useEditorStore((s) => s.cancelSectionEdit);
  const editingId = useEditorStore((s) => s.editingId);
  const editDraft = useEditorStore((s) => s.editDraft);

  // Store has stable action references but these optional callbacks
  // (mergeSections, addFirstSection, toggleEditMode, divisionContentChange)
  // may be undefined — read once here and pass down.

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
    onDivisionContentChange: divisionContentChange,
  });

  // ── Legacy mode dnd ────────────────────────────────────────────────────────
  const dnd = useSectionDnd({
    sections: isDivisionsMode ? [] : sections,
    onReorderSections: reorderSections,
    onMergeSections: canMergeSections ? mergeSections : undefined,
  });

  // ── Divisions mode actions ─────────────────────────────────────────────────
  const handleUnplace = (xmlId: string, parentXmlId: string) => {
    if (!divisions || !divisionContentChange) return;
    const parent = divisions.find((d) => d.xmlId === parentXmlId);
    if (!parent) return;
    divisionContentChange(
      parent.xmlId,
      normalizeSelfClosingRefs(removeDivisionRef(parent.content, xmlId)),
    );
  };

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
    if (parentXmlId && divisions && divisionContentChange) {
      const parent = divisions.find((d) => d.xmlId === parentXmlId);
      if (parent) {
        divisionContentChange(
          parent.xmlId,
          normalizeSelfClosingRefs(
            removeDivisionRef(parent.content, division.xmlId),
          ),
        );
      }
    }
    removeSection(division.xmlId);
  };

  const handlePlaceOrphan = (orphan: Division) => {
    if (!rootDivision || !divisionContentChange) return;
    divisionContentChange(
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
  const handleRemoveLegacy = (section: Division) => {
    if (window.confirm(`Remove "${section.title}"? This cannot be undone.`)) {
      removeSection(section.id);
    }
  };

  const handleLegacyDragStart = (
    e: Parameters<typeof dnd.handleDragStart>[0],
  ) => {
    cancelSectionEdit();
    dnd.handleDragStart(e);
  };

  const handleDivisionDragStart = (
    e: Parameters<typeof divisionDnd.handleDragStart>[0],
  ) => {
    cancelSectionEdit();
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
            onClick={() => selectSection(rootDivision.xmlId)}
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
                      isActive={activeDivisionId === node.division.xmlId}
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
                        editingId === node.division.xmlId ? editDraft : null
                      }
                      onSelect={() => selectSection(node.division.xmlId)}
                      onStartEdit={() => startSectionEdit(section)}
                      onRemove={() =>
                        handleDivisionDelete(node.division, node.parentXmlId)
                      }
                      onUnplace={() =>
                        handleUnplace(node.division.xmlId, node.parentXmlId)
                      }
                      onDraftChange={setEditDraft}
                      onEditCommit={commitSectionEdit}
                      onEditCancel={cancelSectionEdit}
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
                        onClick={() => selectSection(root.xmlId)}
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
                          onClick={() => selectSection(node.division.xmlId)}
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

        {onOpenAssetPicker && (
          <button
            type="button"
            className="pretext-plus-editor__toc-assets-btn"
            onClick={onOpenAssetPicker}
          >
            Manage Assets
          </button>
        )}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Legacy mode render
  // ─────────────────────────────────────────────────────────────────────────
  const activeSection = sections.find((s) => s.id === dnd.activeId);

  return (
    <>
      {editMode === "sectioned" && canToggleEditMode && (
        <button
          type="button"
          className="pretext-plus-editor__toc-fulldoc-link"
          onClick={toggleEditMode}
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
          editingId={editingId}
          editDraft={editDraft}
          isLatex={isLatex}
          readonly={readonly}
          listClassName="pretext-plus-editor__toc-list"
          role="list"
          onSelectSection={selectSection}
          onStartEdit={startSectionEdit}
          onRemove={handleRemoveLegacy}
          onDraftChange={setEditDraft}
          onEditCommit={commitSectionEdit}
          onEditCancel={cancelSectionEdit}
          onAddFirstSection={canAddFirstSection ? addFirstSection : undefined}
          onAddSection={() => addSection(null)}
          onAddIntroduction={addIntroduction}
          onAddConclusion={addConclusion}
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

      {onOpenAssetPicker && (
        <button
          type="button"
          className="pretext-plus-editor__toc-assets-btn"
          onClick={onOpenAssetPicker}
        >
          Manage Assets
        </button>
      )}
    </>
  );
};

export default ArticleToc;
