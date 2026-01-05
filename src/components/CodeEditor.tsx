import { Editor } from '@monaco-editor/react';
import { useState, useRef, useEffect } from 'react';
//import type { Monaco } from '@monaco-editor/react';
//import CodeEditorMenu from './CodeEditorMenu';

interface CodeEditorProps {
    content: string;
    onChange: (value: string | undefined) => void;
}

const options = {
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
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [, setCanUndo] = useState(false);
    const [, setCanRedo] = useState(false);
    // const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        return () => {
            contentListenerRef.current?.dispose?.();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleEditorMount = (editor: any) => {
        editorRef.current = editor;
        // Subscribe to content changes to refresh undo/redo availability
        contentListenerRef.current?.dispose?.();
        contentListenerRef.current = editor.onDidChangeModelContent(() => {
            updateUndoRedoState();
        });
        // // Subscribe to focus/blur events
        // editor.onDidFocusEditorWidget(() => {
        //     console.log("Editor focused");
        //     setIsFocused(true);
        // });
        // editor.onDidBlurEditorWidget(() => {
        //     console.log("Editor blurred");
        //     setIsFocused(false);
        // });
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



    const handleContentChange = (newContent: string) => {
        onChange(newContent);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/*<CodeEditorMenu
                content={content}
                onContentChange={handleContentChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
            />*/}
            <div style={{ flex: 1, }}>
                <Editor
                    options={options}
                    height="100%"
                    language="xml"
                    value={content}
                    onMount={handleEditorMount}
                    onChange={(value) => {
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => {
                            handleContentChange(value || '');
                        }, 500);
                    }}
                />
            </div>
        </div>
    )
}

export default CodeEditor;
