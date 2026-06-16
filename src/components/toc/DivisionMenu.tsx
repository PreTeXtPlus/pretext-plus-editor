import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface DivisionMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface DivisionMenuProps {
  items: DivisionMenuItem[];
}

function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

const DivisionMenu = ({ items }: DivisionMenuProps) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  useLayoutEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    const trigger = containerRef.current;
    if (!popup || !trigger) return;
    const scrollContainer = findScrollableAncestor(trigger) ?? document.documentElement;
    const popupRect = popup.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const spaceBelow = containerRect.bottom - triggerRect.bottom;
    const spaceAbove = triggerRect.top - containerRect.top;
    setPlacement(popupRect.height > spaceBelow && spaceAbove > spaceBelow ? "above" : "below");
  }, [open]);

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={containerRef} className="pretext-plus-editor__toc-div-menu">
      <button
        type="button"
        className="pretext-plus-editor__toc-div-menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => {
            if (!v) setPlacement("below");
            return !v;
          });
        }}
        aria-haspopup="true"
        aria-expanded={open}
        title="More options"
      >
        ⋮
      </button>
      {open && (
        <div
          ref={popupRef}
          className={[
            "pretext-plus-editor__toc-div-menu-popup",
            placement === "above"
              ? "pretext-plus-editor__toc-div-menu-popup--above"
              : "pretext-plus-editor__toc-div-menu-popup--below",
          ].join(" ")}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={[
                "pretext-plus-editor__toc-div-menu-item",
                item.danger ? "pretext-plus-editor__toc-div-menu-item--danger" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => pick(item.onClick)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DivisionMenu;
