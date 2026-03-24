import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useRef, useState, type ReactNode } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview, { type FullPreviewHandle } from "./FullPreview";
import MenuBar from "./MenuBar";
import "./Editors.css";

import { derivePretextContent } from "../contentConversion";
import { defaultContent } from "../defaultContent";
import type {
  EditorContentChange,
  EditorContentState,
  SourceFormat,
} from "../types/editor";

const startingContent = defaultContent;

export interface editorProps {
  content: string;
  sourceFormat?: SourceFormat;
  pretextContent?: string;
  onContentChange: (
    value: string | undefined,
    meta?: EditorContentChange,
  ) => void;
  title?: string;
  onTitleChange?: (value: string) => void;
  onSaveButton?: () => void;
  saveButtonLabel?: string;
  onCancelButton?: () => void;
  cancelButtonLabel?: string;
  onSave?: () => void;
  onPreviewRebuild?: (
    content: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

const createEditorContentState = ({
  content,
  sourceFormat,
  pretextContent,
}: Pick<
  editorProps,
  "content" | "sourceFormat" | "pretextContent"
>): EditorContentState => {
  const sourceContent = content || startingContent;
  const resolvedSourceFormat = sourceFormat ?? "pretext";
  const derivedPretext =
    resolvedSourceFormat === "pretext"
      ? { pretextContent: sourceContent, pretextError: undefined }
      : pretextContent !== undefined
        ? { pretextContent, pretextError: undefined }
        : derivePretextContent(sourceContent, resolvedSourceFormat);
  return {
    sourceContent,
    sourceFormat: resolvedSourceFormat,
    ...derivedPretext,
  };
};

const Editors = (props: editorProps) => {
  //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
  const contentState: EditorContentState = createEditorContentState(props);
  const [internalTitle, setInternalTitle] = useState(props.title || "Document Title");
  const title = props.title ?? internalTitle;
  const [showFull, setShowFull] = useState(true);
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth < 800);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const editorTabId = "pretext-plus-tab-editor";
  const previewTabId = "pretext-plus-tab-preview";
  const tabPanelId = "pretext-plus-tabpanel";
  const fullPreviewRef = useRef<FullPreviewHandle>(null);
  const previewContent =
    contentState.pretextContent ??
    (contentState.sourceFormat === "pretext"
      ? contentState.sourceContent
      : undefined);
  const previewUnavailable = contentState.pretextError !== undefined;

  const triggerRebuild = () => {
    fullPreviewRef.current?.rebuild();
  };

  const triggerSaveAndRebuild = () => {
    props.onSave?.();
    fullPreviewRef.current?.rebuild();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === "Enter" && props.onPreviewRebuild) {
      e.preventDefault();
      triggerRebuild();
    } else if (isCtrl && e.key === "s") {
      e.preventDefault();
      triggerSaveAndRebuild();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const updateContentState = (sourceContent: string | undefined) => {
    const normalizedSourceContent = sourceContent || "";
    const derivedPretext =
      contentState.sourceFormat === "pretext"
        ? { pretextContent: normalizedSourceContent, pretextError: undefined }
        : derivePretextContent(
            normalizedSourceContent,
            contentState.sourceFormat,
          );
    const nextState: EditorContentState = {
      sourceContent: normalizedSourceContent,
      sourceFormat: contentState.sourceFormat,
      ...derivedPretext,
    };
    props.onContentChange(normalizedSourceContent, nextState);
  };

  const handleConvertToPretext = () => {
    if (contentState.pretextError) {
      return;
    }
    const convertedPretext = contentState.pretextContent || "";
    const nextState: EditorContentState = {
      sourceContent: convertedPretext,
      sourceFormat: "pretext",
      pretextContent: convertedPretext,
      pretextError: undefined,
    };
    props.onContentChange(convertedPretext, nextState);
  };

  const codeEditor = (
    <CodeEditor
      content={contentState.sourceContent}
      sourceFormat={contentState.sourceFormat}
      onChange={updateContentState}
      onRebuild={props.onPreviewRebuild ? triggerRebuild : undefined}
      onSave={triggerSaveAndRebuild}
    />
  );
  // `preview` will either be the visual editor or the full preview based on `showFull`
  let preview: ReactNode;
  if (previewUnavailable) {
    preview = (
      <div className="pretext-plus-editor__preview-placeholder">
        <p className="pretext-plus-editor__preview-placeholder-title">
          Preview unavailable
        </p>
        <p>
          {contentState.pretextError ||
            "Could not generate PreTeXt preview content."}
        </p>
      </div>
    );
  } else if (showFull && props.onPreviewRebuild) {
    preview = (
      <FullPreview
        ref={fullPreviewRef}
        content={previewContent || ""}
        title={title}
        onRebuild={props.onPreviewRebuild}
      />
    );
  } else {
    preview = (
      <VisualEditor
        content={previewContent || ""}
        canEdit={contentState.sourceFormat === "pretext"}
        editDisabledReason="Convert this LaTeX source to PreTeXt before enabling visual editing."
        onChange={(content) => {
          updateContentState(content);
        }}
      />
    );
  }

  let editorDisplays: ReactNode;
  if (isNarrowScreen) {
    editorDisplays = (
      <div className="pretext-plus-editor__tabs">
        <div className="pretext-plus-editor__tab-list" role="tablist">
          <button
            type="button"
            id={editorTabId}
            role="tab"
            aria-controls={tabPanelId}
            aria-selected={activeTab === "editor"}
            tabIndex={activeTab === "editor" ? 0 : -1}
            className={`pretext-plus-editor__tab-button ${
              activeTab === "editor" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            id={previewTabId}
            role="tab"
            aria-controls={tabPanelId}
            aria-selected={activeTab === "preview"}
            tabIndex={activeTab === "preview" ? 0 : -1}
            className={`pretext-plus-editor__tab-button ${
              activeTab === "preview" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("preview")}
          >
            Preview
          </button>
        </div>
        <div
          id={tabPanelId}
          className="pretext-plus-editor__tab-panel"
          role="tabpanel"
          aria-labelledby={activeTab === "editor" ? editorTabId : previewTabId}
        >
          <div style={{ height: "60vh" }}>
            {activeTab === "editor" ? codeEditor : preview}
          </div>
        </div>
      </div>
    );
  } else {
    editorDisplays = (
      <Group orientation="horizontal" className="pretext-plus-editor__splitter">
        <Panel className="pretext-plus-editor__editor-panel">
          {codeEditor}
        </Panel>
        <Separator className="pretext-plus-editor__resize-handle">
          <div className="pretext-plus-editor__resize-dots"></div>
        </Separator>
        <Panel className="pretext-plus-editor__preview-panel">{preview}</Panel>
      </Group>
    );
  }

  return (
    <div className="pretext-plus-editor" onKeyDown={handleKeyDown}>
      <MenuBar
        isChecked={showFull}
        onChange={() => setShowFull(!showFull)}
        title={title}
        sourceFormat={contentState.sourceFormat}
        onConvertToPretext={
          contentState.sourceFormat === "latex"
            ? handleConvertToPretext
            : undefined
        }
        canConvertToPretext={contentState.pretextError === undefined}
        onTitleChange={(value) => {
          setInternalTitle(value);
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
