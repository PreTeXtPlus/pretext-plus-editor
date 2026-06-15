import { registerMarkdownSyntax } from "./markdownSyntax";
import type { FormatEditorConfig } from "./types";

export const markdownConfig: FormatEditorConfig = {
  language: "pretext-markdown",
  registerMonacoExtensions: (monaco) => registerMarkdownSyntax(monaco),
};
