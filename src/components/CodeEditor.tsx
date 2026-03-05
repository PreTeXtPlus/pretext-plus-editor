import { Editor } from "@monaco-editor/react";
import { useState, useRef, useEffect } from "react";
import { registerCodeEditorCompletions } from "./codeEditorCompletions";
//import type { Monaco } from '@monaco-editor/react';
//import CodeEditorMenu from './CodeEditorMenu';

interface CodeEditorProps {
  content: string;
  onChange: (value: string | undefined) => void;
  onRebuild?: () => void;
  onSave?: () => void;
}

const options = {
  automaticLayout: true,
  minimap: { enabled: false },
  acceptSuggestionOnCommitCharacter: false,
  wordWrap: "on" as const,
  insertSpaces: true,
  tabSize: 2,
  padding: { top: 10, bottom: 10 },
};

const CodeEditor = ({ content, onChange, onRebuild, onSave }: CodeEditorProps) => {
  const editorRef = useRef<any>(null);
  const contentListenerRef = useRef<{ dispose: () => void } | null>(null);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setCanUndo] = useState(false);
  const [, setCanRedo] = useState(false);
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
    completionProviderRef.current = registerCodeEditorCompletions(monaco);
  };

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/*<CodeEditorMenu
                content={content}
                onContentChange={handleContentChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
            />*/}
      <div style={{ flex: 1 }}>
        <Editor
          options={options}
          height="100%"
          language="xml"
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
