import { useRef, useState } from "react";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { Division } from "../../types/sections";
import {
  insertDivisionRef,
  normalizeSelfClosingRefs,
  parseDivisionRefs,
  removeDivisionRef,
  type DivisionTreeNode,
} from "../../sectionUtils";

export interface DivisionDndState {
  activeId: string | null;
  dropTarget: { id: string; position: "before" | "after" } | null;
  clearDragState: () => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

export interface DivisionDndOptions {
  /** Depth-first flattened tree of placed divisions (keyed by `xmlId`). */
  nodes: DivisionTreeNode[];
  /** The full division pool (needed to read/write parent content). */
  divisions: Division[];
  /** Persist a parent division's updated content after a move. */
  onDivisionContentChange?: (xmlId: string, content: string) => void;
}

/**
 * Drag-and-drop for the nested divisions TOC.
 *
 * Unlike the legacy flat `useSectionDnd`, this hook understands the tree:
 * a drop computes the *target parent* from the hovered node and either
 * reorders within that parent or moves the dragged division across parents by
 * rewriting `<plus:* ref="..."/>` placeholders.  Dropping a division into its
 * own subtree is rejected.
 */
export function useDivisionDnd({
  nodes,
  divisions,
  onDivisionContentChange,
}: DivisionDndOptions): DivisionDndState {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const dropTargetRef = useRef<{
    id: string;
    position: "before" | "after";
  } | null>(null);

  const setDrop = (next: typeof dropTargetRef.current) => {
    dropTargetRef.current = next;
    setDropTarget(next);
  };

  const clearDragState = () => {
    setActiveId(null);
    setDrop(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDrop(null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDrop(null);
      return;
    }
    const activeRect = active.rect.current.translated;
    if (!activeRect) return;
    const activeCenter = activeRect.top + activeRect.height / 2;
    const overCenter = over.rect.top + over.rect.height / 2;
    setDrop({
      id: over.id as string,
      position: activeCenter < overCenter ? "before" : "after",
    });
  };

  /** Is `ancestorId` an ancestor of `node` (so dropping into it would nest a node inside its own subtree)? */
  const isAncestorOf = (ancestorId: string, node: DivisionTreeNode): boolean => {
    let pid: string | null = node.parentXmlId;
    while (pid) {
      if (pid === ancestorId) return true;
      const parent = nodes.find((n) => n.division.xmlId === pid);
      pid = parent ? parent.parentXmlId : null;
    }
    return false;
  };

  const handleDragEnd = () => {
    const drop = dropTargetRef.current;
    const activeNodeId = activeId;
    clearDragState();
    if (!drop || !activeNodeId || !onDivisionContentChange) return;

    const active = nodes.find((n) => n.division.xmlId === activeNodeId);
    const over = nodes.find((n) => n.division.xmlId === drop.id);
    if (!active || !over || active.division.xmlId === over.division.xmlId) return;

    // Never drop a division into its own subtree.
    if (isAncestorOf(active.division.xmlId, over)) return;

    const newParentXmlId = over.parentXmlId;
    const oldParentXmlId = active.parentXmlId;
    const newParent = divisions.find((d) => d.xmlId === newParentXmlId);
    if (!newParent) return;

    // Compute the sibling to insert after, within the target parent's children
    // (excluding the dragged node so indices stay correct after removal).
    const targetSiblings = parseDivisionRefs(newParent.content).filter(
      (id) => id !== active.division.xmlId,
    );
    const overIdx = targetSiblings.indexOf(over.division.xmlId);
    const afterSibling =
      drop.position === "before"
        ? overIdx <= 0
          ? null
          : targetSiblings[overIdx - 1]
        : over.division.xmlId;

    if (oldParentXmlId === newParentXmlId) {
      // Reorder within the same parent.
      let content = removeDivisionRef(newParent.content, active.division.xmlId);
      content = insertDivisionRef(
        content,
        active.division.xmlId,
        active.division.type,
        afterSibling,
      );
      onDivisionContentChange(
        newParentXmlId,
        normalizeSelfClosingRefs(content),
      );
    } else {
      // Move across parents: remove from old, insert into new.
      const oldParent = divisions.find((d) => d.xmlId === oldParentXmlId);
      if (oldParent) {
        onDivisionContentChange(
          oldParentXmlId,
          normalizeSelfClosingRefs(
            removeDivisionRef(oldParent.content, active.division.xmlId),
          ),
        );
      }
      onDivisionContentChange(
        newParentXmlId,
        normalizeSelfClosingRefs(
          insertDivisionRef(
            newParent.content,
            active.division.xmlId,
            active.division.type,
            afterSibling,
          ),
        ),
      );
    }
  };

  return {
    activeId,
    dropTarget,
    clearDragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
