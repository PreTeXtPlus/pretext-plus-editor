import { Splitter, SplitterPanel } from "primereact/splitter";
import { useState } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview from "./FullPreview";
import Switcher from "./Switcher";

import { defaultContent } from '../defaultContent';

const startingContent = defaultContent;

export interface editorProps {
    // You can add props here if needed in the future
    content: string;
    onContentChange: (value: string | undefined) => void;
    title?: string;
    onTitleChange?: (value: string) => void;
    onSaveButton?: () => void;
    saveButtonLabel?: string;
    onCancelButton?: () => void;
    cancelButtonLabel?: string;
}

const Editors = (props: editorProps) => {
    //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
    const [content, setContent] = useState(props.content || startingContent);
    const [title, setTitle] = useState(props.title || "Document Title");
    const [showFull, setShowFull] = useState(false);

    // `preview` will either be the visual editor or the full preview based on `showFull`
    let preview;
    if (showFull) {
        preview = <FullPreview content={content} />
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
        <div>
            Title: <input type="text" value={title} onChange={(e) => {
                setTitle(e.target.value);
                props.onTitleChange?.(e.target.value);
            }} />
            <Switcher isChecked={showFull} onChange={() => setShowFull(!showFull)} />
            {props.onSaveButton && (
                <button onClick={props.onSaveButton}>{props.saveButtonLabel || 'Save'}</button>
            )}
            {props.onCancelButton && (
                <button onClick={props.onCancelButton}>{props.cancelButtonLabel || 'Cancel'}</button>
            )}
            <Splitter style={{height: '80vh', width: '98vw'}}>
                <SplitterPanel className="flex">
                    <CodeEditor
                    content={content}
                    onChange={( content ) => {
                        setContent(content || '');
                        props.onContentChange(content);
                    }}
                    />
                </SplitterPanel>
                <SplitterPanel className="flex">
                    {preview}
                </SplitterPanel>
            </Splitter>
            {/* A text area to communicate with the database */}
            <textarea value={content} readOnly style={{display: 'none', width: '98vw', height: '20vh', marginTop: '10px'}}></textarea>
        </div>
    )
}

export default Editors;
