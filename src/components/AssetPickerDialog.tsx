import { useEffect, useRef, useState } from "react";
import type { ProjectAsset } from "../types/editor";
import "./dialog.css";
import "./AssetPickerDialog.css";

export interface AssetPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Assets already associated with this project — can be inserted directly. */
  projectAssets: ProjectAsset[];
  /**
   * All assets available in the user's library (across all projects).
   * When omitted the library tab shows only projectAssets.
   */
  libraryAssets?: ProjectAsset[];
  /** Called when the user uploads a file. Host uploads to server and returns the asset record. */
  onUpload?: (file: File) => Promise<ProjectAsset>;
  /**
   * Called when the user submits an external URL. Host downloads/registers the
   * asset on the server and returns the asset record with a stable filename.
   * When omitted the URL tab inserts a synthetic asset without a server round-trip.
   */
  onAddUrl?: (url: string, name: string) => Promise<ProjectAsset>;
  /**
   * Called when the user picks a library asset not yet in this project.
   * Host should associate the asset with the project (e.g. Rails join record).
   */
  onAddFromLibrary?: (asset: ProjectAsset) => Promise<void> | void;
  /** Called with the resolved asset when the user confirms an insertion. */
  onInsert: (asset: ProjectAsset) => void;
}

type Tab = "library" | "upload" | "url";

const AssetPickerDialog = ({
  open,
  onClose,
  projectAssets,
  libraryAssets,
  onUpload,
  onAddUrl,
  onAddFromLibrary,
  onInsert,
}: AssetPickerDialogProps) => {
  const allLibraryAssets = libraryAssets ?? projectAssets;
  const projectAssetIds = new Set(projectAssets.map((a) => a.id));

  const initialTab: Tab =
    allLibraryAssets.length > 0 ? "library" : onUpload ? "upload" : "url";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addingAssetId, setAddingAssetId] = useState<string | null>(null);
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleFileSelect = async (file: File) => {
    if (!onUpload) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const asset = await onUpload(file);
      onInsert(asset);
      onClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleLibrarySelect = async (asset: ProjectAsset) => {
    const isInProject = projectAssetIds.has(asset.id);
    if (!isInProject && onAddFromLibrary) {
      setAddingAssetId(asset.id);
      try {
        await onAddFromLibrary(asset);
      } finally {
        setAddingAssetId(null);
      }
    }
    onInsert(asset);
    onClose();
  };

  const handleUrlInsert = async () => {
    const url = urlValue.trim();
    if (!url) return;
    const name = urlName.trim() || url;

    if (onAddUrl) {
      setUrlError(null);
      setIsAddingUrl(true);
      try {
        const asset = await onAddUrl(url, name);
        onInsert(asset);
        onClose();
      } catch (err) {
        setUrlError(err instanceof Error ? err.message : "Failed to add URL.");
        setIsAddingUrl(false);
      }
    } else {
      // Fallback: no server round-trip — insert a synthetic asset directly.
      onInsert({
        id: `url-${Date.now()}`,
        name,
        filename: url.split("/").pop() ?? "image",
        url,
      });
      onClose();
    }
  };

  return (
    <div
      className="pretext-plus-editor__dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="pretext-plus-editor__dialog pretext-plus-editor__dialog--asset-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Insert asset"
      >
        <div className="pretext-plus-editor__dialog-header">
          <div>
            <h2 className="pretext-plus-editor__dialog-title">Insert Asset</h2>
            <p className="pretext-plus-editor__dialog-copy">
              Choose from your library, upload a new file, or link an external
              URL. Uploaded and linked assets are saved to the library and added
              to this project.
            </p>
          </div>
          <button
            type="button"
            className="pretext-plus-editor__dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="pretext-plus-editor__dialog-tab-bar">
          <button
            type="button"
            className={`pretext-plus-editor__dialog-tab${tab === "library" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
            onClick={() => setTab("library")}
          >
            Library
            {allLibraryAssets.length > 0 && (
              <span className="pretext-plus-editor__asset-tab-count">
                {allLibraryAssets.length}
              </span>
            )}
          </button>
          {onUpload && (
            <button
              type="button"
              className={`pretext-plus-editor__dialog-tab${tab === "upload" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
              onClick={() => setTab("upload")}
            >
              Upload
            </button>
          )}
          <button
            type="button"
            className={`pretext-plus-editor__dialog-tab${tab === "url" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
            onClick={() => setTab("url")}
          >
            External URL
          </button>
        </div>

        <div className="pretext-plus-editor__dialog-content pretext-plus-editor__dialog-content--single pretext-plus-editor__asset-picker-body">
          {tab === "library" && (
            <div className="pretext-plus-editor__asset-library">
              {allLibraryAssets.length === 0 ? (
                <p className="pretext-plus-editor__asset-library-empty">
                  Your library is empty. Upload a file or add an external URL to
                  get started.
                </p>
              ) : (
                <div className="pretext-plus-editor__asset-grid">
                  {allLibraryAssets.map((asset) => {
                    const inProject = projectAssetIds.has(asset.id);
                    const isAdding = addingAssetId === asset.id;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        className={[
                          "pretext-plus-editor__asset-card",
                          inProject
                            ? "pretext-plus-editor__asset-card--in-project"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleLibrarySelect(asset)}
                        disabled={isAdding}
                        title={
                          inProject
                            ? `Insert "${asset.filename}"`
                            : `Add to project and insert "${asset.filename}"`
                        }
                      >
                        {inProject && (
                          <span
                            className="pretext-plus-editor__asset-card-badge"
                            title="Already in this project"
                          >
                            ✓
                          </span>
                        )}
                        <div className="pretext-plus-editor__asset-card-thumb">
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="pretext-plus-editor__asset-thumb-img"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
                            }}
                          />
                        </div>
                        <span className="pretext-plus-editor__asset-card-name">
                          {asset.name}
                        </span>
                        <span className="pretext-plus-editor__asset-card-filename">
                          {isAdding ? "Adding…" : asset.filename}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "upload" && onUpload && (
            <div className="pretext-plus-editor__asset-upload">
              <div
                className={[
                  "pretext-plus-editor__asset-drop-zone",
                  isDragging
                    ? "pretext-plus-editor__asset-drop-zone--active"
                    : "",
                  isUploading
                    ? "pretext-plus-editor__asset-drop-zone--uploading"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Upload image — click or drag and drop"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="pretext-plus-editor__dialog-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                {isUploading ? (
                  <p className="pretext-plus-editor__asset-drop-text">
                    Uploading…
                  </p>
                ) : (
                  <>
                    <span
                      className="pretext-plus-editor__asset-drop-icon"
                      aria-hidden="true"
                    >
                      ↑
                    </span>
                    <p className="pretext-plus-editor__asset-drop-text">
                      Drag &amp; drop an image here, or click to browse
                    </p>
                    <p className="pretext-plus-editor__dialog-helper-copy">
                      The file is uploaded to the library and added to this
                      project. Supported: PNG, JPEG, GIF, SVG, WebP
                    </p>
                  </>
                )}
              </div>
              {uploadError && (
                <p className="pretext-plus-editor__asset-upload-error">
                  {uploadError}
                </p>
              )}
            </div>
          )}

          {tab === "url" && (
            <div className="pretext-plus-editor__asset-url-form">
              <div className="pretext-plus-editor__asset-url-fields">
                <label
                  className="pretext-plus-editor__dialog-label"
                  htmlFor="asset-url-value"
                >
                  Image URL
                </label>
                <input
                  id="asset-url-value"
                  type="url"
                  className="pretext-plus-editor__asset-url-input"
                  placeholder="https://example.com/image.png"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  autoFocus
                  disabled={isAddingUrl}
                />
                <label
                  className="pretext-plus-editor__dialog-label"
                  htmlFor="asset-url-name"
                >
                  Name{" "}
                  <span className="pretext-plus-editor__dialog-helper-copy">
                    (optional)
                  </span>
                </label>
                <input
                  id="asset-url-name"
                  type="text"
                  className="pretext-plus-editor__asset-url-input"
                  placeholder="My image"
                  value={urlName}
                  onChange={(e) => setUrlName(e.target.value)}
                  disabled={isAddingUrl}
                />
                {onAddUrl && (
                  <p className="pretext-plus-editor__dialog-helper-copy pretext-plus-editor__asset-url-note">
                    The image will be downloaded and stored in the library so
                    your document can reference it by filename rather than
                    external URL.
                  </p>
                )}
                {urlError && (
                  <p className="pretext-plus-editor__asset-upload-error">
                    {urlError}
                  </p>
                )}
              </div>
              {urlValue.trim() && (
                <div className="pretext-plus-editor__asset-url-preview">
                  <img
                    src={urlValue.trim()}
                    alt="URL preview"
                    className="pretext-plus-editor__asset-url-preview-img"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pretext-plus-editor__dialog-actions">
          <button
            type="button"
            className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
            onClick={onClose}
            disabled={isAddingUrl}
          >
            Cancel
          </button>
          {tab === "url" && (
            <button
              type="button"
              className="pretext-plus-editor__dialog-button"
              onClick={handleUrlInsert}
              disabled={!urlValue.trim() || isAddingUrl}
            >
              {isAddingUrl
                ? "Adding…"
                : onAddUrl
                  ? "Add to Library & Insert"
                  : "Insert"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetPickerDialog;
