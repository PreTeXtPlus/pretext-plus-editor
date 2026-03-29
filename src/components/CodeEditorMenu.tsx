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
  /**
   * If provided, a "Convert to PreTeXt" button is shown.
   * Called when the user clicks to promote the derived PreTeXt to the canonical source.
   */
  onConvertToPretext?: () => void;
  /**
   * Controls whether the "Convert to PreTeXt" button is enabled.
   * Should be `false` when conversion has failed.
   */
  canConvertToPretext?: boolean;
}

const CodeEditorMenu: React.FC<CodeEditorMenuProps> = ({
  content,
  sourceFormat,
  onContentChange,
  onOpenLatexImport,
  onConvertToPretext,
  canConvertToPretext,
}) => {
  const handleFormat = () => {
    try {
      onContentChange(formatPretext(content));
    } catch (error) {
      console.error("Error formatting:", error);
      alert("Error formatting XML");
    }
  };

  return (
    <div className="pretext-plus-editor__code-editor-menu">
      {sourceFormat === "latex" ? (
        <button
          className="pretext-plus-editor__menu-button pretext-plus-editor__menu-button--convert"
          onClick={onConvertToPretext}
          disabled={canConvertToPretext === false}
          title="Promote the current derived PreTeXt into the canonical source"
        >
          Convert to PreTeXt
        </button>
      ) : (
        <>
          <button
            className="pretext-plus-editor__menu-button"
            onClick={handleFormat}
            title="Format the PreTeXt source"
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
        </>
      )}
      <span className="pretext-plus-editor__code-editor-source-badge pretext-plus-editor__code-editor-source-badge--right">
        {sourceFormat === "latex" ? "LaTeX" : "PreTeXt"}
      </span>
    </div>
  );
};

export default CodeEditorMenu;
