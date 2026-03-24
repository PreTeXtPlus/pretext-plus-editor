import React from "react";
import "./CodeEditorMenu.css";
import { formatPretext } from "@pretextbook/format";
import type { SourceFormat } from "../types/editor";

interface CodeEditorMenuProps {
  content: string;
  sourceFormat: SourceFormat;
  onContentChange: (newContent: string) => void;
  onOpenLatexImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
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
