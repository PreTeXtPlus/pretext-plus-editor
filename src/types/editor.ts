export type SourceFormat = "pretext" | "latex";

export interface EditorContentState {
  sourceContent: string;
  sourceFormat: SourceFormat;
  pretextContent?: string;
  pretextError?: string;
}

export type EditorContentChange = EditorContentState;
