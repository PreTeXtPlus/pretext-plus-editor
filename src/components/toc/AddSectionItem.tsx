import { useEffect, useRef, useState } from "react";

interface AddSectionItemProps {
  hasIntroduction: boolean;
  hasConclusion: boolean;
  onAddSection: () => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
}

const AddSectionItem = ({
  hasIntroduction,
  hasConclusion,
  onAddSection,
  onAddIntroduction,
  onAddConclusion,
}: AddSectionItemProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);

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

  const pick = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <li ref={containerRef} className="pretext-plus-editor__toc-add-item">
      <button
        type="button"
        className="pretext-plus-editor__toc-add-item-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Add section"
      >
        + add...
      </button>
      {open && (
        <div className="pretext-plus-editor__toc-add-menu-popup">
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
