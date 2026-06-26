import type { DocumentSectionType } from "../../types/sections";
import type { SourceFormat } from "../../types/editor";
import {
  type EditDraft,
  REGULAR_DIVISION_TYPES,
  SOURCE_FORMAT_LABELS,
  TYPE_FULL_LABELS,
} from "./types";

interface SectionEditFormProps {
  draft: EditDraft;
  /** True only while editing a division that hasn't been saved yet — only then is `sourceFormat` choosable. */
  isNew?: boolean;
  /** The root division's type (book/article/slideshow) is structural and not user-editable. */
  isRoot?: boolean;
  onDraftChange: (draft: EditDraft) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const SectionEditForm = ({
  draft,
  isNew = false,
  isRoot = false,
  onDraftChange,
  onCommit,
  onCancel,
}: SectionEditFormProps) => {
  return (
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
    {/* Source format can only be chosen while the division is new (unsaved) —
        an existing division's source can't be losslessly translated between
        formats, so it's shown read-only once saved. */}
    {isNew ? (
      <label className="pretext-plus-editor__toc-edit-field">
        <span>Format</span>
        <select
          value={draft.sourceFormat}
          onChange={(e) =>
            onDraftChange({
              ...draft,
              sourceFormat: e.target.value as SourceFormat,
            })
          }
        >
          {(Object.keys(SOURCE_FORMAT_LABELS) as SourceFormat[]).map((f) => (
            <option key={f} value={f}>
              {SOURCE_FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
      </label>
    ): undefined}
    {/* Type applies to every format: a LaTeX `\section` can still be authored
        as any division type — the type is applied when its conversion is
        tagged, not stored in the LaTeX source. */}
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
    {/* xml:id applies to every format — for LaTeX it's written as the
        `\section`'s `\label`. */}
    <label className="pretext-plus-editor__toc-edit-field">
      <span>id</span>
      <input
        type="text"
        value={draft.xmlId}
        placeholder="unique identifier"
        onChange={(e) => onDraftChange({ ...draft, xmlId: e.target.value })}
      />
    </label>
    {/* LaTeX has no representation for PreTeXt's separate `label` attribute. */}
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
};

export default SectionEditForm;
