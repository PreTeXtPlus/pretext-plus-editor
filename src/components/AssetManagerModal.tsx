import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { Asset, AssetKind } from "../types/editor";
import { useEditorStore } from "../store/hooks";
import { buildProjectAssetView, type AssetRow } from "../assetView";
import { ASSET_KIND_LABELS, SHOW_DOENET, VISIBLE_ASSET_KINDS } from "../assetKinds";
import "./dialog.css";
import "./AssetManagerModal.css";
import doenetLogo from "../assets/doenet.png";

export interface AssetManagerModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * When set, the modal opens in "resolve" mode for an unresolved
   * `<plus:KIND ref="..."/>` placeholder: it goes straight to the source picker
   * for that kind, and whatever asset the user picks/uploads/creates is bound to
   * this placeholder (its ref is rewritten in the source) instead of copying an
   * embed code.
   */
  resolveTarget?: { kind: AssetKind; ref: string } | null;
  /**
   * When set, the modal opens in "replace" mode for an existing asset: it goes
   * straight to the source picker, and whatever the user picks/uploads/creates
   * takes over from this asset (handled by `onReplaceAsset`).
   */
  replaceTarget?: Asset | null;
  onLoadAssets?: () => Promise<Asset[]>;
  onLoadLibraryAssets?: () => Promise<Asset[]>;
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
  /** Notify that an asset now exists in the project (optimistic pool add). */
  onAssetAdded: (asset: Asset) => void;
  /** Rewrite in-document `<plus:KIND ref="oldRef"/>` placeholders to `newRef`. */
  onResolveRef: (kind: AssetKind, oldRef: string, newRef: string) => void;
  /**
   * Replace `oldAsset` with the user's chosen `newAsset`. `fromLibrary` is true
   * when `newAsset` is an existing library asset (so it keeps its own ref and
   * the document is re-pointed), false when freshly created (so it adopts the
   * old asset's ref).
   */
  onReplaceAsset: (oldAsset: Asset, newAsset: Asset, fromLibrary: boolean) => void;
}

type MainTab = "in-document" | "add";
type ImageSourceTab = "library" | "upload" | "url";
type DoenetSourceTab = "library" | "create";

const embedFor = (kind: AssetKind, ref: string) => `<plus:${kind} ref="${ref}"/>`;

const AssetManagerModal = ({
  open,
  onClose,
  resolveTarget,
  replaceTarget,
  onLoadAssets,
  onLoadLibraryAssets,
  onAddFromLibrary,
  onUpload,
  onFetchUrl,
  onCreateDoenet,
  onRemoveAsset,
  onAssetAdded,
  onResolveRef,
  onReplaceAsset,
}: AssetManagerModalProps) => {
  const divisions = useEditorStore((s) => s.divisions);
  // Authoritative project-asset pool, owned by the store. A fresh server list
  // from `onLoadAssets` is written straight back into it via `setProjectAssets`.
  const projectAssets = useEditorStore((s) => s.projectAssets) ?? [];
  const setProjectAssets = useEditorStore((s) => s.setProjectAssets);
  const libraryAssets = useEditorStore((s) => s.libraryAssets);
  const openAssetEditor = useEditorStore((s) => s.openAssetEditor);
  const openAssetResolver = useEditorStore((s) => s.openAssetResolver);
  const removeAssetRefFromDocument = useEditorStore((s) => s.removeAssetRefFromDocument);
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

  // Copy feedback (keyed by `kind:ref`)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Success panel shown after a normal-mode add (asset added + embed copied).
  const [addedAsset, setAddedAsset] = useState<Asset | null>(null);

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

  // Load assets once per open. Keyed solely on `open` so it cannot re-fire on
  // unrelated re-renders; `loadAssets` is read through a ref to avoid a
  // self-sustaining loop (loading writes to the store → re-render → host hands
  // a fresh `onClose`/loader → effect would otherwise re-run → reloads forever).
  const loadAssetsRef = useRef(loadAssets);
  useEffect(() => {
    loadAssetsRef.current = loadAssets;
  });
  useEffect(() => {
    if (!open) return;
    loadAssetsRef.current();
  }, [open]);

  // Escape-to-close. Re-binds when `onClose` changes, but never triggers a load.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const assetView = buildProjectAssetView(divisions, resolvedAssets);

  // ── Commit a freshly-produced asset (upload/url/library/create) ───────────
  // Replace mode swaps it in for `replaceTarget`. Resolve mode binds it to the
  // placeholder being resolved (rewriting that placeholder's ref). Otherwise
  // (normal add) it's dropped in the pool, its embed code is copied, and the
  // success panel is shown so the user can paste it where they want it.
  const commitAsset = (asset: Asset, opts?: { fromLibrary?: boolean }) => {
    if (replaceTarget) {
      onReplaceAsset(replaceTarget, asset, !!opts?.fromLibrary);
      onClose();
      return;
    }
    onAssetAdded(asset);
    if (resolveTarget) {
      if (asset.ref) onResolveRef(resolveTarget.kind, resolveTarget.ref, asset.ref);
      onClose();
      return;
    }
    if (asset.ref) navigator.clipboard.writeText(embedFor(asset.kind, asset.ref)).catch(() => {});
    setAddedAsset(asset);
  };

  const handleCopy = (kind: AssetKind, ref: string) => {
    const key = `${kind}:${ref}`;
    navigator.clipboard.writeText(embedFor(kind, ref)).catch(() => {});
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
    commitAsset(asset, { fromLibrary: true });
  };

  const handleFileSelect = async (file: File) => {
    if (!onUpload) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const asset = await onUpload(file);
      commitAsset(asset);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
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
        commitAsset(asset);
      } catch (err) {
        setUrlError(err instanceof Error ? err.message : "Failed to add URL.");
      } finally {
        setIsAddingUrl(false);
      }
    } else {
      commitAsset({
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
        commitAsset(asset);
      } catch (err) {
        setDoenetError(err instanceof Error ? err.message : "Failed to create activity.");
      } finally {
        setIsCreatingDoenet(false);
      }
    } else {
      commitAsset({ id: `doenet-${Date.now()}`, name, ref, kind: "doenet" });
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
                    title={!asset.ref ? "Asset has no reference — cannot use" : inProject ? `Use "${asset.ref}"` : `Add to project & use "${asset.ref}"`}
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

  // ── "In Document" tab — the joined project-asset view ─────────────────────
  const renderInDocument = () => {
    if (assetView.length === 0) {
      return (
        <div className="pretext-plus-editor__am-placeholder">
          <p>No assets in this project yet.</p>
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

    const byKind = VISIBLE_ASSET_KINDS.map((kind) => ({
      kind,
      rows: assetView.filter((r) => r.kind === kind),
    })).filter((g) => g.rows.length > 0);

    const renderRow = (row: AssetRow) => {
      const ck = `${row.kind}:${row.ref}`;
      const onOpen = () => {
        if (row.status === "unlinked") {
          // Switches this same modal into resolve mode (resolveTarget wins in render).
          openAssetResolver(row.kind, row.ref);
        } else {
          // Hand off to the standalone asset editor; close the manager so the
          // two dialogs don't stack.
          openAssetEditor(row.kind, row.ref);
          onClose();
        }
      };
      return (
        <li key={ck} className="pretext-plus-editor__am-doc-row">
          <button
            type="button"
            className="pretext-plus-editor__am-row-info pretext-plus-editor__am-row-info--btn"
            onClick={onOpen}
            title={row.status === "unlinked" ? "No asset for this reference — click to link or create one" : "Edit asset"}
          >
            <span className="pretext-plus-editor__am-row-name">{row.asset?.name ?? row.ref}</span>
            <span className="pretext-plus-editor__am-row-ref">{row.ref}</span>
          </button>
          {row.status === "unlinked" && (
            <span className="pretext-plus-editor__am-status pretext-plus-editor__am-status--warn" title="No asset for this reference">
              needs asset
            </span>
          )}
          {row.status === "unused" && (
            <span className="pretext-plus-editor__am-status" title="Not referenced in the document yet">
              not placed
            </span>
          )}
          <div className="pretext-plus-editor__am-row-actions">
            <button
              type="button"
              className="pretext-plus-editor__am-action-btn"
              onClick={onOpen}
            >
              {row.status === "unlinked" ? "Link / create" : "Edit"}
            </button>
            <button
              type="button"
              className={`pretext-plus-editor__am-action-btn${copiedKey === ck ? " pretext-plus-editor__am-action-btn--done" : ""}`}
              onClick={() => handleCopy(row.kind, row.ref)}
              title={`Copy ${embedFor(row.kind, row.ref)}`}
            >
              {copiedKey === ck ? "Copied!" : "Copy"}
            </button>
            {onRemoveAsset && row.asset && (
              <button
                type="button"
                className="pretext-plus-editor__am-action-btn pretext-plus-editor__am-action-btn--danger"
                onClick={() => {
                  // Also strip the placeholders, else the row would return as
                  // "needs asset" (mirrors the sidebar's Remove from project).
                  if (
                    row.inDocument &&
                    !window.confirm(
                      `Remove "${row.asset!.name}" from the project? This also deletes its reference(s) from the document.`,
                    )
                  ) {
                    return;
                  }
                  onRemoveAsset(row.asset!);
                  removeAssetRefFromDocument(row.kind, row.ref);
                  onClose();
                }}
                title="Remove from project"
              >
                Remove
              </button>
            )}
          </div>
        </li>
      );
    };

    return (
      <div className="pretext-plus-editor__am-in-doc">
        {byKind.map(({ kind, rows }) => (
          <div key={kind} className="pretext-plus-editor__am-kind-group">
            <div className="pretext-plus-editor__am-kind-header">
              <span aria-hidden="true">📁</span>
              <span>{ASSET_KIND_LABELS[kind]}</span>
              <span className="pretext-plus-editor__am-kind-count">{rows.length}</span>
            </div>
            <ul className="pretext-plus-editor__am-list">{rows.map(renderRow)}</ul>
          </div>
        ))}
      </div>
    );
  };

  // ── Success panel after a normal-mode add ─────────────────────────────────
  const renderAddedSuccess = (asset: Asset) => (
    <div className="pretext-plus-editor__am-success">
      <p className="pretext-plus-editor__am-success-title">
        ✓ Added “{asset.name}” — embed code copied to clipboard
      </p>
      <p className="pretext-plus-editor__dialog-helper-copy">
        It now appears in the Assets list. Paste this where you want it to appear:
      </p>
      {asset.ref && (
        <div className="pretext-plus-editor__am-embed-row">
          <code className="pretext-plus-editor__am-embed-code">{embedFor(asset.kind, asset.ref)}</code>
          <button
            type="button"
            className={`pretext-plus-editor__am-action-btn${copiedKey === `${asset.kind}:${asset.ref}` ? " pretext-plus-editor__am-action-btn--done" : ""}`}
            onClick={() => handleCopy(asset.kind, asset.ref!)}
          >
            {copiedKey === `${asset.kind}:${asset.ref}` ? "Copied!" : "Copy again"}
          </button>
        </div>
      )}
      <div className="pretext-plus-editor__am-success-actions">
        <button
          type="button"
          className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
          onClick={() => { setAddedAsset(null); setAddKind(null); setTab("add"); }}
        >
          Add another
        </button>
        <button
          type="button"
          className="pretext-plus-editor__dialog-button"
          onClick={() => { setAddedAsset(null); setTab("in-document"); }}
        >
          Done
        </button>
      </div>
    </div>
  );

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

  const renderImageAdd = (showBack: boolean) => (
    <div className="pretext-plus-editor__am-configure">
      {showBack && (
        <button type="button" className="pretext-plus-editor__am-back-btn" onClick={() => setAddKind(null)}>
          ← Back
        </button>
      )}
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
              {isAddingUrl ? "Adding…" : onFetchUrl && onUpload ? "Add to Project" : "Add"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDoenetAdd = (showBack: boolean) => (
    <div className="pretext-plus-editor__am-configure">
      {showBack && (
        <button type="button" className="pretext-plus-editor__am-back-btn" onClick={() => setAddKind(null)}>
          ← Back
        </button>
      )}
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
              The reference ID is used in the embed code: <code>{embedFor("doenet", doenetRef || "my-activity")}</code>
            </p>
            {doenetError && <p className="pretext-plus-editor__am-error">{doenetError}</p>}
            <button
              type="button"
              className="pretext-plus-editor__dialog-button"
              onClick={handleCreateDoenet}
              disabled={!doenetName.trim() || !doenetRef.trim() || isCreatingDoenet}
            >
              {isCreatingDoenet ? "Creating…" : onCreateDoenet ? "Create" : "Add"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Source-picker mode (resolve / replace): go straight to the picker ──────
  const renderSourcePickerMode = (kind: AssetKind, title: string, hint: ReactNode) => (
    <>
      <div className="pretext-plus-editor__dialog-header">
        <h2 className="pretext-plus-editor__dialog-title">{title}</h2>
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
        <p className="pretext-plus-editor__dialog-helper-copy pretext-plus-editor__am-resolve-hint">
          {hint}
        </p>
        {kind === "doenet" ? renderDoenetAdd(false) : renderImageAdd(false)}
      </div>
      <div className="pretext-plus-editor__dialog-actions">
        <button
          type="button"
          className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </>
  );

  const renderResolveMode = (target: { kind: AssetKind; ref: string }) =>
    renderSourcePickerMode(
      target.kind,
      "Link asset",
      <>
        The reference <code>{target.ref}</code> has no asset yet. Choose or create one — the
        reference in your document will be updated to match.
      </>,
    );

  const renderReplaceMode = (target: Asset) =>
    renderSourcePickerMode(
      target.kind,
      "Replace asset",
      <>
        Choose or upload a new asset to replace <code>{target.name}</code>. Every place
        it’s used in your document will show the new asset.
      </>,
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
        {resolveTarget ? (
          renderResolveMode(resolveTarget)
        ) : replaceTarget ? (
          renderReplaceMode(replaceTarget)
        ) : (
          <>
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

            {addedAsset ? (
              <div className="pretext-plus-editor__dialog-content pretext-plus-editor__dialog-content--single">
                {renderAddedSuccess(addedAsset)}
              </div>
            ) : (
              <>
                <div className="pretext-plus-editor__dialog-tab-bar">
                  <button
                    type="button"
                    className={`pretext-plus-editor__dialog-tab${tab === "in-document" ? " pretext-plus-editor__dialog-tab--active" : ""}`}
                    onClick={() => setTab("in-document")}
                  >
                    Assets
                    {assetView.length > 0 && (
                      <span className="pretext-plus-editor__asset-tab-count">{assetView.length}</span>
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
                        ? renderImageAdd(true)
                        : renderDoenetAdd(true)}
                </div>
              </>
            )}

            <div className="pretext-plus-editor__dialog-actions">
              <button
                type="button"
                className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetManagerModal;
