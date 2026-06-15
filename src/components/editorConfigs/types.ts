/** Per-format Monaco editor configuration. */
export interface FormatEditorConfig {
  /** Monaco language identifier for syntax highlighting. */
  language: string;
  /**
   * Called once when the Monaco instance is ready (and again when the format
   * changes).  Register language extensions — completions, hover providers,
   * syntax tokens, etc. — and return a disposable so they can be torn down
   * when the format changes or the editor unmounts.
   */
  registerMonacoExtensions?: (monaco: any) => { dispose: () => void } | null;
}
