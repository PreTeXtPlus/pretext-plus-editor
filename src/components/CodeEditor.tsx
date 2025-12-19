import { Editor } from '@monaco-editor/react';
import { useState, useRef } from 'react';
import type { Monaco } from '@monaco-editor/react';
import CodeEditorMenu from './CodeEditorMenu';

interface CodeEditorProps {
    content: string;
    onChange: (value: string | undefined) => void;
}

let options = {
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on' as const,
    insertSpaces: true,
    tabSize: 2,
    padding: { top: 10, bottom: 10 },
}

const CodeEditor = ({ content, onChange }: CodeEditorProps) => {
    const editorRef = useRef<any>(null);
    const contentListenerRef = useRef<{ dispose: () => void } | null>(null);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const handleEditorMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        // Subscribe to content changes to refresh undo/redo availability
        contentListenerRef.current?.dispose?.();
        contentListenerRef.current = editor.onDidChangeModelContent(() => {
            updateUndoRedoState();
        });
        updateUndoRedoState();
    };

    const updateUndoRedoState = () => {
        const model = editorRef.current?.getModel?.();
        if (model && typeof (model as any).canUndo === 'function' && typeof (model as any).canRedo === 'function') {
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

    const handleUndo = () => {
        if (editorRef.current) {
            editorRef.current.trigger('keyboard', 'undo', null);
            updateUndoRedoState();
        }
    };

    const handleRedo = () => {
        if (editorRef.current) {
            editorRef.current.trigger('keyboard', 'redo', null);
            updateUndoRedoState();
        }
    };

    const handleContentChange = (newContent: string) => {
        onChange(newContent);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <CodeEditorMenu
                content={content}
                onContentChange={handleContentChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
            />
            <div style={{ flex: 1, width: '100%' }}>
                <Editor
                    options={options}
                    width="100%"
                    height="100%"
                    theme="vs-dark"
                    language="xml"
                    value={content}
                    onMount={handleEditorMount}
                    onChange={(value) => {
                        if (value !== content) {
                            onChange(value || '');
                        }
                    }}
                />
            </div>
        </div>
    )
}

export default CodeEditor;
