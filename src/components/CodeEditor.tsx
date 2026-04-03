import { Editor } from "@monaco-editor/react";
import { useState, useRef, useEffect } from "react";
import { registerCodeEditorCompletions } from "./codeEditorCompletions";
import CodeEditorMenu from "./CodeEditorMenu";
import type { SourceFormat } from "../types/editor";

interface CodeEditorProps {
  /** The current source content to display. */
  content: string;
  /** Determines the Monaco language mode (`"xml"` for PreTeXt, `"latex"` for LaTeX). */
  sourceFormat: SourceFormat;
  /** Called (debounced 500 ms) whenever the user edits the content. */
  onChange: (value: string | undefined) => void;
  /** If provided, Ctrl+Enter in the editor triggers this callback. */
  onRebuild?: () => void;
  /** If provided, Ctrl+S in the editor triggers this callback. */
  onSave?: () => void;
  /** Called when the user clicks "Import LaTeX" in the toolbar. */
  onOpenLatexImport: () => void;
  /**
   * If provided, a "Convert to PreTeXt" button is shown in the toolbar.
   * Called when the user clicks to open the conversion confirmation dialog.
   */
  onOpenConvertToPretext?: () => void;
  /**
   * Controls whether the "Convert to PreTeXt" button is enabled.
   * Should be `false` when conversion has failed.
   */
  canConvertToPretext?: boolean;
}

/** Static Monaco editor options shared across all instances of this component. */
const options = {
  automaticLayout: true,
  minimap: { enabled: false },
  acceptSuggestionOnCommitCharacter: false,
  quickSuggestions: false,
  wordWrap: "on" as const,
  insertSpaces: true,
  tabSize: 2,
  padding: { top: 10, bottom: 10 },
};

/**
 * Monaco-based code editor with an attached toolbar.
 *
 * Manages its own undo/redo state so the toolbar buttons stay in sync with
 * the editor model.  `onRebuild` and `onSave` callbacks are stored in refs
 * so keyboard shortcuts registered at mount time always call the latest
 * version without needing to re-register.
 *
 * Content is synced from props only when the prop value differs from what the
 * editor model already contains, to prevent cursor jumps on re-render.
 */
const CodeEditor = ({
  content,
  sourceFormat,
  onChange,
  onRebuild,
  onSave,
  onOpenLatexImport,
  onOpenConvertToPretext,
  canConvertToPretext,
}: CodeEditorProps) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const contentListenerRef = useRef<{ dispose: () => void } | null>(null);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const onRebuildRef = useRef(onRebuild);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onRebuildRef.current = onRebuild;
  }, [onRebuild]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  // const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    completionProviderRef.current?.dispose?.();
    completionProviderRef.current =
      sourceFormat === "pretext" && monacoRef.current
        ? registerCodeEditorCompletions(monacoRef.current)
        : null;
  }, [sourceFormat]);

  useEffect(() => {
    return () => {
      contentListenerRef.current?.dispose?.();
      completionProviderRef.current?.dispose?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // When the content prop changes from an external source, update the editor
  // model only if it actually differs from what the editor currently contains.
  // This prevents cursor jumps caused by the parent re-rendering with the same
  // value the user just typed.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    if (model.getValue() !== content) {
      const position = editor.getPosition();
      const selections = editor.getSelections();
      model.setValue(content);
      if (position) editor.setPosition(position);
      if (selections) editor.setSelections(selections);
    }
  }, [content]);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Ensure the newly mounted editor has the latest content in case the
    // component was remounted while content changed without triggering the
    // content-sync effect (editorRef.current was null at that point).
    const model = editor.getModel();
    if (model && model.getValue() !== content) {
      model.setValue(content);
    }
    // Subscribe to content changes to refresh undo/redo availability
    contentListenerRef.current?.dispose?.();
    contentListenerRef.current = editor.onDidChangeModelContent(() => {
      updateUndoRedoState();
    });
    updateUndoRedoState();

    // Register Ctrl+Enter to trigger a full rebuild
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRebuildRef.current?.();
    });

    // Register Ctrl+S to save (and rebuild if a rebuild handler is set)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });

    completionProviderRef.current?.dispose?.();
    completionProviderRef.current =
      sourceFormat === "pretext"
        ? registerCodeEditorCompletions(monaco)
        : null;
  };

  /**
   * Reads the Monaco model's undo/redo availability and updates state.
   * Falls back to enabling both buttons whenever an editor instance exists,
   * because some Monaco builds don't expose `canUndo`/`canRedo` on the model.
   */
  const updateUndoRedoState = () => {
    const model = editorRef.current?.getModel?.();
    if (
      model &&
      typeof (model as any).canUndo === "function" &&
      typeof (model as any).canRedo === "function"
    ) {
      try {
        setCanUndo((model as any).canUndo());
        setCanRedo((model as any).canRedo());
        return;
      } catch {
        // fall through to default
      }
    }
    // Fallback: enable buttons when editor exists
    const hasEditor = !!editorRef.current;
    setCanUndo(hasEditor);
    setCanRedo(hasEditor);
  };

  const handleContentChange = (newContent: string) => {
    onChange(newContent);
  };

  const handleUndo = () => {
    editorRef.current?.trigger("", "undo");
    updateUndoRedoState();
  };

  const handleRedo = () => {
    editorRef.current?.trigger("", "redo");
    updateUndoRedoState();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <CodeEditorMenu
        content={content}
        sourceFormat={sourceFormat}
        onContentChange={handleContentChange}
        onOpenLatexImport={onOpenLatexImport}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onConvertToPretext={
          onOpenConvertToPretext
        }
        canConvertToPretext={canConvertToPretext}
      />
      <div style={{ flex: 1 }}>
        <Editor
          options={options}
          height="100%"
          language={sourceFormat === "latex" ? "latex" : "xml"}
          defaultValue={content}
          onMount={handleEditorMount}
          onChange={(value) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              handleContentChange(value || "");
            }, 500);
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
