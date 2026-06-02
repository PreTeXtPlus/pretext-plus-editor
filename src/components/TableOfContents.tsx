import { useState } from "react";
import type {
  DocumentChapter,
  DocumentSection,
  DocumentSectionType,
} from "../types/sections";
import type { ProjectAsset } from "../types/editor";
import ArticleToc from "./toc/ArticleToc";
import BookToc from "./toc/BookToc";
import type { ChapterParseResult } from "./toc/useBookChapters";
import "./TableOfContents.css";

export interface TableOfContentsProps {
  sections: DocumentSection[];
  currentSectionId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSection: (id: string) => void;
  onAddSection: (afterId: string | null) => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
  onRemoveSection: (id: string) => void;
  /**
   * Called when the user commits changes from the inline edit form.
   * `changes` may include a new title, type, xml:id, and/or label.
   */
  onUpdateSection: (
    id: string,
    changes: {
      title?: string;
      type?: DocumentSectionType;
      xmlId?: string | null;
      label?: string | null;
    },
  ) => void;
  onReorderSections: (sections: DocumentSection[]) => void;
  /**
   * Called when the user drags one section onto another to merge them.
   * `sourceId` is appended to the end of `targetId`.
   */
  onMergeSections?: (sourceId: string, targetId: string) => void;
  /**
   * Called when the user wants to convert the (currently unsectioned) document
   * into a single section and switch to sectioned mode.
   */
  onAddFirstSection?: () => void;
  /**
   * Called when the user requests a manual TOC refresh (sectioned mode).
   * Re-parses the merged document to pick up any sub-sections the user
   * added inside the current section.
   */
  onRefresh?: () => void;
  /** Current editing mode */
  editMode: "document" | "sectioned";
  /** Called when the user clicks the "Edit full document" link */
  onToggleEditMode: () => void;
  /** When true (document mode), hide all edit controls */
  readonly?: boolean;
  /**
   * Whether this is an `"article"` (default) or `"book"` project.
   * When `"book"`, chapter items are rendered above the section list.
   */
  projectType?: "article" | "book";
  /**
   * Book chapter summaries provided by the host.
   * Only meaningful when `projectType === "book"`.
   */
  chapters?: DocumentChapter[];
  /**
   * The id of the currently loaded/active chapter.
   * Only meaningful when `projectType === "book"`.
   */
  currentChapterId?: string | null;
  /**
   * Called when the user clicks a chapter to request loading it.
   * The host is responsible for fetching the chapter source and updating
   * the `source` prop accordingly.
   */
  onChapterSelect?: (chapterId: string) => void;
  /**
   * Called when the user drags chapters into a new order.
   * Receives the full reordered `DocumentChapter[]`; the host is responsible
   * for persisting the new order (e.g., via a Rails PATCH request).
   * When omitted, chapter drag handles are hidden and reordering is disabled.
   */
  onChaptersReorder?: (chapters: DocumentChapter[]) => void;
  /**
   * The set of chapter ids whose section list should be displayed expanded.
   * Owned by the parent `useBookChapters` hook.  Only meaningful when
   * `projectType === "book"`.
   */
  expandedChapterIds?: Set<string>;
  /**
   * Toggle a chapter's expanded state.  Wired to the chevron button.
   * Only meaningful when `projectType === "book"`.
   */
  onToggleChapterExpanded?: (chapterId: string) => void;
  /**
   * Looks up parsed `{sections, wrapper}` for a given chapter id.  Returns
   * `null` for chapters whose `content` is not yet loaded or fails to
   * parse.  Provided by `useBookChapters`.
   */
  getChapterParse?: (chapterId: string) => ChapterParseResult | null;
  /**
   * Called when a chapter is expanded for the first time and its content
   * has not yet been fetched.  The host should fetch the chapter source
   * and update the `chapters` prop with `content` populated.
   */
  onChapterRequestLoad?: (chapterId: string) => void;
  /**
   * Called when the user clicks the "+ Add chapter" row at the bottom of
   * the chapter list.  When omitted, the row is hidden.
   */
  onChapterAdd?: (afterChapterId: string | null) => void;
  /**
   * Called when the user removes a chapter from the TOC.  When omitted,
   * the chapter remove (×) button is hidden.
   */
  onChapterRemove?: (chapterId: string) => void;
  /**
   * Persist a chapter's updated content (e.g. after a cross-chapter
   * section drag).  When omitted, cross-chapter section drops are
   * disabled and rejected silently.
   */
  onChapterContentChange?: (chapterId: string, content: string) => void;
  /**
   * Handle a section click that targets a chapter other than the active
   * one.  The host should switch active chapter and land on the section
   * with the given title.  Only meaningful in book mode.
   */
  onSelectSectionInChapter?: (chapterId: string, sectionTitle: string) => void;
  /**
   * Commit edited chapter properties (title, xml:id, label) from the inline
   * chapter edit form.  When omitted, the chapter edit (✎) button is hidden.
   */
  onUpdateChapter?: (
    chapterId: string,
    changes: { title?: string; xmlId?: string | null; label?: string | null },
  ) => void;
  /**
   * When set, the current source XML cannot be parsed and the TOC will
   * display the message as a red warning banner.  Section-list operations
   * (re-parsing, mode switching) remain blocked until the XML is fixed.
   */
  parseError?: string | null;
  /**
   * When true, the section list body (ArticleToc / BookToc) is hidden and
   * replaced with a brief informational note.  Used for source formats that
   * don't support sectioned editing (e.g. Markdown).
   */
  hideSectionList?: boolean;
  /**
   * Project assets shown in the bottom Assets panel.
   * When omitted, the panel is hidden.
   */
  assets?: ProjectAsset[];
  /**
   * Called when the user clicks "Insert" on an asset in the Assets panel.
   */
  onAssetInsert?: (asset: ProjectAsset) => void;
  /**
   * Called when the user clicks the "+" button in the Assets panel header
   * to open the asset picker dialog.
   */
  onOpenAssetPicker?: () => void;
}

/**
 * The table-of-contents sidebar.  This component is a thin dispatcher that
 * owns only the collapsed-state UI; the body is delegated to either
 * {@link ArticleToc} or {@link BookToc} based on `projectType`.
 */
const TableOfContents = (props: TableOfContentsProps) => {
  const {
    sections,
    currentSectionId,
    isCollapsed,
    onToggleCollapse,
    onSelectSection,
    onAddSection,
    onAddIntroduction,
    onAddConclusion,
    onRemoveSection,
    onUpdateSection,
    onReorderSections,
    onMergeSections,
    onAddFirstSection,
    onRefresh,
    editMode,
    onToggleEditMode,
    readonly = false,
    projectType = "article",
    chapters = [],
    currentChapterId,
    onChapterSelect,
    onChaptersReorder,
    expandedChapterIds,
    onToggleChapterExpanded,
    getChapterParse,
    onChapterRequestLoad,
    onChapterAdd,
    onChapterRemove,
    onChapterContentChange,
    onSelectSectionInChapter,
    onUpdateChapter,
    parseError,
    hideSectionList = false,
    assets,
    onAssetInsert,
    onOpenAssetPicker,
  } = props;

  const [assetsExpanded, setAssetsExpanded] = useState(true);

  if (isCollapsed) {
    return (
      <div className="pretext-plus-editor__toc pretext-plus-editor__toc--collapsed">
        <button
          type="button"
          className="pretext-plus-editor__toc-toggle"
          onClick={onToggleCollapse}
          aria-label="Expand table of contents"
          title="Expand table of contents"
        >
          ☰
        </button>
      </div>
    );
  }

  const isBookMode = projectType === "book";

  return (
    <div className="pretext-plus-editor__toc">
      <div className="pretext-plus-editor__toc-header">
        <span className="pretext-plus-editor__toc-heading">Contents</span>
        <div className="pretext-plus-editor__toc-header-actions">
          {onRefresh && (
            <button
              type="button"
              className="pretext-plus-editor__toc-toggle"
              onClick={onRefresh}
              aria-label="Refresh table of contents"
              title="Refresh table of contents (re-parse sections)"
            >
              ↻
            </button>
          )}
          <button
            type="button"
            className="pretext-plus-editor__toc-toggle"
            onClick={onToggleCollapse}
            aria-label="Collapse table of contents"
            title="Collapse table of contents"
          >
            ✕
          </button>
        </div>
      </div>

      {parseError && (
        <div
          className="pretext-plus-editor__toc-parse-error"
          role="alert"
          title={parseError}
        >
          <strong>Cannot parse source.</strong> Section operations are
          disabled until the XML is well-formed.
          <div className="pretext-plus-editor__toc-parse-error-detail">
            {parseError}
          </div>
        </div>
      )}

      {hideSectionList ? (
        <div className="pretext-plus-editor__toc-hidden-sections-note">
          Section navigation is not available for this source format.
        </div>
      ) : isBookMode ? (
        <BookToc
          sections={sections}
          currentSectionId={currentSectionId}
          onSelectSection={onSelectSection}
          onAddSection={onAddSection}
          onAddIntroduction={onAddIntroduction}
          onAddConclusion={onAddConclusion}
          onRemoveSection={onRemoveSection}
          onUpdateSection={onUpdateSection}
          onReorderSections={onReorderSections}
          onAddFirstSection={onAddFirstSection}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          readonly={readonly}
          chapters={chapters}
          currentChapterId={currentChapterId}
          onChapterSelect={onChapterSelect}
          onChaptersReorder={onChaptersReorder}
          expandedChapterIds={expandedChapterIds ?? new Set()}
          onToggleChapterExpanded={onToggleChapterExpanded ?? (() => {})}
          getChapterParse={getChapterParse ?? (() => null)}
          onChapterRequestLoad={onChapterRequestLoad}
          onChapterAdd={onChapterAdd}
          onChapterRemove={onChapterRemove}
          onChapterContentChange={onChapterContentChange}
          onSelectSectionInChapter={onSelectSectionInChapter}
          onUpdateChapter={onUpdateChapter}
        />
      ) : (
        <ArticleToc
          sections={sections}
          currentSectionId={currentSectionId}
          onSelectSection={onSelectSection}
          onAddSection={onAddSection}
          onAddIntroduction={onAddIntroduction}
          onAddConclusion={onAddConclusion}
          onRemoveSection={onRemoveSection}
          onUpdateSection={onUpdateSection}
          onReorderSections={onReorderSections}
          onMergeSections={onMergeSections}
          onAddFirstSection={onAddFirstSection}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          readonly={readonly}
        />
      )}

      {assets !== undefined && (
        <div className="pretext-plus-editor__toc-assets">
          <div className="pretext-plus-editor__toc-assets-header">
            <button
              type="button"
              className="pretext-plus-editor__toc-assets-toggle"
              onClick={() => setAssetsExpanded((v) => !v)}
              aria-expanded={assetsExpanded}
              aria-label={assetsExpanded ? "Collapse assets" : "Expand assets"}
            >
              <span className="pretext-plus-editor__toc-assets-chevron">
                {assetsExpanded ? "▾" : "▸"}
              </span>
              <span className="pretext-plus-editor__toc-heading">Assets</span>
              {assets.length > 0 && (
                <span className="pretext-plus-editor__toc-assets-count">
                  {assets.length}
                </span>
              )}
            </button>
            {onOpenAssetPicker && (
              <button
                type="button"
                className="pretext-plus-editor__toc-toggle"
                onClick={onOpenAssetPicker}
                aria-label="Add or insert asset"
                title="Add or insert asset"
              >
                +
              </button>
            )}
          </div>

          {assetsExpanded && (
            <div className="pretext-plus-editor__toc-assets-body">
              {assets.length === 0 ? (
                <p className="pretext-plus-editor__toc-assets-empty">
                  No assets yet.
                  {onOpenAssetPicker && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="pretext-plus-editor__toc-assets-add-link"
                        onClick={onOpenAssetPicker}
                      >
                        Add one
                      </button>
                    </>
                  )}
                </p>
              ) : (
                <ul className="pretext-plus-editor__toc-assets-list">
                  {assets.map((asset) => (
                    <li
                      key={asset.id}
                      className="pretext-plus-editor__toc-asset-item"
                    >
                      <div className="pretext-plus-editor__toc-asset-thumb">
                        <img
                          src={asset.url}
                          alt=""
                          className="pretext-plus-editor__toc-asset-thumb-img"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                          }}
                        />
                      </div>
                      <span
                        className="pretext-plus-editor__toc-asset-name"
                        title={`${asset.name} (${asset.filename})`}
                      >
                        <span className="pretext-plus-editor__toc-asset-label">
                          {asset.name}
                        </span>
                        <span className="pretext-plus-editor__toc-asset-filename">
                          {asset.filename}
                        </span>
                      </span>
                      {onAssetInsert && (
                        <button
                          type="button"
                          className="pretext-plus-editor__toc-action-btn"
                          onClick={() => onAssetInsert(asset)}
                          title={`Insert <image source="${asset.filename}"/>`}
                          aria-label={`Insert ${asset.filename}`}
                        >
                          ↩
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TableOfContents;
