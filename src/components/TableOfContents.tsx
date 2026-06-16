import ArticleToc from "./toc/ArticleToc";
import { useEditorStore } from "../store/hooks";
import "./TableOfContents.css";

export interface TableOfContentsProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** When provided, shows "Open asset picker" affordance in the TOC. */
  onOpenAssetPicker?: () => void;
}

/**
 * TOC sidebar.  Reads most of its data and action callbacks from the editor
 * store so that Editors.tsx doesn't need to drill them down.
 */
const TableOfContents = ({
  isCollapsed,
  onToggleCollapse,
  onOpenAssetPicker,
}: TableOfContentsProps) => {
  const isDivisionsMode = useEditorStore((s) => s.isDivisionsMode);
  const editMode = useEditorStore((s) => s.editMode);
  const parseError = useEditorStore((s) => (isDivisionsMode ? null : s.parseError));
  const hideSectionList = useEditorStore((s) => s.hideSectionList);
  const refreshSections = useEditorStore((s) => s.refreshSections);

  const showRefresh = !isDivisionsMode && editMode === "sectioned";

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
          {showRefresh && (
            <button
              type="button"
              className="pretext-plus-editor__toc-toggle"
              onClick={refreshSections}
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
        <ArticleToc onOpenAssetPicker={onOpenAssetPicker} />
      )}
    </div>
  );
};

export default TableOfContents;
