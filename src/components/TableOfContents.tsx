import { useState } from "react";
import type { Division, DocumentSection, DocumentSectionType } from "../types/sections";
import type { ProjectAsset } from "../types/editor";
import ArticleToc from "./toc/ArticleToc";
import "./TableOfContents.css";

export interface TableOfContentsProps {
  // ── Legacy (non-divisions) mode ────────────────────────────────────────────
  sections: DocumentSection[];
  currentSectionId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSection: (id: string) => void;
  onAddSection: (afterId: string | null) => void;
  onAddIntroduction: () => void;
  onAddConclusion: () => void;
  onRemoveSection: (id: string) => void;
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
  onMergeSections?: (sourceId: string, targetId: string) => void;
  onAddFirstSection?: () => void;
  onRefresh?: () => void;
  editMode: "document" | "sectioned";
  onToggleEditMode?: () => void;
  readonly?: boolean;
  projectType?: "article" | "book";
  parseError?: string | null;
  hideSectionList?: boolean;

  // ── Divisions mode ─────────────────────────────────────────────────────────
  /**
   * Flat pool of all project divisions.  When provided, the TOC switches to
   * divisions mode: hierarchy is derived by parsing `<plus:* ref="..."/>`
   * placeholders in each division's content.
   */
  divisions?: Division[];
  /** The `xmlId` of the root division (book / article / slideshow). */
  rootDivisionId?: string;
  /** The `xmlId` of the currently active division. */
  activeDivisionId?: string | null;
  /**
   * Called when a structural drag-and-drop reorder changes the ref-placeholder
   * order inside a parent division's content.
   */
  onDivisionContentChange?: (xmlId: string, newContent: string) => void;

  // ── Assets ─────────────────────────────────────────────────────────────────
  assets?: ProjectAsset[];
  onAssetInsert?: (asset: ProjectAsset) => void;
  onOpenAssetPicker?: () => void;
}

/**
 * TOC sidebar.  Routes to ArticleToc (which handles both flat legacy lists and
 * the new divisions-mode tree) or shows a placeholder when the section list is
 * hidden.
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
    parseError,
    hideSectionList = false,
    divisions,
    rootDivisionId,
    activeDivisionId,
    onDivisionContentChange,
    assets,
    onAssetInsert,
    onOpenAssetPicker,
  } = props;

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
      ) : (
        <ArticleToc
          // Divisions mode
          divisions={divisions}
          rootDivisionId={rootDivisionId}
          activeDivisionId={activeDivisionId ?? null}
          onDivisionContentChange={onDivisionContentChange}
          // Legacy mode
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

    </div>
  );
};

export default TableOfContents;
