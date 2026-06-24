import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import type { Asset } from "../types/editor";
import "./dialog.css";
import "./AssetManagerModal.css";

const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: "on" as const,
  insertSpaces: true,
  tabSize: 2,
  padding: { top: 10, bottom: 10 },
};

export interface AssetEditModalProps {
  asset: Asset;
  onClose: () => void;
  /** Persist the edited asset (e.g. just `source` changed). */
  onSave: (asset: Asset) => Promise<void> | void;
}

const KIND_TAG: Record<Asset["kind"], string> = { image: "image", doenet: "interactive" };

const AssetEditModal = ({ asset, onClose, onSave }: AssetEditModalProps) => {
  const [sourceValue, setSourceValue] = useState(asset.source ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ ...asset, source: sourceValue });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save asset.");
      setIsSaving(false);
    }
  };

  const showPreview = asset.kind === "image" && !!asset.url;

  return (
    <div
      className="pretext-plus-editor__dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="pretext-plus-editor__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit asset ${asset.name}`}
      >
        <div className="pretext-plus-editor__dialog-header">
          <div>
            <h2 className="pretext-plus-editor__dialog-title">{asset.name}</h2>
            <p className="pretext-plus-editor__dialog-copy">
              Reference: <code>{asset.ref}</code>
            </p>
          </div>
          <button
            type="button"
            className="pretext-plus-editor__dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="pretext-plus-editor__dialog-content pretext-plus-editor__dialog-content--single">
          <div className="pretext-plus-editor__dialog-section">
            {showPreview && (
              <img
                src={asset.url}
                alt={asset.name}
                className="pretext-plus-editor__am-url-preview"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <label className="pretext-plus-editor__dialog-label">
              Asset content
            </label>
            <p className="pretext-plus-editor__dialog-helper-copy">
              Inserted verbatim inside the generated <code>{`<${KIND_TAG[asset.kind]}>`}</code> element
              — e.g. <code>{"<shortdescription>...</shortdescription>"}</code>.
            </p>
            <div className="pretext-plus-editor__dialog-editor pretext-plus-editor__am-edit-editor">
              <Editor
                options={{ ...editorOptions, readOnly: isSaving }}
                height="100%"
                language="xml"
                value={sourceValue}
                onMount={(editor) => editor.focus()}
                onChange={(value) => setSourceValue(value ?? "")}
              />
            </div>
            {error && <p className="pretext-plus-editor__am-error">{error}</p>}
          </div>
        </div>

        <div className="pretext-plus-editor__dialog-actions">
          <button
            type="button"
            className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pretext-plus-editor__dialog-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetEditModal;
