import type { DocumentSectionType } from "../../types/sections";

/** Draft state for the inline section edit form. */
export interface EditDraft {
  title: string;
  type: DocumentSectionType;
  xmlId: string;
  label: string;
}

export const TYPE_LABELS: Record<string, string> = {
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

/** Section-level division types that can be freely reordered. */
export const REGULAR_DIVISION_TYPES: DocumentSectionType[] = [
  "section",
  "worksheet",
  "handout",
  "exercises",
  "references",
  "glossary",
  "solutions",
  "reading-questions",
];

/** Returns true for section-level divisions that can be freely reordered. */
export function isRegularDivision(type: string): boolean {
  return type !== "introduction" && type !== "conclusion";
}
