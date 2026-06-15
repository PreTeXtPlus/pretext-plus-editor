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
  Division,
  DivisionType,
  DocumentSection,
  DocumentSectionType,
  DocumentSplitResult,
} from "./types/sections";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Generate a simple unique ID (not RFC-4122, but collision-resistant enough for in-memory use). */
function generateId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
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

function tagToType(tag: string): DocumentSectionType {
  return SECTION_TAGS.has(tag) ? (tag as DocumentSectionType) : "section";
}

function untitledLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

const DOCUMENT_ROOT_TAGS: ReadonlySet<string> = new Set([
  "article",
  "book",
  "chapter",
  "letter",
  "memo",
  "slideshow",
]);

function trimTrailingWhitespaceNodes(
  children: Root["children"],
): Root["children"] {
  let end = children.length;
  while (end > 0) {
    const node = children[end - 1];
    if (node.type !== "text" || /\S/.test(node.value)) break;
    end -= 1;
  }
  return children.slice(0, end);
}

function trimBoundaryWhitespaceNodes(
  children: Root["children"],
): Root["children"] {
  let start = 0;
  let end = children.length;

  while (start < end) {
    const node = children[start];
    if (node.type !== "text" || /\S/.test(node.value)) break;
    start += 1;
  }

  while (end > start) {
    const node = children[end - 1];
    if (node.type !== "text" || /\S/.test(node.value)) break;
    end -= 1;
  }

  return children.slice(start, end);
}


function trimBoundaryBlankLines(value: string): string {
  return value
    .replace(/^(?:[ \t]*\r?\n)+/, "")
    .replace(/(?:\r?\n[ \t]*)+$/, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------


/**
 * Replace (or insert) the `<title>` of a section XML string with `newTitle`.
 * Returns the updated XML string.
 */
export function updateSectionTitle(
  sectionXml: string,
  newTitle: string,
): string {
  const tree: Root = fromXml(sectionXml);
  const rootEl = tree.children.find((n) => n.type === "element") as
    | Element
    | undefined;
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

/** Create a new blank `<section>` as a `Division`. */
export function createNewSection(title = "New Section"): DocumentSection {
  const id = generateId();
  const content = `<section xml:id="${id}">\n\t<title>${title}</title>\n\n\t<p>\n\n\t</p>\n\n</section>`;
  return {
    id,
    xmlId: id,
    title,
    content,
    type: "section",
    sourceFormat: "pretext",
  };
}

/** Create a blank `<introduction>` division. */
export function createIntroduction(): DocumentSection {
  const id = generateId();
  const content = `<introduction xml:id="${id}">\n\n\t<p>\n\n\t</p>\n\n</introduction>`;
  return {
    id,
    xmlId: id,
    title: "Introduction",
    content,
    type: "introduction",
    sourceFormat: "pretext",
  };
}

/** Create a blank `<conclusion>` division. */
export function createConclusion(): DocumentSection {
  const id = generateId();
  const content = `<conclusion xml:id="${id}">\n\n\t<p>\n\n\t</p>\n\n</conclusion>`;
  return {
    id,
    xmlId: id,
    title: "Conclusion",
    content,
    type: "conclusion",
    sourceFormat: "pretext",
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
  const rootEl = tree.children.find((n) => n.type === "element") as
    | Element
    | undefined;
  if (!rootEl) return sectionXml;
  const inner: Root = {
    type: "root",
    children: trimBoundaryWhitespaceNodes(rootEl.children),
  };
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
  const normalizedInnerXml = trimBoundaryBlankLines(innerXml);
  return `<${type}>\n${normalizedInnerXml}\n</${type}>`;
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

export function splitDocument(xml: string): DocumentSplitResult {
  let normalized = xml.trim();
  if (normalized.startsWith("<?xml")) {
    const end = normalized.indexOf("?>");
    if (end !== -1) normalized = normalized.slice(end + 2).trim();
  }
  const tree: Root = fromXml(`<__root__>${normalized}</__root__>`);
  const syntheticRoot = tree.children.find((n) => n.type === "element") as
    | Element
    | undefined;
  if (!syntheticRoot) return { wrapper: "", sections: [] };

  const elementChildren = syntheticRoot.children.filter(
    (n) => n.type === "element",
  ) as Element[];

  if (
    elementChildren.length === 1 &&
    DOCUMENT_ROOT_TAGS.has(elementChildren[0].name)
  ) {
    const docRoot = elementChildren[0];
    const sectionElements = docRoot.children.filter(
      (c) => c.type === "element" && SECTION_TAGS.has((c as Element).name),
    ) as Element[];
    const nonSectionChildren = trimTrailingWhitespaceNodes(
      docRoot.children.filter(
        (c) => !(c.type === "element" && SECTION_TAGS.has((c as Element).name)),
      ),
    );
    const wrapperRoot: Root = {
      type: "root",
      children: [{ ...docRoot, children: nonSectionChildren } as Element],
    };
    const wrapper = toXml(wrapperRoot);
    if (sectionElements.length === 0) return { wrapper, sections: [] };
    return {
      wrapper,
      sections: sectionElements.map((el) => {
        const id = generateId();
        return {
          id,
          xmlId: (el.attributes?.["xml:id"] as string) || id,
          title: extractTitle(el) || untitledLabel(el.name),
          content: toXml({ type: "root", children: [el] } as Root),
          type: tagToType(el.name),
          sourceFormat: "pretext" as const,
        };
      }),
    };
  }

  const sectionElements = elementChildren.filter((el) => SECTION_TAGS.has(el.name));
  if (sectionElements.length === 0) return { wrapper: "", sections: [] };
  return {
    wrapper: "",
    sections: sectionElements.map((el) => {
      const id = generateId();
      return {
        id,
        xmlId: (el.attributes?.["xml:id"] as string) || id,
        title: extractTitle(el) || untitledLabel(el.name),
        content: toXml({ type: "root", children: [el] } as Root),
        type: tagToType(el.name),
        sourceFormat: "pretext" as const,
      };
    }),
  };
}

export function mergeDocument(
  wrapper: string,
  sections: DocumentSection[],
): string {
  if (!wrapper) return sections.map((s) => s.content).join("\n\n");
  const wrapperTree: Root = fromXml(wrapper);
  const rootElement = wrapperTree.children.find((n) => n.type === "element") as
    | Element
    | undefined;
  if (!rootElement) return sections.map((s) => s.content).join("\n\n");
  const sectionNodes: Element[] = sections.flatMap((sec) => {
    try {
      const secTree: Root = fromXml(sec.content);
      return secTree.children.filter((n) => n.type === "element") as Element[];
    } catch {
      return [];
    }
  });
  const interleaved = sectionNodes.flatMap((node) => [
    { type: "text" as const, value: "\n\n" },
    node,
  ]);
  const merged: Root = {
    type: "root",
    children: [
      {
        ...rootElement,
        children: [
          ...rootElement.children,
          ...interleaved,
          { type: "text" as const, value: "\n" },
        ],
      } as Element,
    ],
  };
  return toXml(merged);
}

// ---------------------------------------------------------------------------
// Chapter wrapper utilities (book mode)
// ---------------------------------------------------------------------------

/**
 * Strip the outer `<chapter>` element from a chapter XML string, returning
 * just its inner content (title, sections, etc.).  Behaves exactly like
 * {@link stripSectionWrapper}: the enclosing element is dropped but all
 * children are kept, so the user edits the chapter body without ever seeing
 * or editing the `<chapter>` division tag itself.
 */
export function stripChapterWrapper(chapterXml: string): string {
  return stripSectionWrapper(chapterXml);
}

/** Escape a string for safe use inside a double-quoted XML attribute value. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/**
 * Re-wrap chapter body content (as produced by the code editor) with the
 * original `<chapter>` element, preserving its tag name and all attributes
 * (e.g. `xml:id`, `label`).
 *
 * The attributes are recovered from `originalChapterXml` — the last known
 * full chapter source — so that editing the body never drops them.  String
 * concatenation (rather than re-serialising via xast) keeps this robust to
 * invalid inner XML while the user is mid-edit.
 */
export function rewrapChapter(
  innerXml: string,
  originalChapterXml: string,
): string {
  let name = "chapter";
  const attrs: Record<string, string> = {};
  try {
    const tree: Root = fromXml(originalChapterXml);
    const el = tree.children.find((n) => n.type === "element") as
      | Element
      | undefined;
    if (el) {
      name = el.name;
      for (const [key, value] of Object.entries(el.attributes ?? {})) {
        if (value == null) continue;
        attrs[key] = String(value);
      }
    }
  } catch {
    // Fall back to a bare <chapter> wrapper if the original can't be parsed.
  }
  const attrStr = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");
  const normalizedInner = trimBoundaryBlankLines(innerXml);
  return `<${name}${attrStr}>\n${normalizedInner}\n</${name}>`;
}


// ===========================================================================
// LaTeX-specific section utilities
// ===========================================================================

interface LatexWrapper {
  preamble: string;
  closing: string;
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

function extractLatexSectionTitle(sectionCmd: string): string {
  const m = /\\section\*?\{([^}]*)\}/.exec(sectionCmd);
  return m?.[1]?.trim() ?? "Section";
}

function splitLatexPreamble(latex: string): {
  preamble: string;
  body: string;
  closing: string;
} {
  const beginIdx = latex.indexOf("\\begin{document}");
  if (beginIdx === -1) return { preamble: "", body: latex, closing: "" };
  const afterBegin = beginIdx + "\\begin{document}".length;
  const endIdx = latex.lastIndexOf("\\end{document}");
  if (endIdx !== -1 && endIdx > afterBegin) {
    return {
      preamble: latex.slice(0, afterBegin),
      body: latex.slice(afterBegin, endIdx),
      closing: latex.slice(endIdx),
    };
  }
  return { preamble: latex.slice(0, afterBegin), body: latex.slice(afterBegin), closing: "" };
}

function splitLatexByCommands(latex: string): DocumentSplitResult {
  const { preamble, body, closing } = splitLatexPreamble(latex);
  const parts = body.split(/(\\section\*?\{[^}]*\})/);
  const sections: DocumentSection[] = [];
  const intro = parts[0].trim();
  if (intro) {
    const id = generateId();
    sections.push({ id, xmlId: id, title: "Introduction", content: intro, type: "introduction", sourceFormat: "latex" });
  }
  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i];
    const sectionBody = parts[i + 1] ?? "";
    const title = extractLatexSectionTitle(header);
    const id = generateId();
    sections.push({ id, xmlId: id, title, content: header + sectionBody, type: "section", sourceFormat: "latex" });
  }
  const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
  return { wrapper, sections };
}

function splitLatexByEnvironments(latex: string): DocumentSplitResult {
  const { preamble, body, closing } = splitLatexPreamble(latex);
  const envRe = /\\begin\{section\}([\s\S]*?)\\end\{section\}/g;
  const sections: DocumentSection[] = [];
  const firstMatch = envRe.exec(body);
  if (firstMatch) {
    const before = body.slice(0, firstMatch.index).trim();
    if (before) {
      const id = generateId();
      sections.push({ id, xmlId: id, title: "Introduction", content: before, type: "introduction", sourceFormat: "latex" });
    }
    const titleMatch = /\\title\{([^}]*)\}/.exec(firstMatch[1]);
    const title = titleMatch?.[1]?.trim() ?? "Section";
    const id = generateId();
    sections.push({ id, xmlId: id, title, content: firstMatch[0], type: "section", sourceFormat: "latex" });
  }
  let match: RegExpExecArray | null;
  while ((match = envRe.exec(body)) !== null) {
    const titleMatch = /\\title\{([^}]*)\}/.exec(match[1]);
    const title = titleMatch?.[1]?.trim() ?? "Section";
    const id = generateId();
    sections.push({ id, xmlId: id, title, content: match[0], type: "section", sourceFormat: "latex" });
  }
  const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
  return { wrapper, sections };
}

export function splitLatexDocument(latex: string): DocumentSplitResult {
  if (/\\begin\{section\}/.test(latex)) return splitLatexByEnvironments(latex);
  return splitLatexByCommands(latex);
}

export function mergeLatexDocument(
  wrapper: string,
  sections: DocumentSection[],
): string {
  const sectionTexts = sections.map((s) => s.content).join("\n\n");
  if (!wrapper) return sectionTexts;
  const w = decodeLatexWrapper(wrapper);
  if (!w) return sectionTexts;
  const parts = [w.preamble, sectionTexts];
  parts.push(w.closing || "\\end{document}");
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
    return `\\begin{section}\n\n${inner}\n\n\\end{section}`;
  }
  return `\\section{${title}}\n\n${inner}`;
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
      `\\begin{section}\n\n\\title{${newTitle}}\n\n`,
    );
  }
  return content;
}

/** Create a new blank LaTeX section as a `Division`. */
export function createNewLatexSection(title = "New Section"): DocumentSection {
  const id = generateId();
  return {
    id,
    xmlId: id,
    title,
    content: `\\section{${title}}\n\n`,
    type: "section",
    sourceFormat: "latex",
  };
}

/** Create a blank LaTeX introduction. */
export function createLatexIntroduction(): DocumentSection {
  const id = generateId();
  return {
    id,
    xmlId: id,
    title: "Introduction",
    content: "% Introduction\n\n",
    type: "introduction",
    sourceFormat: "latex",
  };
}

/** Create a blank LaTeX conclusion. */
export function createLatexConclusion(): DocumentSection {
  const id = generateId();
  return {
    id,
    xmlId: id,
    title: "Conclusion",
    content: "% Conclusion\n\n",
    type: "conclusion",
    sourceFormat: "latex",
  };
}

// ---------------------------------------------------------------------------
// Wrap-as-section and merge utilities
// ---------------------------------------------------------------------------


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
  const aEl = aTree.children.find((n) => n.type === "element") as
    | Element
    | undefined;
  const bEl = bTree.children.find((n) => n.type === "element") as
    | Element
    | undefined;

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
    const newEl: Element = {
      ...el,
      name: newType,
      attributes: { ...el.attributes },
    };

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
    const newXmlId =
      changes.xmlId !== undefined && changes.xmlId !== null && changes.xmlId !== ""
        ? changes.xmlId
        : section.xmlId;
    return {
      ...section,
      title: newTitle,
      type: newType,
      xmlId: newXmlId,
      content: newContent,
    };
  } catch {
    return { ...section, title: newTitle, type: newType };
  }
}

/**
 * Update the `<title>`, `xml:id`, and `label` of a chapter XML string.
 *
 * Mirrors {@link updateSectionMetadata} but operates on a raw chapter source
 * string and never changes the element's tag name (a chapter is always a
 * chapter).  Pass `null`/empty for `xmlId` or `label` to remove the
 * attribute; omit a key (or pass `undefined`) to leave it unchanged.
 */
export function updateChapterMetadata(
  chapterXml: string,
  changes: {
    title?: string;
    xmlId?: string | null;
    label?: string | null;
  },
): string {
  try {
    const tree: Root = fromXml(chapterXml);
    const el = tree.children.find((n) => n.type === "element") as
      | Element
      | undefined;
    if (!el) return chapterXml;

    const newEl: Element = { ...el, attributes: { ...el.attributes } };

    if (changes.xmlId !== undefined) {
      if (changes.xmlId === null || changes.xmlId === "") {
        delete newEl.attributes["xml:id"];
      } else {
        newEl.attributes["xml:id"] = changes.xmlId;
      }
    }

    if (changes.label !== undefined) {
      if (changes.label === null || changes.label === "") {
        delete newEl.attributes["label"];
      } else {
        newEl.attributes["label"] = changes.label;
      }
    }

    if (changes.title !== undefined) {
      const titleIndex = newEl.children.findIndex(
        (c) => c.type === "element" && (c as Element).name === "title",
      );
      const titleNode: Element = {
        type: "element",
        name: "title",
        attributes: {},
        children: [{ type: "text", value: changes.title }],
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
    }

    return toXml({ type: "root", children: [newEl] } as Root);
  } catch {
    return chapterXml;
  }
}

const PRETEXT_HEADER_TAGS: ReadonlySet<string> = new Set(["title", "docinfo"]);

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
  const syntheticRoot = tree.children.find((n) => n.type === "element") as
    | Element
    | undefined;
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
      (c) => c.type === "element" && PRETEXT_HEADER_TAGS.has((c as Element).name),
    );
    const bodyChildren = docRoot.children.filter(
      (c) => !(c.type === "element" && PRETEXT_HEADER_TAGS.has((c as Element).name)),
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
    const id = generateId();
    return {
      wrapper: toXml(newWrapper),
      sections: [{
        id,
        xmlId: id,
        title: sectionTitle,
        content: toXml({ type: "root", children: [sectionEl] } as Root),
        type: "section",
        sourceFormat: "pretext" as const,
      }],
    };
  }
  const id = generateId();
  return {
    wrapper: "",
    sections: [{
      id,
      xmlId: id,
      title: sectionTitle,
      content: `<section xml:id="${id}">\n\t<title>${sectionTitle}</title>\n\n${normalized}\n</section>`,
      type: "section",
      sourceFormat: "pretext" as const,
    }],
  };
}

export function wrapLatexDocumentAsSection(
  latex: string,
  sectionTitle = "Section 1",
): DocumentSplitResult {
  const { preamble, body, closing } = splitLatexPreamble(latex);
  const sectionContent = `\\section{${sectionTitle}}\n\n${body.trim()}\n\n`;
  const wrapper = preamble ? encodeLatexWrapper({ preamble, closing }) : "";
  const id = generateId();
  return {
    wrapper,
    sections: [{ id, xmlId: id, title: sectionTitle, content: sectionContent, type: "section", sourceFormat: "latex" }],
  };
}

// ---------------------------------------------------------------------------
// Division ref utilities — `<plus:* ref="..."/>` placeholder manipulation
// ---------------------------------------------------------------------------

/**
 * Regex that matches any `<plus:TAG ref="VALUE"/>` self-closing placeholder.
 * Captures the ref value in group 1.
 * Accepts optional whitespace and extra attributes after `ref="..."`.
 */
const DIVISION_REF_RE = /<plus:[a-z-]+\s[^>]*ref="([^"]+)"[^>]*\/>/g;

/** Escape a string for safe literal use inside a `RegExp` constructor. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return the ordered list of `xmlId` values referenced by
 * `<plus:* ref="..."/>` placeholders found in `content`.
 *
 * Only direct children are returned — the function does not recurse.
 * Call it for each division in the pool to build the full tree.
 */
export function parseDivisionRefs(content: string): string[] {
  const refs: string[] = [];
  const re = new RegExp(DIVISION_REF_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    refs.push(m[1]);
  }
  return refs;
}

/**
 * Insert a `<plus:TYPE ref="xmlId"/>` placeholder into `content`.
 *
 * - When `afterXmlId` is `null` the ref is appended just before the closing
 *   tag of the outer element (or at the end of the string if none is found).
 * - When `afterXmlId` is provided the new ref is inserted immediately after
 *   that ref's placeholder.  If the named ref is not found, falls back to
 *   appending.
 */
export function insertDivisionRef(
  content: string,
  xmlId: string,
  type: DivisionType,
  afterXmlId: string | null,
): string {
  const tag = `<plus:${type} ref="${xmlId}"/>`;

  if (afterXmlId !== null) {
    const afterRe = new RegExp(
      `<plus:[a-z-]+\\s[^>]*ref="${escapeRegex(afterXmlId)}"[^>]*\\/>`,
    );
    const m = afterRe.exec(content);
    if (m) {
      const pos = m.index + m[0].length;
      return content.slice(0, pos) + "\n" + tag + content.slice(pos);
    }
  }

  // Append before the last closing tag, otherwise at end.
  const lastClose = content.lastIndexOf("</");
  if (lastClose !== -1) {
    return content.slice(0, lastClose) + tag + "\n" + content.slice(lastClose);
  }
  return content + "\n" + tag;
}

/**
 * Remove the `<plus:* ref="xmlId"/>` placeholder for `xmlId` from `content`.
 * The surrounding newline/whitespace is cleaned up so the result stays tidy.
 */
export function removeDivisionRef(content: string, xmlId: string): string {
  const re = new RegExp(
    `[ \t]*<plus:[a-z-]+\\s[^>]*ref="${escapeRegex(xmlId)}"[^>]*\\/>[ \t]*\n?`,
    "g",
  );
  return content.replace(re, "");
}

/**
 * Move an existing `<plus:* ref="xmlId"/>` placeholder to a new position.
 *
 * Equivalent to `removeDivisionRef` followed by `insertDivisionRef`, but
 * preserves the original tag's element name (e.g. `plus:section` stays
 * `plus:section` rather than being normalised to `plus:division`).
 *
 * - `afterXmlId === null` moves the ref to the end (before the closing tag).
 * - `afterXmlId` moves it immediately after that ref.
 */
export function moveDivisionRef(
  content: string,
  xmlId: string,
  afterXmlId: string | null,
): string {
  // Capture the original tag so we preserve its element name.
  const captureRe = new RegExp(
    `<plus:[a-z-]+\\s[^>]*ref="${escapeRegex(xmlId)}"[^>]*\\/>`,
  );
  const m = captureRe.exec(content);
  const originalTag = m ? m[0] : `<plus:division ref="${xmlId}"/>`;

  const withoutRef = removeDivisionRef(content, xmlId);

  if (afterXmlId !== null) {
    const afterRe = new RegExp(
      `<plus:[a-z-]+\\s[^>]*ref="${escapeRegex(afterXmlId)}"[^>]*\\/>`,
    );
    const after = afterRe.exec(withoutRef);
    if (after) {
      const pos = after.index + after[0].length;
      return (
        withoutRef.slice(0, pos) + "\n" + originalTag + withoutRef.slice(pos)
      );
    }
  }

  const lastClose = withoutRef.lastIndexOf("</");
  if (lastClose !== -1) {
    return (
      withoutRef.slice(0, lastClose) +
      originalTag +
      "\n" +
      withoutRef.slice(lastClose)
    );
  }
  return withoutRef + "\n" + originalTag;
}

/**
 * Build a reachability set starting from `rootXmlId` by following
 * `<plus:* ref="..."/>` placeholders recursively through the `divisions` pool.
 *
 * Returns a `Set<string>` of all `xmlId` values reachable from the root,
 * including the root itself.  Used to identify orphaned divisions.
 */
function collectReachable(divisions: Division[], rootXmlId: string): Set<string> {
  const seen = new Set<string>();
  const queue = [rootXmlId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const div = divisions.find((d) => d.xmlId === id);
    if (div) {
      for (const ref of parseDivisionRefs(div.content)) {
        queue.push(ref);
      }
    }
  }
  return seen;
}

/**
 * Return all divisions in `divisions` that are not reachable from
 * `rootXmlId` (and are not the root itself).
 *
 * Orphaned divisions are shown separately in the TOC so they can be placed
 * inside a parent division.
 */
export function getOrphanedDivisions(
  divisions: Division[],
  rootXmlId: string,
): Division[] {
  const reachable = collectReachable(divisions, rootXmlId);
  return divisions.filter((d) => !reachable.has(d.xmlId));
}

