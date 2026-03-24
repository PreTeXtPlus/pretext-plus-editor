import React from "react";
import "./CodeEditorMenu.css";
import { formatPretext } from "@pretextbook/format";
import type { SourceFormat } from "../types/editor";

interface CodeEditorMenuProps {
  /** Current source content; passed to the formatter when the user clicks "Format PreTeXt". */
  content: string;
  /** Determines which toolbar actions are available (e.g. formatting is PreTeXt-only). */
  sourceFormat: SourceFormat;
  /** Called with the formatted content after a successful format operation. */
  onContentChange: (newContent: string) => void;
  /** Called when the user clicks "Import LaTeX" to open the import dialog. */
  onOpenLatexImport: () => void;
  /** Triggers an undo in the Monaco editor.  Passed through from the parent. */
  onUndo: () => void;
  /** Triggers a redo in the Monaco editor.  Passed through from the parent. */
  onRedo: () => void;
  /** Whether the undo button should be enabled. */
  canUndo: boolean;
  /** Whether the redo button should be enabled. */
  canRedo: boolean;
}

const CodeEditorMenu: React.FC<CodeEditorMenuProps> = ({
  content,
  sourceFormat,
  onContentChange,
  onOpenLatexImport,
}) => {
  const handleFormat = () => {
    try {
      // Format with indentation
      onContentChange(formatPretext(content));
    } catch (error) {
      console.error("Error formatting:", error);
      alert("Error formatting XML");
    }
  };

  return (
    <div className="pretext-plus-editor__code-editor-menu">
      <button
        className="pretext-plus-editor__menu-button"
        onClick={handleFormat}
        title={
          sourceFormat === "pretext"
            ? "Format the PreTeXt source"
            : "Formatting is only available for PreTeXt source"
        }
        disabled={sourceFormat !== "pretext"}
      >
        Format PreTeXt
      </button>
      <button
        className="pretext-plus-editor__menu-button"
        onClick={onOpenLatexImport}
        title="Import LaTeX"
      >
        Import LaTeX
      </button>
    </div>
  );
};

export default CodeEditorMenu;
