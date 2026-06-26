import type { Division, DivisionType } from "../../types/sections";
import type { SourceFormat } from "../../types/editor";

/** Draft state for the inline division edit form. */
export interface EditDraft {
  title: string;
  type: DivisionType;
  xmlId: string;
  label: string;
  sourceFormat: SourceFormat;
}

export const SOURCE_FORMAT_LABELS: Record<SourceFormat, string> = {
  pretext: "PreTeXt",
  latex: "LaTeX",
  markdown: "Markdown",
};

export const TYPE_LABELS: Record<string, string> = {
  book: "Book",
  article: "Art",
  slideshow: "Slides",
  part: "Part",
  chapter: "Ch",
  introduction: "Intro",
  conclusion: "Conc",
  section: "§",
  worksheet: "WS",
  handout: "HO",
  exercises: "Ex",
  references: "Ref",
  glossary: "Gls",
  solutions: "Sol",
  "reading-questions": "RQ",
};

export const TYPE_FULL_LABELS: Record<string, string> = {
  book: "Book",
  article: "Article",
  slideshow: "Slideshow",
  part: "Part",
  chapter: "Chapter",
  section: "Section",
  worksheet: "Worksheet",
  handout: "Handout",
  exercises: "Exercises",
  references: "References",
  glossary: "Glossary",
  solutions: "Solutions",
  "reading-questions": "Reading Questions",
  introduction: "Introduction",
  conclusion: "Conclusion",
};

/** Division types that can be freely reordered (not positionally constrained). */
export const REGULAR_DIVISION_TYPES: DivisionType[] = [
  "introduction",
  "part",
  "chapter",
  "section",
  "worksheet",
  "handout",
  "exercises",
  "references",
  "glossary",
  "solutions",
  "reading-questions",
  "conclusion",
];

/** Returns true for division types that can be freely reordered. */
export function isRegularDivision(type: string): boolean {
  return type !== "introduction" && type !== "conclusion";
}

/** Introduction must be first, conclusion must be last within a parent. */
export function validateDivisionOrder(divisions: Division[]): boolean {
  const introIdx = divisions.findIndex((d) => d.type === "introduction");
  const conclusionIdx = divisions.findIndex((d) => d.type === "conclusion");
  return (
    (introIdx === -1 || introIdx === 0) &&
    (conclusionIdx === -1 || conclusionIdx === divisions.length - 1)
  );
}
