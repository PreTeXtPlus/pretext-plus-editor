import { TabView, TabPanel } from "primereact/tabview";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useEffect, useState } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview from "./FullPreview";
import MenuBar from "./MenuBar";
import "./Editors.css";

import { defaultContent } from "../defaultContent";

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
  onPreviewRebuild?: (
    content: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

const Editors = (props: editorProps) => {
  //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
  const [content, setContent] = useState(props.content || startingContent);
  const [title, setTitle] = useState(props.title || "Document Title");
  const [showFull, setShowFull] = useState(true);
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth < 800);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const codeEditor = (
    <CodeEditor
      content={content}
      onChange={(content) => {
        setContent(content || "");
        props.onContentChange(content);
      }}
    />
  );
  // `preview` will either be the visual editor or the full preview based on `showFull`
  let preview;
  if (showFull && props.onPreviewRebuild) {
    preview = (
      <FullPreview
        content={content}
        title={title}
        onRebuild={props.onPreviewRebuild}
      />
    );
  } else {
    preview = (
      <VisualEditor
        content={content}
        onChange={(content) => {
          setContent(content || "");
          props.onContentChange(content);
        }}
      />
    );
  }

  let editorDisplays;
  if (isNarrowScreen) {
    editorDisplays = (
      <TabView>
        <TabPanel header="Editor">
          <div style={{ height: "60vh" }}>{codeEditor}</div>
        </TabPanel>
        <TabPanel header="Preview">
          <div style={{ height: "60vh" }}>{preview}</div>
        </TabPanel>
      </TabView>
    );
  } else {
    editorDisplays = (
      <PanelGroup
        direction="horizontal"
        className="pretext-plus-editor__splitter"
      >
        <Panel className="pretext-plus-editor__editor-panel">
          {codeEditor}
        </Panel>
        <PanelResizeHandle className="pretext-plus-editor__resize-handle">
          <div className="pretext-plus-editor__resize-dots"></div>
        </PanelResizeHandle>
        <Panel className="pretext-plus-editor__preview-panel">{preview}</Panel>
      </PanelGroup>
    );
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
      {editorDisplays}
    </div>
  );
};

export default Editors;
