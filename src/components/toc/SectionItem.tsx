import type { Division } from "../../types/sections";
import SectionEditForm from "./SectionEditForm";
import DivisionMenu, { type DivisionMenuItem } from "./DivisionMenu";
import { type EditDraft, TYPE_FULL_LABELS } from "./types";

interface SectionItemProps {
  division: Division;
  depth: number;
  isActive: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  editDraft: EditDraft | null;
  onSelect: () => void;
  onDraftChange: (draft: EditDraft) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  menuItems: DivisionMenuItem[];
  isLatex: boolean;
  isRoot?: boolean;
}

const SectionItem = ({
  division,
  depth,
  isActive,
  hasChildren,
  isExpanded,
  onToggleExpand,
  editDraft,
  onSelect,
  onDraftChange,
  onEditCommit,
  onEditCancel,
  menuItems,
  isLatex,
  isRoot = false,
}: SectionItemProps) => {
  const isEditing = editDraft !== null;

  return (
    <li
      className={[
        "pretext-plus-editor__toc-item",
        `pretext-plus-editor__toc-item--${division.type}`,
        isActive ? "pretext-plus-editor__toc-item--active" : "",
        isEditing ? "pretext-plus-editor__toc-item--editing" : "",
      ].filter(Boolean).join(" ")}
    >
      <div
        className="pretext-plus-editor__toc-item-row"
        style={depth > 0 ? { paddingLeft: `${depth * 14}px` } : undefined}
      >
        <button
          type="button"
          className="pretext-plus-editor__toc-expand-btn"
          onClick={onToggleExpand}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          tabIndex={hasChildren ? 0 : -1}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {isExpanded ? "▾" : "▸"}
        </button>

        <button
          type="button"
          className="pretext-plus-editor__toc-select"
          onClick={onSelect}
          aria-current={isActive ? "true" : undefined}
          title={TYPE_FULL_LABELS[division.type] ?? division.type}
        >
          <span className="pretext-plus-editor__toc-title">
            {division.title || <em>Untitled</em>}
          </span>
          {!isLatex && division.xmlId && (
            <span className="pretext-plus-editor__toc-xmlid">
              {division.xmlId}
            </span>
          )}
        </button>

        <div className="pretext-plus-editor__toc-actions">
          <DivisionMenu items={menuItems} />
        </div>
      </div>

      {isEditing && editDraft && (
        <SectionEditForm
          draft={editDraft}
          isLatex={isLatex}
          isRoot={isRoot}
          onDraftChange={onDraftChange}
          onCommit={onEditCommit}
          onCancel={onEditCancel}
        />
      )}
    </li>
  );
};

export default SectionItem;
