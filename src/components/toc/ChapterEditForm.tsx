import type { ChapterEditDraft } from "./types";

interface ChapterEditFormProps {
  draft: ChapterEditDraft;
  onDraftChange: (draft: ChapterEditDraft) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/**
 * Inline form for editing a chapter's properties (title, xml:id, label).
 * Reuses the same `toc-edit-*` styles as {@link SectionEditForm}; a chapter
 * has no `type` selector since it is always a chapter.
 */
const ChapterEditForm = ({
  draft,
  onDraftChange,
  onCommit,
  onCancel,
}: ChapterEditFormProps) => (
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

export default ChapterEditForm;
