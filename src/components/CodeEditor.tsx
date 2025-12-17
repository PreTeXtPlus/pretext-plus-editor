import { Editor } from '@monaco-editor/react';


interface CodeEditorProps {
    content: string;
    onChange: (value: string | undefined) => void;
}

const CodeEditor = ({ content, onChange }: CodeEditorProps) => {
 return (
    <>
        <Editor
            options={{
                automaticLayout: true
            }}
            width="98%"
            height="98%"
            theme="vs-dark"
            language="xml"
            value={content}
            onChange={(value) => {
                if (value !== content) {
                    onChange(value || '');
                }
            }}
        />
    </>
 )
}

export default CodeEditor;
