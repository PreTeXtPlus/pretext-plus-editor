import { formatPretext } from "@pretextbook/format";
import { latexToPretext } from "@pretextbook/latex-pretext";
import type { SourceFormat } from "./types/editor";

export interface DerivedPretextResult {
  pretextContent?: string;
  pretextError?: string;
}

const LATEX_FORMAT_MARKERS = [
  "\\documentclass",
  "\\begin{document}",
  "\\begin{",
  "\\section",
  "\\chapter",
  "\\title",
  "\\author",
];

export function detectSourceFormat(content: string): SourceFormat {
  const trimmedContent = content.trim();
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

export function convertLatexToPretext(latexContent: string): string {
  const trimmedLatex = latexContent.trim();
  if (!trimmedLatex) {
    return "";
  }
  const converted = String(latexToPretext(trimmedLatex)).trim();
  return converted ? formatPretext(converted) : "";
}

export function getConversionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Could not convert LaTeX to PreTeXt.";
}

export function derivePretextContent(
  sourceContent: string,
  sourceFormat: SourceFormat,
): DerivedPretextResult {
  if (sourceFormat === "pretext") {
    return { pretextContent: sourceContent };
  }

  try {
    return { pretextContent: convertLatexToPretext(sourceContent) };
  } catch (error) {
    return { pretextError: getConversionErrorMessage(error) };
  }
}
