import { formatPretext } from "@pretextbook/format";
import { latexToPretext } from "@pretextbook/latex-pretext";
import type { SourceFormat } from "./types/editor";

/** Returned by {@link derivePretextContent}. Exactly one of the two fields will be set. */
export interface DerivedPretextResult {
  /** The converted (or pass-through) PreTeXt XML string. */
  pretextSource?: string;
  /** Human-readable error when conversion fails. */
  pretextError?: string;
}

/**
 * Heuristic markers that strongly suggest a document is LaTeX rather than
 * PreTeXt/XML.  Checked in order by {@link detectSourceFormat}.
 */
const LATEX_FORMAT_MARKERS = [
  "\\documentclass",
  "\\begin{document}",
  "\\begin{",
  "\\section",
  "\\chapter",
  "\\title",
  "\\author",
];

/**
 * Inspects `source` and returns the most likely {@link SourceFormat}.
 *
 * Rules (applied in order):
 * 1. Empty/whitespace-only → `"pretext"` (safe default).
 * 2. Starts with `<` → `"pretext"` (XML document).
 * 3. Contains any {@link LATEX_FORMAT_MARKERS} → `"latex"`.
 * 4. Otherwise → `"pretext"`.
 */
export function detectSourceFormat(source: string): SourceFormat {
  const trimmedContent = source.trim();
  if (!trimmedContent) {
    return "pretext";
  }
  if (trimmedContent.startsWith("<")) {
    return "pretext";
  }
  if (LATEX_FORMAT_MARKERS.some((marker) => trimmedContent.includes(marker))) {
    return "latex";
  }
  return "pretext";
}

/**
 * Converts a LaTeX document string to formatted PreTeXt XML.
 *
 * @param latexContent - The raw LaTeX source to convert.
 * @returns The formatted PreTeXt XML string, or `""` if `latexContent` is blank.
 * @throws If the underlying `latexToPretext` conversion throws.
 */
export function convertLatexToPretext(latexContent: string): string {
  const trimmedLatex = latexContent.trim();
  if (!trimmedLatex) {
    return "";
  }
  const converted = String(latexToPretext(trimmedLatex)).trim();
  return converted ? formatPretext(converted) : "";
}

/**
 * Normalises an unknown thrown value into a displayable error message.
 *
 * @param error - The value caught in a `catch` block.
 * @returns A non-empty string suitable for showing to the user.
 */
export function getConversionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Could not convert LaTeX to PreTeXt.";
}

/**
 * Derives PreTeXt content from `sourceContent` according to `sourceFormat`.
 *
 * - If `sourceFormat` is `"pretext"`, the content is returned as-is.
 * - If `sourceFormat` is `"latex"`, the content is converted via
 *   {@link convertLatexToPretext}.  Conversion errors are caught and returned
 *   as `pretextError` so callers never need a try/catch.
 *
 * @param sourceContent - The raw source string.
 * @param sourceFormat - The format of `sourceContent`.
 * @returns A {@link DerivedPretextResult} with either `pretextSource` or `pretextError`.
 */
export function derivePretextContent(
  sourceContent: string,
  sourceFormat: SourceFormat,
): DerivedPretextResult {
  if (sourceFormat === "pretext") {
    return { pretextSource: sourceContent };
  }

  try {
    return { pretextSource: convertLatexToPretext(sourceContent) };
  } catch (error) {
    return { pretextError: getConversionErrorMessage(error) };
  }
}
