import { useState, useCallback, useEffect, useRef } from "react";
import type { Asset, AssetKind } from "../types/editor";
import { useEditorStore } from "../store/hooks";
import { parseAssetRefs } from "../sectionUtils";
import { ASSET_KIND_LABELS, SHOW_DOENET, VISIBLE_ASSET_KINDS } from "../assetKinds";
import "./dialog.css";
import "./AssetManagerModal.css";
import doenetLogo from "../assets/doenet.png";

export interface AssetManagerModalProps {
  open: boolean;
  onClose: () => void;
  onLoadAssets?: () => Promise<Asset[]>;
  onLoadLibraryAssets?: () => Promise<Asset[]>;
  /** Insert an asset tag at the cursor position. */
  onInsert: (asset: Asset) => void;
  /** Associate a library asset with the current project. */
  onAddFromLibrary?: (asset: Asset) => Promise<void> | void;
  /** Upload an image file; host returns the created asset. */
  onUpload?: (file: File) => Promise<Asset>;
  /**
   * Fetch an external URL on the user's behalf (server-side, to avoid CORS)
   * and return the raw file bytes. Must not create a persisted asset — the
   * returned file is then committed via `onUpload`, the same as a local
   * file pick, so there is a single code path that creates project assets.
   */
  onFetchUrl?: (url: string) => Promise<File>;
  /** Create a new Doenet activity; host returns the created asset. */
  onCreateDoenet?: (name: string, ref: string) => Promise<Asset>;
  /** Remove an asset from the project. */
  onRemoveAsset?: (asset: Asset) => void;
}

type MainTab = "in-document" | "add";
type ImageSourceTab = "library" | "upload" | "url";
type DoenetSourceTab = "library" | "create";

function parseDocumentAssets(source: string): Array<{ kind: AssetKind; ref: string }> {
  const seen = new Set<string>();
  const results: Array<{ kind: AssetKind; ref: string }> = [];
  for (const { kind, ref } of parseAssetRefs(source)) {
    const key = `${kind}:${ref}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ kind, ref });
    }
  }
  return results;
}

const AssetManagerModal = ({
  open,
  onClose,
  onLoadAssets,
  onLoadLibraryAssets,
  onInsert,
  onAddFromLibrary,
  onUpload,
  onFetchUrl,
  onCreateDoenet,
  onRemoveAsset,
}: AssetManagerModalProps) => {
  const source = useEditorStore((s) => s.activeEditorSource);
  // Authoritative project-asset pool, owned by the store. A fresh server list
  // from `onLoadAssets` is written straight back into it via `setProjectAssets`.
  const projectAssets = useEditorStore((s) => s.projectAssets) ?? [];
  const setProjectAssets = useEditorStore((s) => s.setProjectAssets);
  const libraryAssets = useEditorStore((s) => s.libraryAssets);
  const openAssetEditor = useEditorStore((s) => s.openAssetEditor);
  const hasLoaders = !!(onLoadAssets || onLoadLibraryAssets);

  const [dynamicLibraryAssets, setDynamicLibraryAssets] = useState<Asset[] | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const resolvedAssets = projectAssets;
  const resolvedLibraryAssets = dynamicLibraryAssets ?? libraryAssets ?? resolvedAssets;
  const projectAssetIds = new Set(resolvedAssets.map((a) => a.id));

  const [tab, setTab] = useState<MainTab>("in-document");
  const [addKind, setAddKind] = useState<AssetKind | null>(null);
  const [imageTab, setImageTab] = useState<ImageSourceTab>("library");
  const [doenetTab, setDoenetTab] = useState<DoenetSourceTab>("library");
  const [addingAssetId, setAddingAssetId] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL state
  const [urlValue, setUrlValue] = useState("");
  const [urlName, setUrlName] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Create Doenet state
  const [doenetName, setDoenetName] = useState("");
  const [doenetRef, setDoenetRef] = useState("");
  const [isCreatingDoenet, setIsCreatingDoenet] = useState(false);
  const [doenetError, setDoenetError] = useState<string | null>(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadAssets = useCallback(() => {
    if (!onLoadAssets && !onLoadLibraryAssets) return;
    setIsLoadingAssets(true);
    setLoadError(null);
    Promise.all([
      onLoadAssets?.() ?? Promise.resolve(null),
      onLoadLibraryAssets?.() ?? Promise.resolve(null),
    ])
      .then(([proj, lib]) => {
        // The server list is authoritative at load time — write it straight
        // into the store's pool (any optimistic local additions were already
        // persisted by the host before this fetch, so they'll be included).
        if (proj !== null) setProjectAssets(proj);
        if (lib !== null) setDynamicLibraryAssets(lib);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load assets.");
      })
      .finally(() => setIsLoadingAssets(false));
  }, [onLoadAssets, onLoadLibraryAssets, setProjectAssets]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAssets();
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, loadAssets]);

  if (!open) return null;

  const documentAssets = parseDocumentAssets(source);

  const handleInsertAndClose = (asset: Asset) => {
    onInsert(asset);
    onClose();
  };

  const handleCopy = (kind: AssetKind, ref: string) => {
    const key = `${kind}:${ref}`;
    navigator.clipboard.writeText(`<plus:${kind} ref="${ref}"/>`).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  };

  const handleLibrarySelect = async (asset: Asset) => {
    if (!projectAssetIds.has(asset.id) && onAddFromLibrary) {
      setAddingAssetId(asset.id);
      try {
        await onAddFromLibrary(asset);
      } finally {
        setAddingAssetId(null);
      }
    }
    handleInsertAndClose(asset);
  };

  const handleFileSelect = async (file: File) => {
    if (!onUpload) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const asset = await onUpload(file);
      handleInsertAndClose(asset);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setIsUploading(false);
    }
  };

  const handleUrlInsert = async () => {
    const url = urlValue.trim();
    if (!url) return;
    const name = urlName.trim();
    if (onFetchUrl && onUpload) {
      setUrlError(null);
      setIsAddingUrl(true);
      try {
        const fetched = await onFetchUrl(url);
        const file = name ? new File([fetched], name, { type: fetched.type }) : fetched;
        const asset = await onUpload(file);
        handleInsertAndClose(asset);
      } catch (err) {
        setUrlError(err instanceof Error ? err.message : "Failed to add URL.");
        setIsAddingUrl(false);
      }
    } else {
      handleInsertAndClose({
        id: `url-${Date.now()}`,
        name: name || url,
        ref: url.split("/").pop() ?? "image",
        kind: "image",
        url,
      });
    }
  };

  const handleCreateDoenet = async () => {
    const name = doenetName.trim();
    const ref = doenetRef.trim();
    if (!name || !ref) return;
    if (onCreateDoenet) {
      setDoenetError(null);
      setIsCreatingDoenet(true);
      try {
        const asset = await onCreateDoenet(name, ref);
        handleInsertAndClose(asset);
      } catch (err) {
        setDoenetError(err instanceof Error ? err.message : "Failed to create activity.");
        setIsCreatingDoenet(false);
      }
    } else {
      handleInsertAndClose({ id: `doenet-${Date.now()}`, name, ref, kind: "doenet" });
    }
  };

  // ── Shared library list ────────────────────────────────────────────────────
  const renderLibrary = (kind: AssetKind) => {
    const assets = resolvedLibraryAssets.filter((a) => a.kind === kind);
    return (
      <div className="pretext-plus-editor__am-library">
        {hasLoaders && (
          <div className="pretext-plus-editor__am-toolbar">
            {loadError && <span className="pretext-plus-editor__asset-load-error">{loadError}</span>}
            <button
              type="button"
              className="pretext-plus-editor__asset-library-refresh"
              onClick={loadAssets}
              disabled={isLoadingAssets}
            >
              {isLoadingAssets ? "Loading…" : "Refresh"}
            </button>
          </div>
        )}
        {isLoadingAssets && assets.length === 0 ? (
          <p className="pretext-plus-editor__am-empty-text">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="pretext-plus-editor__am-empty-text">
            No {ASSET_KIND_LABELS[kind].toLowerCase()} assets in your library.
          </p>
        ) : (
          <ul className="pretext-plus-editor__am-list">
            {assets.map((asset) => {
              const inProject = projectAssetIds.has(asset.id);
              const isAdding = addingAssetId === asset.id;
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    className={[
                      "pretext-plus-editor__am-lib-row",
                      inProject ? "pretext-plus-editor__am-lib-row--in-project" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleLibrarySelect(asset)}
                    disabled={isAdding || !asset.ref}
                    title={!asset.ref ? "Asset has no reference — cannot insert" : inProject ? `Insert "${asset.ref}"` : `Add to project & insert "${asset.ref}"`}
                  >
                    <div className="pretext-plus-editor__am-row-info">
                      <span className="pretext-plus-editor__am-row-name">{asset.name}</span>
                      <span className="pretext-plus-editor__am-row-ref">{isAdding ? "Adding…" : asset.ref}</span>
                    </div>
                    {inProject && <span className="pretext-plus-editor__am-badge">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  // ── "In Document" tab ─────────────────────────────────────────────────────
  const renderInDocument = () => {
    if (documentAssets.length === 0) {
      return (
        <div className="pretext-plus-editor__am-placeholder">
          <p>No assets referenced in this document yet.</p>
          <button
            type="button"
            className="pretext-plus-editor__dialog-button"
            onClick={() => { setTab("add"); setAddKind(null); }}
          >
            Add an asset
          </button>
        </div>
      );
    }

    const byKind = VISIBLE_ASSET_KINDS.reduce<Record<AssetKind, Array<{ ref: string; asset?: Asset }>>>(
      (acc, kind) => {
        acc[kind] = documentAssets
          .filter((d) => d.kind === kind)
          .map((d) => ({ ref: d.ref, asset: resolvedAssets.find((a) => a.kind === d.kind && a.ref === d.ref) }));
        return acc;
      },
      { image: [], doenet: [] },
    );

    return (
      <div className="pretext-plus-editor__am-in-doc">
        {VISIBLE_ASSET_KINDS.filter((kind) => byKind[kind].length > 0).map((kind) => (
          <div key={kind} className="pretext-plus-editor__am-kind-group">
            <div className="pretext-plus-editor__am-kind-header">
              <span aria-hidden="true">📁</span>
              <span>{ASSET_KIND_LABELS[kind]}</span>
              <span className="pretext-plus-editor__am-kind-count">{byKind[kind].length}</span>
            </div>
            <ul className="pretext-plus-editor__am-list">
              {byKind[kind].map(({ ref, asset }) => {
                const ck = `${kind}:${ref}`;
                return (
                  <li key={ref} className="pretext-plus-editor__am-doc-row">
                    <div className="pretext-plus-editor__am-row-info">
                      <span className="pretext-plus-editor__am-row-name">{asset?.name ?? ref}</span>
                      <span className="pretext-plus-editor__am-row-ref">{ref}</span>
                    </div>
                    <div className="pretext-plus-editor__am-row-actions">
                      {asset && (
                        <button
                          type="button"
                          className="pretext-plus-editor__am-action-btn"
                          onClick={() => handleInsertAndClose(asset)}
                          title={`Insert <plus:${kind} ref="${ref}"/>`}
                        >
                          Insert
                        </button>
                      )}
                      {asset && (
                        <button
                          type="button"
                          className="pretext-plus-editor__am-action-btn"
                          onClick={() => openAssetEditor(kind, ref)}
                          title="Edit asset content"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className={`pretext-plus-editor__am-action-btn${copiedKey === ck ? " pretext-plus-editor__am-action-btn--done" : ""}`}
                        onClick={() => handleCopy(kind, ref)}
                        title={`Copy <plus:${kind} ref="${ref}"/>`}
                      >
                        {copiedKey === ck ? "Copied!" : "Copy"}
                      </button>
                      {onRemoveAsset && asset && (
                        <button
                          type="button"
                          className="pretext-plus-editor__am-action-btn pretext-plus-editor__am-action-btn--danger"
                          onClick={() => { onRemoveAsset(asset); onClose(); }}
                          title="Remove from project"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  // ── "Add Asset" tab ────────────────────────────────────────────────────────
  const renderKindPicker = () => (
    <div className="pretext-plus-editor__am-kind-picker">
      <p className="pretext-plus-editor__am-kind-picker-label">What kind of asset?</p>
      <div className="pretext-plus-editor__am-kind-cards">
        <button
          type="button"
          className="pretext-plus-editor__am-kind-card"
          onClick={() => { setAddKind("image"); setImageTab("library"); }}
        >
          <span className="pretext-plus-editor__am-kind-card-icon" aria-hidden="true">🖼️</span>
          <span className="pretext-plus-editor__am-kind-card-label">Image</span>
          <span className="pretext-plus-editor__am-kind-card-hint">PNG, JPEG, SVG, etc.</span>
        </button>
        {SHOW_DOENET && (
          <button
            type="button"
            className="pretext-plus-editor__am-kind-card"
            onClick={() => { setAddKind("doenet"); setDoenetTab("library"); }}
          >
            <span className="pretext-plus-editor__am-kind-card-icon" aria-hidden="true"><img src={doenetLogo} alt="Doenet" /></span>
            <span className="pretext-plus-editor__am-kind-card-label">Doenet</span>
            <span className="pretext-plus-editor__am-kind-card-hint">Interactive activity</span>
          </button>
        )}
        {!SHOW_DOENET && (
          <div
            className="pretext-plus-editor__am-kind-card pretext-plus-editor__am-kind-card--soon"
            aria-disabled="true"
          >
            <span className="pretext-plus-editor__am-kind-card-icon" aria-hidden="true">✨</span>
            <span className="pretext-plus-editor__am-kind-card-label">More coming soon</span>
            <span className="pretext-plus-editor__am-kind-card-hint">Interactive activities and more</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderImageAdd = () => (
    <div className="pretext-plus-editor__am-configure">
      <button type="button" className="pretext-plus-editor__am-back-btn" onClick={() => setAddKind(null)}>
        ← Back
      </button>
      <div className="pretext-plus-editor__dialog-tab-bar pretext-plus-editor__am-sub-tabs">
        <button
          type="button"
          className={`pretext-plus-editor__dialog-tab${imageTab === "library" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
          onClick={() => setImageTab("library")}
        >
          Library
        </button>
        {onUpload && (
          <button
            type="button"
            className={`pretext-plus-editor__dialog-tab${imageTab === "upload" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
            onClick={() => setImageTab("upload")}
          >
            Upload
          </button>
        )}
        <button
          type="button"
          className={`pretext-plus-editor__dialog-tab${imageTab === "url" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
          onClick={() => setImageTab("url")}
        >
          External URL
        </button>
      </div>
      <div className="pretext-plus-editor__am-configure-body">
        {imageTab === "library" && renderLibrary("image")}
        {imageTab === "upload" && onUpload && (
          <div className="pretext-plus-editor__am-upload">
            <div
              className={[
                "pretext-plus-editor__am-drop-zone",
                isDragging ? "pretext-plus-editor__am-drop-zone--active" : "",
                isUploading ? "pretext-plus-editor__am-drop-zone--uploading" : "",
              ].filter(Boolean).join(" ")}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
              aria-label="Upload image — click or drag and drop"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="pretext-plus-editor__dialog-file-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              {isUploading ? (
                <p className="pretext-plus-editor__am-drop-text">Uploading…</p>
              ) : (
                <>
                  <span className="pretext-plus-editor__am-drop-icon" aria-hidden="true">↑</span>
                  <p className="pretext-plus-editor__am-drop-text">Drag &amp; drop an image, or click to browse</p>
                  <p className="pretext-plus-editor__dialog-helper-copy">PNG, JPEG, GIF, SVG, WebP</p>
                </>
              )}
            </div>
            {uploadError && <p className="pretext-plus-editor__am-error">{uploadError}</p>}
          </div>
        )}
        {imageTab === "url" && (
          <div className="pretext-plus-editor__am-url-form">
            <label className="pretext-plus-editor__dialog-label" htmlFor="am-url-value">Image URL</label>
            <input
              id="am-url-value"
              type="url"
              className="pretext-plus-editor__am-input"
              placeholder="https://example.com/image.png"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              disabled={isAddingUrl}
              autoFocus
            />
            <label className="pretext-plus-editor__dialog-label" htmlFor="am-url-name">
              Name <span className="pretext-plus-editor__dialog-helper-copy">(optional)</span>
            </label>
            <input
              id="am-url-name"
              type="text"
              className="pretext-plus-editor__am-input"
              placeholder="My image"
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              disabled={isAddingUrl}
            />
            {urlError && <p className="pretext-plus-editor__am-error">{urlError}</p>}
            {urlValue.trim() && (
              <img
                src={urlValue.trim()}
                alt="Preview"
                className="pretext-plus-editor__am-url-preview"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <button
              type="button"
              className="pretext-plus-editor__dialog-button"
              onClick={handleUrlInsert}
              disabled={!urlValue.trim() || isAddingUrl}
            >
              {isAddingUrl ? "Adding…" : onFetchUrl && onUpload ? "Add to Library & Insert" : "Insert"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDoenetAdd = () => (
    <div className="pretext-plus-editor__am-configure">
      <button type="button" className="pretext-plus-editor__am-back-btn" onClick={() => setAddKind(null)}>
        ← Back
      </button>
      <div className="pretext-plus-editor__dialog-tab-bar pretext-plus-editor__am-sub-tabs">
        <button
          type="button"
          className={`pretext-plus-editor__dialog-tab${doenetTab === "library" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
          onClick={() => setDoenetTab("library")}
        >
          Library
        </button>
        <button
          type="button"
          className={`pretext-plus-editor__dialog-tab${doenetTab === "create" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
          onClick={() => setDoenetTab("create")}
        >
          Create New
        </button>
      </div>
      <div className="pretext-plus-editor__am-configure-body">
        {doenetTab === "library" && renderLibrary("doenet")}
        {doenetTab === "create" && (
          <div className="pretext-plus-editor__am-create-form">
            <label className="pretext-plus-editor__dialog-label" htmlFor="am-doenet-name">Name</label>
            <input
              id="am-doenet-name"
              type="text"
              className="pretext-plus-editor__am-input"
              placeholder="My Activity"
              value={doenetName}
              onChange={(e) => setDoenetName(e.target.value)}
              disabled={isCreatingDoenet}
              autoFocus
            />
            <label className="pretext-plus-editor__dialog-label" htmlFor="am-doenet-ref">Reference ID</label>
            <input
              id="am-doenet-ref"
              type="text"
              className="pretext-plus-editor__am-input"
              placeholder="my-activity"
              value={doenetRef}
              onChange={(e) => setDoenetRef(e.target.value)}
              disabled={isCreatingDoenet}
            />
            <p className="pretext-plus-editor__dialog-helper-copy">
              The reference ID is used in the inserted tag: <code>{`<plus:doenet ref="${doenetRef || "my-activity"}"/>`}</code>
            </p>
            {doenetError && <p className="pretext-plus-editor__am-error">{doenetError}</p>}
            <button
              type="button"
              className="pretext-plus-editor__dialog-button"
              onClick={handleCreateDoenet}
              disabled={!doenetName.trim() || !doenetRef.trim() || isCreatingDoenet}
            >
              {isCreatingDoenet ? "Creating…" : onCreateDoenet ? "Create & Insert" : "Insert"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="pretext-plus-editor__dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="pretext-plus-editor__dialog pretext-plus-editor__dialog--asset-manager"
        role="dialog"
        aria-modal="true"
        aria-label="Asset manager"
      >
        <div className="pretext-plus-editor__dialog-header">
          <h2 className="pretext-plus-editor__dialog-title">Assets</h2>
          <button
            type="button"
            className="pretext-plus-editor__dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="pretext-plus-editor__dialog-tab-bar">
          <button
            type="button"
            className={`pretext-plus-editor__dialog-tab${tab === "in-document" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
            onClick={() => setTab("in-document")}
          >
            In Document
            {documentAssets.length > 0 && (
              <span className="pretext-plus-editor__asset-tab-count">{documentAssets.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`pretext-plus-editor__dialog-tab${tab === "add" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
            onClick={() => { setTab("add"); setAddKind(null); }}
          >
            Add Asset
          </button>
        </div>

        <div className="pretext-plus-editor__dialog-content pretext-plus-editor__dialog-content--single">
          {tab === "in-document"
            ? renderInDocument()
            : addKind === null
              ? renderKindPicker()
              : addKind === "image"
                ? renderImageAdd()
                : renderDoenetAdd()}
        </div>

        <div className="pretext-plus-editor__dialog-actions">
          <button
            type="button"
            className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetManagerModal;
