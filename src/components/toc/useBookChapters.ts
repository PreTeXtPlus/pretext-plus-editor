/**
 * Book-mode state hook.
 *
 * Owns:
 *   - `expandedChapterIds`: which chapters are currently expanded in the TOC.
 *   - `chapterSectionsById`: a memoized map of parsed `{sections, wrapper}`
 *     keyed by chapter id, derived from each chapter's `content` field.
 *
 * A chapter whose `content` is `undefined` (not yet loaded from the
 * back-end) maps to `null`.  The map is recomputed whenever the `chapters`
 * array reference changes.
 *
 * This hook does NOT own the active-chapter editing state — that remains in
 * {@link useSectionedEditing}, which still operates on a single source string.
 * Phases 3 and 4 layer multi-chapter rendering and cross-chapter DnD on top
 * of this map.
 */
import { useCallback, useMemo, useState } from "react";

import { splitDocument } from "../../sectionUtils";
import type {
  DocumentChapter,
  DocumentSection,
  DocumentSplitResult,
} from "../../types/sections";

export interface ChapterParseResult {
  sections: DocumentSection[];
  wrapper: string;
}

export interface BookChaptersState {
  /** Set of chapter ids currently expanded in the TOC. */
  expandedChapterIds: Set<string>;
  /** Add a chapter id to the expanded set. */
  expandChapter: (chapterId: string) => void;
  /** Remove a chapter id from the expanded set. */
  collapseChapter: (chapterId: string) => void;
  /** Toggle a chapter's expansion state. */
  toggleChapterExpanded: (chapterId: string) => void;
  /**
   * Parsed `{sections, wrapper}` for the chapter, or `null` if its content
   * is not loaded or fails to parse.
   */
  getChapterParse: (chapterId: string) => ChapterParseResult | null;
}

export interface BookChaptersOptions {
  chapters: DocumentChapter[];
}

export function useBookChapters({
  chapters,
}: BookChaptersOptions): BookChaptersState {
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const chapterSectionsById = useMemo(() => {
    const next = new Map<string, ChapterParseResult | null>();
    for (const ch of chapters) {
      if (ch.content === undefined) {
        next.set(ch.id, null);
        continue;
      }
      try {
        const result: DocumentSplitResult = splitDocument(ch.content);
        next.set(ch.id, {
          sections: result.sections,
          wrapper: result.wrapper,
        });
      } catch {
        next.set(ch.id, null);
      }
    }
    return next;
  }, [chapters]);

  const expandChapter = useCallback((chapterId: string) => {
    setExpandedChapterIds((prev) => {
      if (prev.has(chapterId)) return prev;
      const next = new Set(prev);
      next.add(chapterId);
      return next;
    });
  }, []);

  const collapseChapter = useCallback((chapterId: string) => {
    setExpandedChapterIds((prev) => {
      if (!prev.has(chapterId)) return prev;
      const next = new Set(prev);
      next.delete(chapterId);
      return next;
    });
  }, []);

  const toggleChapterExpanded = useCallback((chapterId: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }, []);

  const getChapterParse = useCallback(
    (chapterId: string) => chapterSectionsById.get(chapterId) ?? null,
    [chapterSectionsById],
  );

  return {
    expandedChapterIds,
    expandChapter,
    collapseChapter,
    toggleChapterExpanded,
    getChapterParse,
  };
}
