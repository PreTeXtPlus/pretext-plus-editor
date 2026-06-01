import { useState } from "react";
import type { DocumentChapter } from "../../types/sections";
import type { ChapterEditDraft } from "./types";

export interface ChapterEditState {
  editingId: string | null;
  editDraft: ChapterEditDraft | null;
  startEdit: (chapter: DocumentChapter) => void;
  setEditDraft: (draft: ChapterEditDraft) => void;
  commitEdit: (
    onUpdateChapter: (
      id: string,
      changes: { title?: string; xmlId?: string | null; label?: string | null },
    ) => void,
  ) => void;
  cancelEdit: () => void;
}

/**
 * Owns the inline edit-form state for a single chapter row.  Mirrors
 * {@link useSectionEdit}: only one chapter can be edited at a time, and the
 * draft is seeded from the chapter's metadata (title, xml:id, label) rather
 * than re-parsing its source, since non-active chapters may not be loaded.
 */
export function useChapterEdit(): ChapterEditState {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ChapterEditDraft | null>(null);

  const startEdit = (chapter: DocumentChapter) => {
    setEditingId(chapter.id);
    setEditDraft({
      title: chapter.title ?? "",
      xmlId: chapter.xmlId ?? "",
      label: chapter.label ?? "",
    });
  };

  const commitEdit = (
    onUpdateChapter: (
      id: string,
      changes: { title?: string; xmlId?: string | null; label?: string | null },
    ) => void,
  ) => {
    if (editingId && editDraft) {
      onUpdateChapter(editingId, {
        title: editDraft.title.trim() || undefined,
        xmlId: editDraft.xmlId.trim() || null,
        label: editDraft.label.trim() || null,
      });
    }
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  return {
    editingId,
    editDraft,
    startEdit,
    setEditDraft,
    commitEdit,
    cancelEdit,
  };
}
