/**
 * Utilities for splitting a PreTeXt article into individual sections and
 * merging them back into a complete document.
 *
 * Splitting always works at the `<section>`, `<introduction>`, and
 * `<conclusion>` level inside a top-level `<article>` element.
 */

import { fromXml } from "xast-util-from-xml";
import { toXml } from "xast-util-to-xml";
import type { Element, Root } from "xast";
import type {
  DocumentSection,
  DocumentSplitResult,
  DocumentSectionType,
} from "./types/sections";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Generate a simple unique ID (not RFC-4122, but collision-resistant enough for in-memory use). */
function generateId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Extract the plain-text title from a `<section>` / `<introduction>` / `<conclusion>` element. */
function extractTitle(element: Element): string {
  const titleChild = element.children.find(
    (child) => child.type === "element" && (child as Element).name === "title",
  ) as Element | undefined;
  if (!titleChild) return "";
  return titleChild.children
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; value: string }).value)
    .join("")
    .trim();
}

/** The XML tag names that are extracted as individual sections in sectioned mode. */
const SECTION_TAGS: ReadonlySet<string> = new Set([
  "introduction",
  "section",
  "worksheet",
  "handout",
  "exercises",
  "references",
  "glossary",
  "solutions",
  "reading-questions",
  "conclusion",
]);

/** Map a tag name to its `DocumentSectionType` (the two are identical for PreTeXt). */
function tagToType(tag: string): DocumentSectionType {
  // All recognised section-level tags map directly to their tag name as the type.
  // Unknown tags fall back to "section" so legacy data is not broken.
  return SECTION_TAGS.has(tag) ? (tag as DocumentSectionType) : "section";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split a PreTeXt document into its top-level sections.
 *
 * The returned `wrapper` is an opaque XML string encoding the document shell
 * (article element, docinfo, and any non-section children).  Pass it back to
 * {@link mergeDocument} to reconstruct the full document.
 *
 * If the document contains no splittable children a single synthetic section
 * is created that wraps all body content.
 */
/** PreTeXt document-level element names that can act as the XML root. */
const DOCUMENT_ROOT_TAGS: ReadonlySet<string> = new Set([
  "article",
  "book",
  "letter",
  "memo",
  "slideshow",
]);

export function splitDocument(xml: string): DocumentSplitResult {
  let normalized = xml.trim();
  // Strip XML declaration if present.
  if (normalized.startsWith("<?xml")) {
    const end = normalized.indexOf("?>");
    if (end !== -1) normalized = normalized.slice(end + 2).trim();
  }

  // Always wrap in a synthetic root so that bare multi-section content
  // (which is valid XML only as a fragment, not a document) parses without
  // "extra content at end of document" errors.
  const tree: Root = fromXml(`<__root__>${normalized}</__root__>`);
  const syntheticRoot = tree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;

  if (!syntheticRoot) {
    return { wrapper: "", sections: [] };
  }

  const elementChildren = syntheticRoot.children.filter(
    (n) => n.type === "element",
  ) as Element[];

  // ── Case 1: content has a proper document wrapper (article, book, …) ──────
  if (
    elementChildren.length === 1 &&
    DOCUMENT_ROOT_TAGS.has(elementChildren[0].name)
  ) {
    const docRoot = elementChildren[0];
    const sectionElements = docRoot.children.filter(
      (c) => c.type === "element" && SECTION_TAGS.has((c as Element).name),
    ) as Element[];
    const nonSectionChildren = docRoot.children.filter(
      (c) => !(c.type === "element" && SECTION_TAGS.has((c as Element).name)),
    );

    const wrapperRoot: Root = {
      type: "root",
      children: [{ ...docRoot, children: nonSectionChildren } as Element],
    };
    const wrapper = toXml(wrapperRoot);

    // Return empty sections — caller decides what to do when there are none.
    if (sectionElements.length === 0) {
      return { wrapper, sections: [] };
    }

    return {
      wrapper,
      sections: sectionElements.map((el) => ({
        id: generateId(),
        title: extractTitle(el) || untitledLabel(el.name),
        content: toXml({ type: "root", children: [el] } as Root),
        type: tagToType(el.name),
      })),
    };
  }

  // ── Case 2: bare sections (no document wrapper) ───────────────────────────
  // Collect top-level section elements; any non-section content is discarded
  // (it would be in preamble whitespace / comments which are not editable).
  const sectionElements = elementChildren.filter((el) =>
    SECTION_TAGS.has(el.name),
  );

  if (sectionElements.length === 0) {
    // No sections — return empty list; caller handles unsectioned documents.
    return { wrapper: "", sections: [] };
  }

  return {
    wrapper: "", // empty = bare-sections format; mergeDocument concatenates
    sections: sectionElements.map((el) => ({
      id: generateId(),
      title: extractTitle(el) || untitledLabel(el.name),
      content: toXml({ type: "root", children: [el] } as Root),
      type: tagToType(el.name),
    })),
  };
}

/**
 * Reconstruct a complete PreTeXt document from a wrapper and an ordered
 * list of sections.
 *
 * The `wrapper` must be the value returned by a prior call to
 * {@link splitDocument}.
 */
export function mergeDocument(
  wrapper: string,
  sections: DocumentSection[],
): string {
  if (!wrapper) {
    // Fallback: just concatenate section contents with blank lines.
    return sections.map((s) => s.content).join("\n\n");
  }

  const wrapperTree: Root = fromXml(wrapper);
  const rootElement = wrapperTree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;

  if (!rootElement) {
    return sections.map((s) => s.content).join("\n\n");
  }

  // Parse each section back to an xast element.
  const sectionNodes: Element[] = sections.flatMap((sec) => {
    const secTree: Root = fromXml(sec.content);
    return secTree.children.filter(
      (n) => n.type === "element",
    ) as Element[];
  });

  // Interleave blank-line text nodes between sections for readability.
  const interleaved = sectionNodes.flatMap((node, i) =>
    i === 0
      ? [{ type: "text" as const, value: "\n\n" }, node]
      : [{ type: "text" as const, value: "\n\n" }, node],
  );

  const merged: Root = {
    type: "root",
    children: [
      {
        ...rootElement,
        children: [...rootElement.children, ...interleaved, { type: "text" as const, value: "\n" }],
      } as Element,
    ],
  };

  return toXml(merged);
}

/**
 * Replace (or insert) the `<title>` of a section XML string with `newTitle`.
 * Returns the updated XML string.
 */
export function updateSectionTitle(
  sectionXml: string,
  newTitle: string,
): string {
  const tree: Root = fromXml(sectionXml);
  const rootEl = tree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;
  if (!rootEl) return sectionXml;

  const titleIndex = rootEl.children.findIndex(
    (n) => n.type === "element" && (n as Element).name === "title",
  );

  const titleNode: Element = {
    type: "element",
    name: "title",
    attributes: {},
    children: [{ type: "text", value: newTitle }],
  };

  if (titleIndex === -1) {
    rootEl.children.unshift(titleNode);
  } else {
    rootEl.children.splice(titleIndex, 1, titleNode);
  }

  return toXml(tree);
}

/** Create a new blank `<section>` as a `DocumentSection`. */
export function createNewSection(title = "New Section"): DocumentSection {
  const content = `<section>\n<title>${title}</title>\n<p></p>\n</section>`;
  return {
    id: generateId(),
    title,
    content,
    type: "section",
  };
}

/** Create a blank `<introduction>` section. */
export function createIntroduction(): DocumentSection {
  const content = `<introduction>\n<p></p>\n</introduction>`;
  return {
    id: generateId(),
    title: "Introduction",
    content,
    type: "introduction",
  };
}

/** Create a blank `<conclusion>` section. */
export function createConclusion(): DocumentSection {
  const content = `<conclusion>\n<p></p>\n</conclusion>`;
  return {
    id: generateId(),
    title: "Conclusion",
    content,
    type: "conclusion",
  };
}

/**
 * Strip the outer wrapper element from a section XML string, returning just the
 * inner XML content (i.e. everything between `<section>` and `</section>`).
 * Used to show only the section body in the code editor so users can't
 * accidentally edit or delete the enclosing element.
 */
export function stripSectionWrapper(sectionXml: string): string {
  const tree: Root = fromXml(sectionXml);
  const rootEl = tree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;
  if (!rootEl) return sectionXml;
  const inner: Root = { type: "root", children: rootEl.children };
  return toXml(inner);
}

/**
 * Re-wrap inner XML content (as returned by the code editor) with the correct
 * outer element for the given section type.
 *
 * Because `DocumentSectionType` values are identical to the XML tag names,
 * this is simply `<${type}>inner</${type}>`.
 */
export function rewrapSection(
  innerXml: string,
  type: DocumentSectionType,
): string {
  return `<${type}>${innerXml}</${type}>`;
}

/**
 * Ensure the given XML string has the correct outer element for its section
 * type.  If the outer tag is already present it is returned unchanged;
 * otherwise the content is re-wrapped so that accidental deletions in the
 * code editor are recovered gracefully.
 */
export function ensureSectionWrapper(
  content: string,
  type: DocumentSectionType,
): string {
  const trimmed = content.trimStart();
  if (trimmed.startsWith(`<${type}`)) return content;
  return rewrapSection(content, type);
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

function untitledLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

// ===========================================================================
// LaTeX-specific section utilities
// ===========================================================================

/**
 * The opaque wrapper value stored for LaTeX documents.
 * Encoded as JSON in the `DocumentSplitResult.wrapper` string.
 */
interface LatexWrapper {
  preamble: string; // everything up to and including \begin{document}
  closing: string;  // \end{document} and anything after
}

function encodeLatexWrapper(w: LatexWrapper): string {
  return JSON.stringify(w);
}

function decodeLatexWrapper(s: string): LatexWrapper | null {
  try {
    return JSON.parse(s) as LatexWrapper;
  } catch {
    return null;
  }
}

/** Extract title from a `\section{…}` or `\section*{…}` command string. */
function extractLatexSectionTitle(sectionCmd: string): string {
  const m = /\\section\*?\{([^}]*)\}/.exec(sectionCmd);
  return m?.[1]?.trim() ?? "Section";
}

/**
 * Split the preamble and body from a LaTeX string.
 * Returns `{ preamble, body, closing }` where `preamble` ends just after
 * `\begin{document}` and `closing` starts at `\end{document}`.
 */
function splitLatexPreamble(latex: string): {
  preamble: string;
  body: string;
  closing: string;
} {
  const beginIdx = latex.indexOf("\\begin{document}");
  if (beginIdx === -1) {
    return { preamble: "", body: latex, closing: "" };
  }
  const afterBegin = beginIdx + "\\begin{document}".length;
  const endIdx = latex.lastIndexOf("\\end{document}");
  if (endIdx !== -1 && endIdx > afterBegin) {
    return {
      preamble: latex.slice(0, afterBegin),
      body: latex.slice(afterBegin, endIdx),
      closing: latex.slice(endIdx),
    };
  }
  return {
    preamble: latex.slice(0, afterBegin),
    body: latex.slice(afterBegin),
    closing: "",
  };
}

/**
 * Split a LaTeX document into sections using `\section{…}` / `\section*{…}`
 * command style.
 *
 * Content before the first `\section` (after the preamble) becomes an
 * `introduction` section when non-empty.
 */
function splitLatexByCommands(latex: string): DocumentSplitResult {
  const { preamble, body, closing } = splitLatexPreamble(latex);

  // Split body at every \section{...} or \section*{...} (capturing the command)
  const parts = body.split(/(\\section\*?\{[^}]*\})/);
  // parts[0]               = intro content (before first \section)
  // parts[1], parts[3], …  = \section{…} headers
  // parts[2], parts[4], …  = section body text

  const sections: DocumentSection[] = [];
  const intro = parts[0].trim();
  if (intro) {
    sections.push({
      id: generateId(),
      title: "Introduction",
      content: intro,
      type: "introduction",
    });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i]; // e.g. \section{My Title}
    const sectionBody = parts[i + 1] ?? "";
    const title = extractLatexSectionTitle(header);
    sections.push({
      id: generateId(),
      title,
      content: header + sectionBody,
      type: "section",
    });
  }

  if (sections.length === 0) {
    // No sections found — return empty list; caller handles unsectioned docs.
    const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
    return { wrapper, sections: [] };
  }

  const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
  return { wrapper, sections };
}

/**
 * Split a LaTeX document by `\begin{section}...\end{section}` environments.
 * Content before the first `\begin{section}` becomes an `introduction`.
 */
function splitLatexByEnvironments(latex: string): DocumentSplitResult {
  const { preamble, body, closing } = splitLatexPreamble(latex);

  const envRe = /\\begin\{section\}([\s\S]*?)\\end\{section\}/g;
  const sections: DocumentSection[] = [];

  // Find the first environment to determine intro content
  const firstMatch = envRe.exec(body);
  if (firstMatch) {
    const before = body.slice(0, firstMatch.index).trim();
    if (before) {
      sections.push({
        id: generateId(),
        title: "Introduction",
        content: before,
        type: "introduction",
      });
    }
    // Process the first match
    const titleMatch = /\\title\{([^}]*)\}/.exec(firstMatch[1]);
    const title = titleMatch?.[1]?.trim() ?? "Section";
    sections.push({
      id: generateId(),
      title,
      content: firstMatch[0],
      type: "section",
    });
  }

  // Process remaining matches
  let match: RegExpExecArray | null;
  while ((match = envRe.exec(body)) !== null) {
    const titleMatch = /\\title\{([^}]*)\}/.exec(match[1]);
    const title = titleMatch?.[1]?.trim() ?? "Section";
    sections.push({
      id: generateId(),
      title,
      content: match[0],
      type: "section",
    });
  }

  if (sections.length === 0) {
    // No sections found — return empty list.
    const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
    return { wrapper, sections: [] };
  }

  const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
  return { wrapper, sections };
}

/**
 * Split a LaTeX document into its top-level sections.
 *
 * Supports two splitting styles:
 * - `\section{…}` / `\section*{…}` command style (default)
 * - `\begin{section}…\end{section}` environment style
 *
 * Content before the first section marker becomes an `introduction` section.
 * The document preamble (everything up to and including `\begin{document}`)
 * is stored in the returned `wrapper` and must be passed back to
 * {@link mergeLatexDocument} to reconstruct the full document.
 */
export function splitLatexDocument(latex: string): DocumentSplitResult {
  if (/\\begin\{section\}/.test(latex)) {
    return splitLatexByEnvironments(latex);
  }
  return splitLatexByCommands(latex);
}

/**
 * Reconstruct a complete LaTeX document from a wrapper and an ordered list
 * of sections.
 */
export function mergeLatexDocument(
  wrapper: string,
  sections: DocumentSection[],
): string {
  const sectionTexts = sections.map((s) => s.content).join("\n\n");

  if (!wrapper) {
    return sectionTexts;
  }

  const w = decodeLatexWrapper(wrapper);
  if (!w) return sectionTexts;

  const parts = [w.preamble, sectionTexts];
  if (w.closing) parts.push(w.closing);
  else parts.push("\\end{document}");
  return parts.join("\n\n");
}

/**
 * Strip the section-level header from a LaTeX section string so the code
 * editor shows only the body content.
 *
 * - For `\section{…}`-style sections: removes the leading `\section{…}` command.
 * - For `\begin{section}…\end{section}`-style: removes the wrapper tags.
 * - For introduction / conclusion (no header): returns as-is.
 */
export function stripLatexSectionWrapper(
  content: string,
  type: DocumentSectionType,
): string {
  if (type === "introduction" || type === "conclusion") {
    return content; // no structural wrapper to strip
  }
  const trimmed = content.trimStart();
  if (trimmed.startsWith("\\begin{section}")) {
    return trimmed
      .replace(/^\\begin\{section\}\s*\n?/, "")
      .replace(/\n?\\end\{section\}\s*$/, "");
  }
  // Remove leading \section{…} or \section*{…} line
  return content.replace(/^\\section\*?\{[^}]*\}\s*\n?/, "");
}

/**
 * Re-wrap inner LaTeX content (as produced by the code editor) with the
 * correct section header for the given section type and title.
 *
 * - `section` type: prepends `\section{title}`.
 * - `introduction` / `conclusion`: returns inner content unchanged.
 *
 * Pass `originalContent` to detect whether the document uses environment style
 * (`\begin{section}…\end{section}`) so the same style is preserved.
 */
export function rewrapLatexSection(
  inner: string,
  type: DocumentSectionType,
  title: string,
  originalContent?: string,
): string {
  if (type === "introduction" || type === "conclusion") {
    return inner;
  }
  // Detect environment style from the original content
  if (originalContent?.trimStart().startsWith("\\begin{section}")) {
    return `\\begin{section}\n${inner}\n\\end{section}`;
  }
  return `\\section{${title}}\n${inner}`;
}

/**
 * Ensure the given LaTeX string has the correct section header/wrapper for its
 * type.  If the header is already present it is returned unchanged; otherwise
 * it is re-wrapped using `rewrapLatexSection` so that accidental deletions in
 * the code editor are recovered gracefully.
 */
export function ensureLatexSectionWrapper(
  content: string,
  type: DocumentSectionType,
  title: string,
  originalContent?: string,
): string {
  if (type === "introduction" || type === "conclusion") {
    return content; // no structural wrapper for these
  }
  const trimmed = content.trimStart();
  if (
    trimmed.startsWith("\\section") ||
    trimmed.startsWith("\\begin{section}")
  ) {
    return content;
  }
  return rewrapLatexSection(content, type, title, originalContent);
}

/**
 * Replace (or insert) the section title in a LaTeX section string.
 *
 * - For `\section{…}` style: updates the command argument.
 * - For `\begin{section}` style: updates the `\title{…}` inside.
 */
export function updateLatexSectionTitle(
  content: string,
  newTitle: string,
): string {
  if (/\\section[*]?\{/.test(content)) {
    return content.replace(
      /^(\\section\*?\{)[^}]*/,
      (_, prefix) => `${prefix}${newTitle}`,
    );
  }
  if (content.includes("\\begin{section}")) {
    if (/\\title\{/.test(content)) {
      return content.replace(/\\title\{[^}]*\}/, `\\title{${newTitle}}`);
    }
    return content.replace(
      "\\begin{section}",
      `\\begin{section}\n\\title{${newTitle}}`,
    );
  }
  return content;
}

/** Create a new blank LaTeX section as a `DocumentSection`. */
export function createNewLatexSection(title = "New Section"): DocumentSection {
  return {
    id: generateId(),
    title,
    content: `\\section{${title}}\n\n`,
    type: "section",
  };
}

/** Create a blank LaTeX introduction (bare content before first `\section`). */
export function createLatexIntroduction(): DocumentSection {
  return {
    id: generateId(),
    title: "Introduction",
    content: "% Introduction\n\n",
    type: "introduction",
  };
}

/** Create a blank LaTeX conclusion (bare content after last `\section`). */
export function createLatexConclusion(): DocumentSection {
  return {
    id: generateId(),
    title: "Conclusion",
    content: "% Conclusion\n\n",
    type: "conclusion",
  };
}

// ---------------------------------------------------------------------------
// Wrap-as-section and merge utilities
// ---------------------------------------------------------------------------

/** Tags that stay in the document wrapper and should not be moved into a section. */
const PRETEXT_HEADER_TAGS: ReadonlySet<string> = new Set(["title", "docinfo"]);

/**
 * Wrap all body content of a PreTeXt document (i.e. everything that is not
 * `<title>` or `<docinfo>`) into a single new `<section>`.
 *
 * Use this when a document has no sections and the user wants to start using
 * section-by-section editing mode.  The returned `wrapper` and `sections` can
 * be passed directly to {@link mergeDocument} to reconstruct the document.
 */
export function wrapDocumentAsSection(
  xml: string,
  sectionTitle = "Section 1",
): DocumentSplitResult {
  let normalized = xml.trim();
  if (normalized.startsWith("<?xml")) {
    const end = normalized.indexOf("?>");
    if (end !== -1) normalized = normalized.slice(end + 2).trim();
  }

  const tree: Root = fromXml(`<__root__>${normalized}</__root__>`);
  const syntheticRoot = tree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;

  if (!syntheticRoot) {
    return { wrapper: "", sections: [createNewSection(sectionTitle)] };
  }

  const elementChildren = syntheticRoot.children.filter(
    (n) => n.type === "element",
  ) as Element[];

  if (
    elementChildren.length === 1 &&
    DOCUMENT_ROOT_TAGS.has(elementChildren[0].name)
  ) {
    const docRoot = elementChildren[0];
    const wrapperChildren = docRoot.children.filter(
      (c) =>
        c.type === "element" &&
        PRETEXT_HEADER_TAGS.has((c as Element).name),
    );
    const bodyChildren = docRoot.children.filter(
      (c) =>
        !(
          c.type === "element" &&
          PRETEXT_HEADER_TAGS.has((c as Element).name)
        ),
    );

    const titleEl: Element = {
      type: "element",
      name: "title",
      attributes: {},
      children: [{ type: "text", value: sectionTitle }],
    };
    const sectionEl: Element = {
      type: "element",
      name: "section",
      attributes: {},
      children: [titleEl, ...bodyChildren],
    };

    const newWrapper: Root = {
      type: "root",
      children: [{ ...docRoot, children: wrapperChildren } as Element],
    };

    return {
      wrapper: toXml(newWrapper),
      sections: [
        {
          id: generateId(),
          title: sectionTitle,
          content: toXml({ type: "root", children: [sectionEl] } as Root),
          type: "section",
        },
      ],
    };
  }

  // Bare content — wrap everything in a section.
  return {
    wrapper: "",
    sections: [
      {
        id: generateId(),
        title: sectionTitle,
        content: `<section><title>${sectionTitle}</title>${normalized}</section>`,
        type: "section",
      },
    ],
  };
}

/**
 * Wrap all body content of a LaTeX document (everything between
 * `\begin{document}` and `\end{document}`, or the entire string if there is
 * no `\begin{document}`) into a single `\section{title}`.
 *
 * Use this when a document has no sections and the user wants to start using
 * section-by-section editing mode.
 */
export function wrapLatexDocumentAsSection(
  latex: string,
  sectionTitle = "Section 1",
): DocumentSplitResult {
  const { preamble, body, closing } = splitLatexPreamble(latex);
  const sectionContent = `\\section{${sectionTitle}}\n${body.trim()}`;
  const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
  return {
    wrapper,
    sections: [
      {
        id: generateId(),
        title: sectionTitle,
        content: sectionContent,
        type: "section",
      },
    ],
  };
}

/**
 * Merge two adjacent sections into one, keeping the title of the first.
 *
 * - For PreTeXt: parses both sections and concatenates the body children
 *   (skipping the second section's `<title>`).
 * - For LaTeX: strips the second section's header and appends its body.
 *
 * @param a First (absorbing) section.
 * @param b Second section whose content is appended to `a`.
 * @param isLatex Whether the document source is LaTeX.
 */
export function mergeTwoSections(
  a: DocumentSection,
  b: DocumentSection,
  isLatex: boolean,
): DocumentSection {
  if (isLatex) {
    const bBody = stripLatexSectionWrapper(b.content, b.type);
    return {
      ...a,
      content: a.content.trimEnd() + "\n\n" + bBody.trimStart(),
    };
  }

  // PreTeXt: parse and combine xast children
  const aTree = fromXml(a.content);
  const bTree = fromXml(b.content);
  const aEl = aTree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;
  const bEl = bTree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;

  if (!aEl || !bEl) {
    return { ...a, content: a.content + "\n\n" + b.content };
  }

  // Drop the second section's <title> element
  const bBodyChildren = bEl.children.filter(
    (c) => !(c.type === "element" && (c as Element).name === "title"),
  );
  const merged: Element = {
    ...aEl,
    children: [...aEl.children, ...bBodyChildren],
  };
  return {
    ...a,
    content: toXml({ type: "root", children: [merged] } as Root),
  };
}

// ---------------------------------------------------------------------------
// Section attribute utilities
// ---------------------------------------------------------------------------

/**
 * Extract `xml:id` and `label` attributes from the root element of a section
 * content string.  Returns empty strings when the attributes are absent.
 */
export function getSectionAttributes(content: string): {
  xmlId: string;
  label: string;
} {
  try {
    const tree: Root = fromXml(content);
    const el = tree.children.find((n) => n.type === "element") as
      | Element
      | undefined;
    if (!el) return { xmlId: "", label: "" };
    return {
      xmlId: (el.attributes?.["xml:id"] as string) ?? "",
      label: (el.attributes?.["label"] as string) ?? "",
    };
  } catch {
    return { xmlId: "", label: "" };
  }
}

/**
 * Update the title, tag name (type), `xml:id`, and `label` of a section.
 *
 * Pass `null` for `xmlId` or `label` to remove the attribute entirely.
 * Omit a key (or pass `undefined`) to leave it unchanged.
 *
 * Returns a new `DocumentSection` with updated `content`, `title`, and `type`.
 */
export function updateSectionMetadata(
  section: DocumentSection,
  changes: {
    title?: string;
    type?: DocumentSectionType;
    xmlId?: string | null;
    label?: string | null;
  },
): DocumentSection {
  const newType = changes.type ?? section.type;
  const newTitle = changes.title ?? section.title;

  try {
    const tree: Root = fromXml(section.content);
    const el = tree.children.find((n) => n.type === "element") as
      | Element
      | undefined;

    if (!el) {
      // Fallback: return section with type/title updated but content unchanged.
      return { ...section, title: newTitle, type: newType };
    }

    // Update tag name (type).
    const newEl: Element = { ...el, name: newType, attributes: { ...el.attributes } };

    // Update xml:id attribute.
    if (changes.xmlId !== undefined) {
      if (changes.xmlId === null || changes.xmlId === "") {
        delete newEl.attributes["xml:id"];
      } else {
        newEl.attributes["xml:id"] = changes.xmlId;
      }
    }

    // Update label attribute.
    if (changes.label !== undefined) {
      if (changes.label === null || changes.label === "") {
        delete newEl.attributes["label"];
      } else {
        newEl.attributes["label"] = changes.label;
      }
    }

    // Update <title> child element.
    const titleIndex = newEl.children.findIndex(
      (c) => c.type === "element" && (c as Element).name === "title",
    );
    const titleNode: Element = {
      type: "element",
      name: "title",
      attributes: {},
      children: [{ type: "text", value: newTitle }],
    };
    if (titleIndex === -1) {
      newEl.children = [titleNode, ...newEl.children];
    } else {
      newEl.children = [
        ...newEl.children.slice(0, titleIndex),
        titleNode,
        ...newEl.children.slice(titleIndex + 1),
      ];
    }

    const newContent = toXml({ type: "root", children: [newEl] } as Root);
    return { ...section, title: newTitle, type: newType, content: newContent };
  } catch {
    // If parsing fails just update the in-memory fields without touching content.
    return { ...section, title: newTitle, type: newType };
  }
}

// ---------------------------------------------------------------------------
// Section-as-document wrapping utilities (for section-scoped preview builds)
// ---------------------------------------------------------------------------

/**
 * Wrap a single section into a complete, valid PreTeXt document suitable for
 * an isolated preview build.
 *
 * The result is a full `<pretext>` document containing:
 * - the supplied `<docinfo>` (if any)
 * - an `<article>` element with the optional `title` and the section content
 *
 * Passing this to `onPreviewRebuild` instead of the full merged document
 * dramatically reduces build times when only one section has changed.
 *
 * @param section - The section to preview.
 * @param docinfo - Optional raw `<docinfo>…</docinfo>` XML string.
 * @param title   - Optional document title shown in the build output.
 */
export function wrapSectionAsDocument(
  section: DocumentSection,
  docinfo?: string,
  title?: string,
): string {
  // Parse the section content back to an xast element.
  const sectionTree: Root = fromXml(section.content);
  const sectionEl = sectionTree.children.find(
    (n) => n.type === "element",
  ) as Element | undefined;

  // Build <article> children: optional <title>, then the section element.
  const articleChildren: Array<Element | { type: "text"; value: string }> = [];
  if (title) {
    articleChildren.push({
      type: "element",
      name: "title",
      attributes: {},
      children: [{ type: "text", value: title }],
    } as Element);
  }
  if (sectionEl) {
    articleChildren.push({ type: "text" as const, value: "\n" });
    articleChildren.push(sectionEl);
  }

  const articleEl: Element = {
    type: "element",
    name: "article",
    attributes: {},
    children: articleChildren,
  };

  // Build <pretext> children: optional <docinfo>, then <article>.
  const pretextChildren: Array<Element | { type: "text"; value: string }> = [];
  if (docinfo?.trim()) {
    try {
      const docinfoTree: Root = fromXml(docinfo);
      const docinfoEl = docinfoTree.children.find(
        (n) => n.type === "element",
      ) as Element | undefined;
      if (docinfoEl) {
        pretextChildren.push(docinfoEl);
        pretextChildren.push({ type: "text" as const, value: "\n" });
      }
    } catch {
      // Malformed docinfo — skip rather than breaking the preview.
    }
  }
  pretextChildren.push(articleEl);

  const pretextEl: Element = {
    type: "element",
    name: "pretext",
    attributes: {},
    children: pretextChildren,
  };

  return toXml({ type: "root", children: [pretextEl] } as Root);
}

/**
 * Wrap a single LaTeX section into a complete, buildable LaTeX document.
 *
 * Reconstructs `preamble + section.content + closing` using the opaque
 * `wrapper` string produced by {@link splitLatexDocument}.  Suitable for
 * passing to `onPreviewRebuild` when in sectioned LaTeX mode.
 *
 * @param section - The section to preview.
 * @param wrapper - The opaque wrapper returned by {@link splitLatexDocument}.
 */
export function wrapLatexSectionAsDocument(
  section: DocumentSection,
  wrapper: string,
): string {
  if (!wrapper) {
    return section.content;
  }
  const w = decodeLatexWrapper(wrapper);
  if (!w) return section.content;

  const parts = [w.preamble, section.content.trim()];
  parts.push(w.closing || "\\end{document}");
  return parts.join("\n\n");
}

