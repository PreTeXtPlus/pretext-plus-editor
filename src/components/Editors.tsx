import { Splitter, SplitterPanel } from "primereact/splitter";
import { useState } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview from "./FullPreview";
import MenuBar from "./MenuBar";

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
}

const Editors = (props: editorProps) => {
    //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
    const [content, setContent] = useState(props.content || startingContent);
    const [title, setTitle] = useState(props.title || "Document Title");
    const [showFull, setShowFull] = useState(false);

    // `preview` will either be the visual editor or the full preview based on `showFull`
    let preview;
    if (showFull) {
        preview = <FullPreview content={content} title={title} />
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
            />
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
