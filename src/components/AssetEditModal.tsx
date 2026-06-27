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
  /** The full project pool, used to reject a `ref` that collides with another asset. */
  projectAssets: Asset[];
  onClose: () => void;
  /**
   * Persist the edited asset. `prevRef` is the asset's ref *before* this edit so
   * the caller can rewrite in-document placeholders when the ref changed.
   */
  onSave: (asset: Asset, prevRef: string) => Promise<void> | void;
  /**
   * Begin replacing this asset — opens the asset manager's replace mode, where
   * the user picks/uploads a new asset. When omitted, the Replace control is
   * hidden.
   */
  onReplace?: (asset: Asset) => void;
  /** Duplicate this asset under a fresh ref. When omitted, the button is hidden. */
  onDuplicate?: (asset: Asset) => void;
}

const KIND_TAG: Record<Asset["kind"], string> = { image: "image", doenet: "interactive" };

const AssetEditModal = ({
  asset,
  projectAssets,
  onClose,
  onSave,
  onReplace,
  onDuplicate,
}: AssetEditModalProps) => {
  const prevRef = asset.ref ?? "";
  const [nameValue, setNameValue] = useState(asset.name);
  const [refValue, setRefValue] = useState(prevRef);
  const [sourceValue, setSourceValue] = useState(asset.source ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const embedCode = `<plus:${asset.kind} ref="${refValue.trim() || prevRef}"/>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    const ref = refValue.trim();
    if (!ref) {
      setError("Reference can't be empty — it identifies the asset and is used by every embed of it.");
      return;
    }
    // A ref must stay unique within its kind: it's the key every
    // `<plus:KIND ref="..."/>` placeholder resolves against.
    if (
      ref !== prevRef &&
      projectAssets.some((a) => a.kind === asset.kind && a.ref === ref)
    ) {
      setError(`Reference "${ref}" is already used by another asset. Choose a unique reference.`);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ ...asset, name: nameValue.trim() || ref, ref, source: sourceValue }, prevRef);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save asset.");
      setIsSaving(false);
    }
  };

  const busy = isSaving;
  const showPreview = asset.kind === "image" && !!asset.url;
  const canReplace = asset.kind === "image" && !!onReplace;

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
          <h2 className="pretext-plus-editor__dialog-title">Edit asset</h2>
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
                alt={nameValue}
                className="pretext-plus-editor__am-url-preview"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}

            {canReplace && (
              <div className="pretext-plus-editor__am-replace-row">
                <button
                  type="button"
                  className="pretext-plus-editor__am-action-btn"
                  onClick={() => onReplace?.(asset)}
                  disabled={busy}
                  title="Choose or upload a different asset to use here"
                >
                  Replace image…
                </button>
              </div>
            )}

            <label className="pretext-plus-editor__dialog-label" htmlFor="am-edit-name">Name</label>
            <input
              id="am-edit-name"
              type="text"
              className="pretext-plus-editor__am-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              disabled={busy}
            />

            <label className="pretext-plus-editor__dialog-label" htmlFor="am-edit-ref">Reference</label>
            <input
              id="am-edit-ref"
              type="text"
              className="pretext-plus-editor__am-input"
              value={refValue}
              onChange={(e) => setRefValue(e.target.value)}
              disabled={busy}
            />
            <p className="pretext-plus-editor__dialog-helper-copy">
              Used in the embed code below. Changing it updates every reference to this
              asset already in your document.
            </p>

            <div className="pretext-plus-editor__am-embed-row">
              <code className="pretext-plus-editor__am-embed-code">{embedCode}</code>
              <button
                type="button"
                className={`pretext-plus-editor__am-action-btn${copied ? " pretext-plus-editor__am-action-btn--done" : ""}`}
                onClick={handleCopy}
                title="Copy embed code to clipboard"
              >
                {copied ? "Copied!" : "Copy embed code"}
              </button>
            </div>

            <label className="pretext-plus-editor__dialog-label">Asset content</label>
            <p className="pretext-plus-editor__dialog-helper-copy">
              Inserted verbatim inside the generated <code>{`<${KIND_TAG[asset.kind]}>`}</code> element
              — e.g. <code>{"<shortdescription>...</shortdescription>"}</code>.
            </p>
            <div className="pretext-plus-editor__dialog-editor pretext-plus-editor__am-edit-editor">
              <Editor
                options={{ ...editorOptions, readOnly: busy }}
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
          {onDuplicate && (
            <button
              type="button"
              className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary pretext-plus-editor__am-duplicate-btn"
              onClick={() => onDuplicate(asset)}
              disabled={busy}
              title="Create a copy of this asset under a new reference"
            >
              Duplicate
            </button>
          )}
          <button
            type="button"
            className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pretext-plus-editor__dialog-button"
            onClick={handleSave}
            disabled={busy}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetEditModal;
