import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface AddSectionItemProps {
  hasIntroduction: boolean;
  hasConclusion: boolean;
  onAddSection: () => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
}

/** Walk up parents to find the nearest element that scrolls vertically. */
function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

const AddSectionItem = ({
  hasIntroduction,
  hasConclusion,
  onAddSection,
  onAddIntroduction,
  onAddConclusion,
}: AddSectionItemProps) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const containerRef = useRef<HTMLLIElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // After the popup is laid out, flip to "above" placement if "below" would
  // be clipped by the nearest scrollable ancestor (typically the TOC list).
  // Only runs while the popup is mounted; the setState is the whole point
  // here — placement must be derived from measured DOM geometry.
  useLayoutEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    const trigger = containerRef.current;
    if (!popup || !trigger) return;
    const scrollContainer =
      findScrollableAncestor(trigger) ?? document.documentElement;
    const popupRect = popup.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const spaceBelow = containerRect.bottom - triggerRect.bottom;
    const spaceAbove = triggerRect.top - containerRect.top;
    const next: "above" | "below" =
      popupRect.height > spaceBelow && spaceAbove > spaceBelow
        ? "above"
        : "below";
    setPlacement(next);
  }, [open, hasIntroduction, hasConclusion]);

  const pick = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <li ref={containerRef} className="pretext-plus-editor__toc-add-item">
      <button
        type="button"
        className="pretext-plus-editor__toc-add-item-trigger"
        onClick={() => {
          setOpen((v) => {
            // Reset placement before each open so the initial render isn't
            // stuck on a stale flip from a previous open.
            if (!v) setPlacement("below");
            return !v;
          });
        }}
        aria-haspopup="true"
        aria-expanded={open}
        title="Add section"
      >
        + add...
      </button>
      {open && (
        <div
          ref={popupRef}
          className={[
            "pretext-plus-editor__toc-add-menu-popup",
            placement === "above"
              ? "pretext-plus-editor__toc-add-menu-popup--above"
              : "pretext-plus-editor__toc-add-menu-popup--below",
          ].join(" ")}
        >
          {!hasIntroduction && (
            <button
              type="button"
              className="pretext-plus-editor__toc-add-menu-item"
              onClick={() => pick(onAddIntroduction)}
            >
              Introduction
            </button>
          )}
          <button
            type="button"
            className="pretext-plus-editor__toc-add-menu-item"
            onClick={() => pick(onAddSection)}
          >
            Section
          </button>
          {!hasConclusion && (
            <button
              type="button"
              className="pretext-plus-editor__toc-add-menu-item"
              onClick={() => pick(onAddConclusion)}
            >
              Conclusion
            </button>
          )}
        </div>
      )}
    </li>
  );
};

export default AddSectionItem;
