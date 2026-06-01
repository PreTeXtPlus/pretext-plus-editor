import { useState } from "react";
import type { DocumentSection, DocumentSectionType } from "../../types/sections";
import { getSectionAttributes } from "../../sectionUtils";
import type { EditDraft } from "./types";

export interface SectionEditState {
  editingId: string | null;
  editDraft: EditDraft | null;
  startEdit: (section: DocumentSection) => void;
  setEditDraft: (draft: EditDraft) => void;
  commitEdit: (
    onUpdateSection: (
      id: string,
      changes: {
        title?: string;
        type?: DocumentSectionType;
        xmlId?: string | null;
        label?: string | null;
      },
    ) => void,
  ) => void;
  cancelEdit: () => void;
}

/**
 * Owns the inline edit-form state for a single section row.  Only one section
 * can be edited at a time; entering edit mode on a new section cancels any
 * in-progress edit.
 */
export function useSectionEdit(): SectionEditState {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const startEdit = (section: DocumentSection) => {
    const { xmlId, label } = getSectionAttributes(section.content);
    setEditingId(section.id);
    setEditDraft({
      title: section.title,
      type: section.type as DocumentSectionType,
      xmlId,
      label,
    });
  };

  const commitEdit = (
    onUpdateSection: (
      id: string,
      changes: {
        title?: string;
        type?: DocumentSectionType;
        xmlId?: string | null;
        label?: string | null;
      },
    ) => void,
  ) => {
    if (editingId && editDraft) {
      onUpdateSection(editingId, {
        title: editDraft.title.trim() || undefined,
        type: editDraft.type,
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
