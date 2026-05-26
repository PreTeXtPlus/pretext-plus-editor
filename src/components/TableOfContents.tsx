import type {
  DocumentChapter,
  DocumentSection,
  DocumentSectionType,
} from "../types/sections";
import ArticleToc from "./toc/ArticleToc";
import BookToc from "./toc/BookToc";
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

  const isBookMode = projectType === "book" && chapters.length > 0;

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

      {isBookMode ? (
        <BookToc
          sections={sections}
          currentSectionId={currentSectionId}
          onSelectSection={onSelectSection}
          onAddSection={onAddSection}
          onAddIntroduction={onAddIntroduction}
          onAddConclusion={onAddConclusion}
          onRemoveSection={onRemoveSection}
          onUpdateSection={onUpdateSection}
          onAddFirstSection={onAddFirstSection}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          readonly={readonly}
          chapters={chapters}
          currentChapterId={currentChapterId}
          onChapterSelect={onChapterSelect}
          onChaptersReorder={onChaptersReorder}
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
    </div>
  );
};

export default TableOfContents;
