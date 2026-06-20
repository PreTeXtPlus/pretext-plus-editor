import type { DocumentSectionType } from "../../types/sections";
import {
  type EditDraft,
  REGULAR_DIVISION_TYPES,
  TYPE_FULL_LABELS,
} from "./types";

interface SectionEditFormProps {
  draft: EditDraft;
  isLatex: boolean;
  /** The root division's type (book/article/slideshow) is structural and not user-editable. */
  isRoot?: boolean;
  onDraftChange: (draft: EditDraft) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const SectionEditForm = ({
  draft,
  isLatex,
  isRoot = false,
  onDraftChange,
  onCommit,
  onCancel,
}: SectionEditFormProps) => (
  <div className="pretext-plus-editor__toc-edit-form">
    <label className="pretext-plus-editor__toc-edit-field">
      <span>Title</span>
      <input
        type="text"
        value={draft.title}
        onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
    </label>
    {!isLatex && (
      <>
        {!isRoot && (
          <label className="pretext-plus-editor__toc-edit-field">
            <span>Type</span>
            <select
              value={draft.type}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  type: e.target.value as DocumentSectionType,
                })
              }
            >
              {REGULAR_DIVISION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_FULL_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="pretext-plus-editor__toc-edit-field">
          <span>xml:id</span>
          <input
            type="text"
            value={draft.xmlId}
            placeholder="optional"
            onChange={(e) => onDraftChange({ ...draft, xmlId: e.target.value })}
          />
        </label>
        <label className="pretext-plus-editor__toc-edit-field">
          <span>label</span>
          <input
            type="text"
            value={draft.label}
            placeholder="optional"
            onChange={(e) => onDraftChange({ ...draft, label: e.target.value })}
          />
        </label>
      </>
    )}
    <div className="pretext-plus-editor__toc-edit-actions">
      <button
        type="button"
        className="pretext-plus-editor__toc-edit-save"
        onClick={onCommit}
      >
        Save
      </button>
      <button
        type="button"
        className="pretext-plus-editor__toc-edit-cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  </div>
);

export default SectionEditForm;
