import { Fragment, useEffect, useState } from "react";
import type { Division } from "../../types/sections";
import SectionItem from "./SectionItem";

import {
  buildDivisionTree,
  getOrphanRoots,
  insertDivisionRef,
  normalizeSelfClosingRefs,
  removeDivisionRef,
} from "../../sectionUtils";
import { useEditorStore } from "../../store/hooks";

export interface ArticleTocProps {
  onOpenAssetPicker?: () => void;
}

const ArticleToc = ({ onOpenAssetPicker }: ArticleTocProps) => {
  const divisions = useEditorStore((s) => s.divisions);
  const rootDivisionId = useEditorStore((s) => s.rootDivisionId);
  const activeDivisionId = useEditorStore((s) => s.activeDivisionId);

  const selectSection = useEditorStore((s) => s.selectSection);
  const removeSection = useEditorStore((s) => s.removeSection);
  const divisionContentChange = useEditorStore((s) => s.divisionContentChange);
  const insertAtCursor = useEditorStore((s) => s.insertAtCursor);

  const startSectionEdit = useEditorStore((s) => s.startSectionEdit);
  const setEditDraft = useEditorStore((s) => s.setEditDraft);
  const commitSectionEdit = useEditorStore((s) => s.commitSectionEdit);
  const cancelSectionEdit = useEditorStore((s) => s.cancelSectionEdit);
  const editingId = useEditorStore((s) => s.editingId);
  const editDraft = useEditorStore((s) => s.editDraft);

  // ── Tree structure ──────────────────────────────────────────────────────────
  const rootDivision = divisions
    ? (divisions.find((d) => d.xmlId === rootDivisionId) ??
        divisions.find(
          (d) =>
            d.type === "book" || d.type === "article" || d.type === "slideshow",
        ) ??
        divisions[0] ??
        null)
    : null;

  const treeNodes =
    rootDivision && divisions
      ? buildDivisionTree(divisions, rootDivision.xmlId)
      : [];

  const orphanRoots =
    rootDivision && divisions
      ? getOrphanRoots(divisions, rootDivision.xmlId)
      : [];

  // ── Expand/collapse: track which IDs are collapsed (empty = all open) ───────
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const isExpanded = (id: string) => !collapsedIds.has(id);

  const toggleExpand = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-expand ancestors when the active division changes so it's always visible.
  useEffect(() => {
    if (!activeDivisionId || !rootDivision) return;
    const nodeMap = new Map(treeNodes.map((n) => [n.division.xmlId, n]));
    const toReveal = new Set<string>();
    toReveal.add(rootDivision.xmlId);
    let cur = activeDivisionId;
    while (cur) {
      const node = nodeMap.get(cur);
      if (!node?.parentXmlId) break;
      toReveal.add(node.parentXmlId);
      cur = node.parentXmlId;
    }
    setCollapsedIds((prev) => {
      if ([...toReveal].every((id) => !prev.has(id))) return prev;
      const next = new Set(prev);
      toReveal.forEach((id) => next.delete(id));
      return next;
    });
  }, [activeDivisionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Which IDs have children (used to show/hide the chevron) ────────────────
  const idsWithChildren = new Set(
    treeNodes.map((n) => n.parentXmlId).filter(Boolean) as string[],
  );

  // ── Compute visible placed nodes (single O(n) depth-first pass) ─────────────
  // visibleParents: IDs whose children should be rendered.
  // A node is rendered if its direct parentXmlId is in visibleParents.
  // It's added to visibleParents only if it itself is not collapsed.
  const visibleNodes: typeof treeNodes = [];
  if (rootDivision) {
    const visibleParents = new Set<string>();
    if (isExpanded(rootDivision.xmlId)) visibleParents.add(rootDivision.xmlId);
    for (const node of treeNodes) {
      if (node.parentXmlId && visibleParents.has(node.parentXmlId)) {
        visibleNodes.push(node);
        if (isExpanded(node.division.xmlId)) {
          visibleParents.add(node.division.xmlId);
        }
      }
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleUnplace = (xmlId: string, parentXmlId: string) => {
    if (!divisions) return;
    const parent = divisions.find((d) => d.xmlId === parentXmlId);
    if (!parent) return;
    divisionContentChange(
      parent.xmlId,
      normalizeSelfClosingRefs(removeDivisionRef(parent.content, xmlId)),
    );
  };

  const handleDelete = (division: Division, parentXmlId: string | null) => {
    if (
      !window.confirm(
        `Delete "${division.title || "Untitled"}"? This permanently removes the division.`,
      )
    )
      return;
    if (parentXmlId && divisions) {
      const parent = divisions.find((d) => d.xmlId === parentXmlId);
      if (parent) {
        divisionContentChange(
          parent.xmlId,
          normalizeSelfClosingRefs(removeDivisionRef(parent.content, division.xmlId)),
        );
      }
    }
    removeSection(division.xmlId);
  };

  const handleInsertAtCursor = (division: Division) => {
    insertAtCursor(`<plus:${division.type} ref="${division.xmlId}"/>`);
  };

  const handlePlaceOrphan = (orphan: Division) => {
    if (!rootDivision) return;
    divisionContentChange(
      rootDivision.xmlId,
      normalizeSelfClosingRefs(
        insertDivisionRef(rootDivision.content, orphan.xmlId, orphan.type, null),
      ),
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <ul className="pretext-plus-editor__toc-list" role="list">
        {/* Root division — depth 0, always visible */}
        {rootDivision && (
          <SectionItem
            division={rootDivision}
            depth={0}
            isActive={activeDivisionId === rootDivision.xmlId}
            hasChildren={idsWithChildren.has(rootDivision.xmlId)}
            isExpanded={isExpanded(rootDivision.xmlId)}
            onToggleExpand={() => toggleExpand(rootDivision.xmlId)}
            editDraft={editingId === rootDivision.xmlId ? editDraft : null}
            onSelect={() => selectSection(rootDivision.xmlId)}
            onDraftChange={setEditDraft}
            onEditCommit={commitSectionEdit}
            onEditCancel={cancelSectionEdit}
            menuItems={[
              {
                label: "Edit properties",
                onClick: () => startSectionEdit(rootDivision),
              },
            ]}
            isLatex={rootDivision.sourceFormat === "latex"}
          />
        )}

        {/* Placed divisions — depth offset by 1 since root is now at depth 0 */}
        {visibleNodes.length === 0 && rootDivision && isExpanded(rootDivision.xmlId) && (
          <li className="pretext-plus-editor__toc-no-sections">
            <span>No placed divisions</span>
          </li>
        )}
        {visibleNodes.map((node) => (
          <SectionItem
            key={node.division.xmlId}
            division={node.division}
            depth={node.depth + 1}
            isActive={activeDivisionId === node.division.xmlId}
            hasChildren={idsWithChildren.has(node.division.xmlId)}
            isExpanded={isExpanded(node.division.xmlId)}
            onToggleExpand={() => toggleExpand(node.division.xmlId)}
            editDraft={editingId === node.division.xmlId ? editDraft : null}
            onSelect={() => selectSection(node.division.xmlId)}
            onDraftChange={setEditDraft}
            onEditCommit={commitSectionEdit}
            onEditCancel={cancelSectionEdit}
            menuItems={[
              {
                label: "Edit properties",
                onClick: () => startSectionEdit(node.division),
              },
              {
                label: "Remove from document",
                onClick: () => handleUnplace(node.division.xmlId, node.parentXmlId!),
              },
              {
                label: "Delete from project",
                onClick: () => handleDelete(node.division, node.parentXmlId),
                danger: true,
              },
            ]}
            isLatex={node.division.sourceFormat === "latex"}
          />
        ))}
      </ul>

      {/* Unplaced divisions */}
      {orphanRoots.length > 0 && (
        <div className="pretext-plus-editor__toc-orphans">
          <div className="pretext-plus-editor__toc-orphans-heading">
            Unplaced divisions
          </div>
          <ul className="pretext-plus-editor__toc-list">
            {orphanRoots.map((orphan) => {
              const subtree = divisions
                ? buildDivisionTree(divisions, orphan.xmlId)
                : [];
              const subtreeIdsWithChildren = new Set(
                subtree.map((n) => n.parentXmlId).filter(Boolean) as string[],
              );
              return (
                <Fragment key={orphan.xmlId}>
                  <SectionItem
                    division={orphan}
                    depth={0}
                    isActive={activeDivisionId === orphan.xmlId}
                    hasChildren={subtreeIdsWithChildren.has(orphan.xmlId)}
                    isExpanded={isExpanded(orphan.xmlId)}
                    onToggleExpand={() => toggleExpand(orphan.xmlId)}
                    editDraft={editingId === orphan.xmlId ? editDraft : null}
                    onSelect={() => selectSection(orphan.xmlId)}
                    onDraftChange={setEditDraft}
                    onEditCommit={commitSectionEdit}
                    onEditCancel={cancelSectionEdit}
                    menuItems={[
                      {
                        label: "Edit properties",
                        onClick: () => startSectionEdit(orphan),
                      },
                      {
                        label: "Place in document",
                        onClick: () => handlePlaceOrphan(orphan),
                      },
                      {
                        label: "Insert at cursor",
                        onClick: () => handleInsertAtCursor(orphan),
                      },
                      {
                        label: "Delete from project",
                        onClick: () => handleDelete(orphan, null),
                        danger: true,
                      },
                    ]}
                    isLatex={orphan.sourceFormat === "latex"}
                  />
                  {isExpanded(orphan.xmlId) &&
                    subtree.map((node) => (
                      <SectionItem
                        key={node.division.xmlId}
                        division={node.division}
                        depth={node.depth + 1}
                        isActive={activeDivisionId === node.division.xmlId}
                        hasChildren={subtreeIdsWithChildren.has(node.division.xmlId)}
                        isExpanded={isExpanded(node.division.xmlId)}
                        onToggleExpand={() => toggleExpand(node.division.xmlId)}
                        editDraft={editingId === node.division.xmlId ? editDraft : null}
                        onSelect={() => selectSection(node.division.xmlId)}
                        onDraftChange={setEditDraft}
                        onEditCommit={commitSectionEdit}
                        onEditCancel={cancelSectionEdit}
                        menuItems={[
                          {
                            label: "Edit properties",
                            onClick: () => startSectionEdit(node.division),
                          },
                          {
                            label: "Insert at cursor",
                            onClick: () => handleInsertAtCursor(node.division),
                          },
                          {
                            label: "Delete from project",
                            onClick: () => handleDelete(node.division, node.parentXmlId),
                            danger: true,
                          },
                        ]}
                        isLatex={node.division.sourceFormat === "latex"}
                      />
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
};

export default ArticleToc;
