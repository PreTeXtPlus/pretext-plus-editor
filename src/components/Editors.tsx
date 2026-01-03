import { Splitter, SplitterPanel } from "primereact/splitter";
import { useState, useRef } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview from "./FullPreview";
import MenuBar from "./MenuBar";
import './Editors.css';

import { defaultContent } from '../defaultContent';

const startingContent = defaultContent;

export interface editorProps {
    content: string;
    onContentChange: (value: string | undefined) => void;
    title?: string;
    onTitleChange?: (value: string) => void;
    onSaveButton?: () => void;
    saveButtonLabel?: string;
    onCancelButton?: () => void;
    cancelButtonLabel?: string;
    onPreviewRebuild?: (content: string, title: string, postToIframe: (url: string, data: any) => void) => void;
}

const Editors = (props: editorProps) => {
    //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
    const [content, setContent] = useState(props.content || startingContent);
    const [title, setTitle] = useState(props.title || "Document Title");
    const [showFull, setShowFull] = useState(false);

    // `preview` will either be the visual editor or the full preview based on `showFull`
    let preview;
    if (showFull && props.onPreviewRebuild) {
        preview = <FullPreview
            content={content}
            title={title}
            onRebuild={props.onPreviewRebuild}
        />
    } else {
        preview = (
            <VisualEditor
                content={content}
                onChange={( content ) => {
                    setContent(content || '');
                    props.onContentChange(content);
                }}
            />
        )
    }

    return (
        <div className="pretext-plus-editor">
            <MenuBar
                isChecked={showFull}
                onChange={() => setShowFull(!showFull)}
                title={title}
                onTitleChange={(value) => {
                    setTitle(value);
                    props.onTitleChange?.(value);
                }}
                onSaveButton={props.onSaveButton}
                saveButtonLabel={props.saveButtonLabel}
                onCancelButton={props.onCancelButton}
                cancelButtonLabel={props.cancelButtonLabel}
                showPreviewModeToggle={props.onPreviewRebuild !== undefined}
            />
            <Splitter className="pretext-plus-editor__splitter">
                <SplitterPanel className="pretext-plus-editor__editor-panel">
                    <CodeEditor
                    content={content}
                    onChange={( content ) => {
                        setContent(content || '');
                        props.onContentChange(content);
                    }}
                    />
                </SplitterPanel>
                <SplitterPanel className="pretext-plus-editor__preview-panel">
                    {preview}
                </SplitterPanel>
            </Splitter>
        </div>
    )
}

export default Editors;
