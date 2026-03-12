import React from "react";
import "./CodeEditorMenu.css";
import { formatPretext } from "@pretextbook/format";

interface CodeEditorMenuProps {
  content: string;
  onContentChange: (newContent: string) => void;
  onOpenLatexImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const CodeEditorMenu: React.FC<CodeEditorMenuProps> = ({
  content,
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
        title="Format the XML content"
      >
        Format
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
