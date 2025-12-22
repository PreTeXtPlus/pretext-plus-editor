import { Splitter, SplitterPanel } from "primereact/splitter";
import { useState } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview from "./FullPreview";
import Switcher from "./Switcher";

import { defaultContent } from '../defaultContent';

const startingContent = defaultContent;

const Editors = () => {
    //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
    const [content, setContent] = useState(startingContent)
    const [showFull, setShowFull] = useState(false);

    let preview;
    if (showFull) {
        preview = <FullPreview content={content} />
    } else {
        preview = (
            <VisualEditor
                content={content}
                onChange={( content ) => setContent(content || '')}
            />
        )
    }

    return (
        <div>
            <h1>PreTeXt Plus Editor</h1>
            <Switcher isChecked={showFull} onChange={() => setShowFull(!showFull)} />
            <Splitter style={{height: '80vh', width: '98vw'}}>
                <SplitterPanel className="flex">
                    <CodeEditor
                    content={content}
                    onChange={( content ) => setContent(content || '')}
                    />
                </SplitterPanel>
                <SplitterPanel className="flex">
                    {preview}
                </SplitterPanel>
            </Splitter>
        </div>
    )
}

export default Editors;
