import { useRef, useState } from "react";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { DocumentSection } from "../../types/sections";
import { isRegularDivision, validateDivisionOrder } from "./types";

export interface SectionDndState {
  activeId: string | null;
  dropTarget: { id: string; position: "before" | "after" } | null;
  mergeTargetId: string | null;
  clearDragState: () => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

export interface SectionDndOptions {
  sections: DocumentSection[];
  onReorderSections: (sections: DocumentSection[]) => void;
  onMergeSections?: (sourceId: string, targetId: string) => void;
}

/**
 * Section drag-and-drop state machine.
 *
 * Tracks:
 *   - the actively dragged section id
 *   - the before/after drop indicator over a hovered item
 *   - a merge target id, set after the dragged item hovers the centre 30 %
 *     of another item for 700 ms.
 *
 * The hook is a pure state holder; callers wire its handlers into a
 * `DndContext` and supply reorder/merge callbacks for the commit step.
 */
export function useSectionDnd({
  sections,
  onReorderSections,
  onMergeSections,
}: SectionDndOptions): SectionDndState {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentOverIdRef = useRef<string | null>(null);

  const clearDragState = () => {
    if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    mergeTimerRef.current = null;
    currentOverIdRef.current = null;
    setActiveId(null);
    setDropTarget(null);
    setMergeTargetId(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropTarget(null);
    setMergeTargetId(null);
    currentOverIdRef.current = null;
  };

  /**
   * onDragMove fires every pointer-move tick. Since we use strategy={() => null},
   * items don't displace, so over.rect is always the stable layout position.
   * We use it to:
   *   1. Compute before/after drop indicator (active center vs over center).
   *   2. Drive the 700 ms merge timer: reset whenever the hovered item changes.
   */
  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDropTarget(null);
      if (currentOverIdRef.current !== null) {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = null;
        currentOverIdRef.current = null;
        setMergeTargetId(null);
      }
      return;
    }

    const overId = over.id as string;
    const activeRect = active.rect.current.translated;

    // Determine where the dragged item's center sits relative to the target.
    // Middle 30% of the target → merge zone; outer 70% → reorder zone.
    let inMergeZone = false;
    if (activeRect && isRegularDivision(overId)) {
      const activeCenter = activeRect.top + activeRect.height / 2;
      const overTop = over.rect.top;
      const overHeight = over.rect.height;
      const zoneFraction = 0.15; // 15% from top/bottom edge = 30% centre band
      const mergeTop = overTop + overHeight * zoneFraction;
      const mergeBottom = overTop + overHeight * (1 - zoneFraction);
      inMergeZone = activeCenter >= mergeTop && activeCenter <= mergeBottom;
    }

    if (activeRect && !inMergeZone) {
      const activeCenter = activeRect.top + activeRect.height / 2;
      const overCenter = over.rect.top + over.rect.height / 2;
      setDropTarget({
        id: overId,
        position: activeCenter < overCenter ? "before" : "after",
      });
    } else if (inMergeZone) {
      setDropTarget(null);
    }

    if (overId !== currentOverIdRef.current) {
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
      currentOverIdRef.current = overId;
      setMergeTargetId(null);
    }

    if (inMergeZone && !mergeTimerRef.current && !mergeTargetId) {
      mergeTimerRef.current = setTimeout(() => {
        setMergeTargetId(overId);
      }, 700);
    } else if (!inMergeZone && mergeTimerRef.current) {
      clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
      setMergeTargetId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const wasMergeTarget = mergeTargetId;
    const savedDropTarget = dropTarget;
    clearDragState();

    const { active } = event;
    const activeSection = sections.find((s) => s.id === active.id);
    if (!activeSection) return;

    if (wasMergeTarget && onMergeSections) {
      const tgt = sections.find((s) => s.id === wasMergeTarget);
      const confirmed = window.confirm(
        `Merge "${activeSection.title ?? "section"}" into "${
          tgt?.title ?? "section"
        }"?\n\nThe dragged section will be appended to the end of the destination section.`,
      );
      if (confirmed) onMergeSections(active.id as string, wasMergeTarget);
      return;
    }

    if (!savedDropTarget) return;

    const without = sections.filter((s) => s.id !== active.id);
    const targetIdx = without.findIndex((s) => s.id === savedDropTarget.id);
    if (targetIdx === -1) return;
    const insertAt =
      savedDropTarget.position === "before" ? targetIdx : targetIdx + 1;
    const next = [
      ...without.slice(0, insertAt),
      activeSection,
      ...without.slice(insertAt),
    ];

    if (validateDivisionOrder(next)) onReorderSections(next);
  };

  return {
    activeId,
    dropTarget,
    mergeTargetId,
    clearDragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
