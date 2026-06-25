import { Editor } from "@monaco-editor/react";
import { constrainedEditor } from "constrained-editor-plugin";
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { editorConfigs } from "./editorConfigs";
import CodeEditorMenu from "./CodeEditorMenu";
import type { SourceFormat } from "../types/editor";
import "./CodeEditor.css";

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
  /** Called when the user clicks "Edit Macros" in the toolbar. */
  onOpenDocinfoEditor: () => void;
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
  /** If provided, an "Assets" button is shown in the toolbar (PreTeXt mode only). */
  onOpenAssets?: () => void;
  /** Called when the user clicks "Display Full Source" to open the assembled-source modal. */
  onShowFullSource: () => void;
  /**
   * Called when the user double-clicks the locked wrapper's first line (the
   * opening tag). Hosts use this to open the division's properties editor in
   * the Table of Contents, since the tag/xml:id aren't editable in-place.
   */
  onRequestWrapperEdit?: () => void;
}

/** Imperative handle exposed via `forwardRef` for programmatic control. */
export interface CodeEditorHandle {
  /** Insert `text` at the current cursor position (or replace the selection). */
  insertAtCursor: (text: string) => void;
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
 *
 * Exposes a {@link CodeEditorHandle} via `forwardRef` for programmatic control.
 */
const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({
  content,
  sourceFormat,
  onChange,
  onRebuild,
  onSave,
  onOpenLatexImport,
  onOpenDocinfoEditor,
  onOpenConvertToPretext,
  canConvertToPretext,
  onOpenAssets,
  onShowFullSource,
  onRequestWrapperEdit,
}, ref) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const constrainedRef = useRef<ReturnType<typeof constrainedEditor> | null>(null);
  const lockedDecorationsRef = useRef<any>(null);
  const lockedRef = useRef(false);
  const contentListenerRef = useRef<{ dispose: () => void } | null>(null);
  const mouseListenerRef = useRef<{ dispose: () => void } | null>(null);
  const onRequestWrapperEditRef = useRef(onRequestWrapperEdit);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticUpdateRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const onRebuildRef = useRef(onRebuild);
  const onSaveRef = useRef(onSave);

  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      if (!selection) return;
      editor.executeEdits("insert-asset", [
        { range: selection, text, forceMoveMarkers: true },
      ]);
      editor.focus();
    },
  }), []);

  useEffect(() => {
    onRebuildRef.current = onRebuild;
  }, [onRebuild]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onRequestWrapperEditRef.current = onRequestWrapperEdit;
  }, [onRequestWrapperEdit]);
  // const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    completionProviderRef.current?.dispose?.();
    const config = editorConfigs[sourceFormat];
    completionProviderRef.current =
      monacoRef.current
        ? (config.registerMonacoExtensions?.(monacoRef.current) ?? null)
        : null;
    // Switching format toggles whether the wrapper is locked (PreTeXt only).
    applyConstraints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFormat]);

  useEffect(() => {
    return () => {
      contentListenerRef.current?.dispose?.();
      completionProviderRef.current?.dispose?.();
      mouseListenerRef.current?.dispose?.();
      constrainedRef.current?.disposeConstrainer?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Lock the division wrapper so its tag/xml:id can't be edited in the code
  // editor: only the body (lines 2 .. n-1) stays editable. xml:id and type are
  // structural identity and are edited from the Table of Contents instead.
  // Recomputed whenever the content or source format changes. Only PreTeXt
  // divisions have a wrapper to protect, and only when it occupies its own
  // first/last lines with a body in between.
  const applyConstraints = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const instance = constrainedRef.current;
    if (!editor || !monaco || !instance) return;
    const model = editor.getModel();
    if (!model) return;

    // Start clean — the previous restrictions reference stale line numbers.
    if (typeof model.disposeRestrictions === "function") {
      model.disposeRestrictions();
    }

    const lineCount = model.getLineCount();
    const lockable = sourceFormat === "pretext" && lineCount >= 3;
    lockedRef.current = lockable;

    if (lockable) {
      instance.addRestrictionsTo(model, [
        {
          range: [2, 1, lineCount - 1, model.getLineMaxColumn(lineCount - 1)],
          allowMultiline: true,
        },
      ]);
    }

    // Cosmetic: dim the locked first/last lines so they read as structural.
    if (typeof editor.createDecorationsCollection === "function") {
      if (!lockedDecorationsRef.current) {
        lockedDecorationsRef.current = editor.createDecorationsCollection();
      }
      if (!lockable) {
        lockedDecorationsRef.current.clear();
      } else {
        const hoverMessage = {
          value:
            "The wrapper tag and xml:id are structural — edit them from the Table of Contents.",
        };
        // `className` + `isWholeLine` paints a full-width tint *behind* the text;
        // `inlineClassName` is merged onto the token spans themselves so we can
        // recolor them. The latter only applies to the decoration's range, so
        // each range must span the whole line's text (col 1 → last column).
        const lockedLineOptions = {
          isWholeLine: true,
          className: "pretext-plus-editor__locked-line",
          inlineClassName: "pretext-plus-editor__locked-line-text",
          hoverMessage,
        };
        lockedDecorationsRef.current.set([
          {
            range: new monaco.Range(1, 1, 1, model.getLineMaxColumn(1)),
            options: lockedLineOptions,
          },
          {
            range: new monaco.Range(
              lineCount,
              1,
              lineCount,
              model.getLineMaxColumn(lineCount),
            ),
            options: lockedLineOptions,
          },
        ]);
      }
    }
  };

  const setModelValueSafely = (model: any, nextValue: string) => {
    if (model.getValue() === nextValue) return;
    isProgrammaticUpdateRef.current = true;
    // Restrictions must be removed before a programmatic full-document setValue,
    // or the plugin reverts it as an edit to the locked ranges. They're
    // re-applied (against the new line count) immediately after.
    if (typeof model.disposeRestrictions === "function") {
      model.disposeRestrictions();
    }
    model.setValue(nextValue);
    applyConstraints();
    queueMicrotask(() => {
      isProgrammaticUpdateRef.current = false;
    });
  };

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
      setModelValueSafely(model, content);
      if (position) editor.setPosition(position);
      if (selections) editor.setSelections(selections);
    }
  }, [content]);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Wire up the constrained-editor instance once per mount; restrictions
    // themselves are (re)applied by applyConstraints below and on every sync.
    constrainedRef.current = constrainedEditor(monaco);
    constrainedRef.current.initializeIn(editor);
    // Ensure the newly mounted editor has the latest content in case the
    // component was remounted while content changed without triggering the
    // content-sync effect (editorRef.current was null at that point).
    const model = editor.getModel();
    if (model && model.getValue() !== content) {
      setModelValueSafely(model, content);
    }
    // Subscribe to content changes to refresh undo/redo availability
    contentListenerRef.current?.dispose?.();
    contentListenerRef.current = editor.onDidChangeModelContent(() => {
      updateUndoRedoState();
    });
    updateUndoRedoState();

    // Double-clicking the locked wrapper's first line (the opening tag) opens
    // the division's properties editor in the TOC, since the tag/xml:id can't
    // be edited in place. `event.detail === 2` marks the dblclick mousedown.
    mouseListenerRef.current?.dispose?.();
    mouseListenerRef.current = editor.onMouseDown((e: any) => {
      if (
        lockedRef.current &&
        e?.event?.detail === 2 &&
        e?.target?.position?.lineNumber === 1
      ) {
        onRequestWrapperEditRef.current?.();
      }
    });

    // Register Ctrl+Enter to trigger a full rebuild
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRebuildRef.current?.();
    });

    // Register Ctrl+S to save (and rebuild if a rebuild handler is set)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });

    completionProviderRef.current?.dispose?.();
    const config = editorConfigs[sourceFormat];
    completionProviderRef.current = config.registerMonacoExtensions?.(monaco) ?? null;

    applyConstraints();
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
        onOpenDocinfoEditor={onOpenDocinfoEditor}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onConvertToPretext={onOpenConvertToPretext}
        canConvertToPretext={canConvertToPretext}
        onOpenAssets={onOpenAssets}
        onShowFullSource={onShowFullSource}
      />
      <div style={{ flex: 1 }}>
        <Editor
          options={options}
          height="100%"
          language={editorConfigs[sourceFormat].language}
          defaultValue={content}
          onMount={handleEditorMount}
          onChange={(value, event) => {
            if (event?.isFlush || isProgrammaticUpdateRef.current) {
              return;
            }
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              handleContentChange(value || "");
            }, 500);
          }}
        />
      </div>
    </div>
  );
});

CodeEditor.displayName = "CodeEditor";

export default CodeEditor;
