import { useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import "./LatexImportDialog.css";

interface ConvertToPretextDialogProps {
  /** The current LaTeX source to display (read-only) on the left. */
  latexSource: string;
  /** The already-converted PreTeXt to display (read-only) on the right. */
  pretextContent: string;
  /** Called when the user confirms the conversion. */
  onConfirm: () => void;
  /** Called when the dialog should close without converting. */
  onClose: () => void;
}

const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: "on" as const,
  readOnly: true,
  scrollBeyondLastLine: false,
  tabSize: 2,
  fontSize: 13,
  padding: { top: 10, bottom: 10 },
};

/**
 * Confirmation dialog shown before permanently replacing LaTeX source with
 * the derived PreTeXt.  Displays the current LaTeX and the converted PreTeXt
 * side-by-side so the user can review before committing.
 */
const ConvertToPretextDialog = ({
  latexSource,
  pretextContent,
  onConfirm,
  onClose,
}: ConvertToPretextDialogProps) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="pretext-plus-editor__latex-dialog-overlay"
      onClick={onClose}
    >
      <div
        className="pretext-plus-editor__latex-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pretext-plus-editor-convert-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pretext-plus-editor__latex-dialog-header">
          <div>
            <h2
              id="pretext-plus-editor-convert-dialog-title"
              className="pretext-plus-editor__latex-dialog-title"
            >
              Convert project to PreTeXt
            </h2>
            <p className="pretext-plus-editor__latex-dialog-copy">
              This will replace your LaTeX source with the converted PreTeXt
              shown below.{" "}
              <strong>WARNING: This action cannot be undone.</strong>
            </p>
          </div>
          <button
            type="button"
            className="pretext-plus-editor__latex-dialog-close"
            onClick={onClose}
            aria-label="Close convert to PreTeXt dialog"
          >
            Close
          </button>
        </div>

        <div className="pretext-plus-editor__latex-dialog-content">
          <div className="pretext-plus-editor__latex-dialog-section">
            <div className="pretext-plus-editor__latex-dialog-label-row">
              <label className="pretext-plus-editor__latex-dialog-label">
                Current LaTeX Source
              </label>
            </div>
            <div className="pretext-plus-editor__latex-dialog-editor">
              <Editor
                options={editorOptions}
                height="100%"
                language="latex"
                value={latexSource}
              />
            </div>
          </div>

          <div className="pretext-plus-editor__latex-dialog-section">
            <div className="pretext-plus-editor__latex-dialog-label-row">
              <label className="pretext-plus-editor__latex-dialog-label">
                Converted PreTeXt
              </label>
            </div>
            <div className="pretext-plus-editor__latex-dialog-editor">
              <Editor
                options={editorOptions}
                height="100%"
                language="xml"
                value={pretextContent}
              />
            </div>
          </div>
        </div>

        <div className="pretext-plus-editor__latex-dialog-actions">
          <button
            type="button"
            className="pretext-plus-editor__latex-dialog-button pretext-plus-editor__latex-dialog-button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pretext-plus-editor__latex-dialog-button pretext-plus-editor__latex-dialog-button--danger"
            onClick={handleConfirm}
          >
            Convert to PreTeXt
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConvertToPretextDialog;
