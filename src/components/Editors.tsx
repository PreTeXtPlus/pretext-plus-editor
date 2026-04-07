import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import FullPreview, { type FullPreviewHandle } from "./FullPreview";
import LatexImportDialog from "./LatexImportDialog";
import ConvertToPretextDialog from "./ConvertToPretextDialog";
import DocinfoEditor from "./DocinfoEditor";
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
  /** The source content string (PreTeXt XML or LaTeX). */
  source: string;
  /**
   * The format of `source`.  Defaults to `"pretext"` when omitted.
   * When set to `"latex"`, the editor displays a LaTeX code editor and
   * derives a read-only PreTeXt preview via conversion.
   */
  sourceFormat?: SourceFormat;
  /**
   * Pre-computed PreTeXt XML corresponding to `source`.
   * Providing this avoids running the conversion on first render when the
   * host already has a cached result.  Only meaningful when
   * `sourceFormat` is not `"pretext"`.
   */
  pretextSource?: string;
  /**
   * The docinfo element for a pretext document, which can contain macros and similar
   * document wide information.
   */
  docinfo?: string;
  /**
   * Called whenever the source content changes (user edits in the code
   * editor or WYSIWYG editor).
   *
   * @param value - The new source string (`undefined` is passed by Monaco on
   *   certain edge cases; treat it as an empty string).
   * @param meta - The full derived {@link EditorContentChange} state at the
   *   time of the change, including the converted PreTeXt and any error.
   */
  onContentChange: (
    value: string | undefined,
    meta?: EditorContentChange,
  ) => void;
  /** Document title shown in the menu bar title field. */
  title?: string;
  /** Called when the user edits the title field. */
  onTitleChange?: (value: string) => void;
  /** If provided, a Save button is rendered in the menu bar. */
  onSaveButton?: () => void;
  /** Label for the Save button.  Defaults to `"Save"`. */
  saveButtonLabel?: string;
  /** If provided, a Cancel button is rendered in the menu bar. */
  onCancelButton?: () => void;
  /** Label for the Cancel button.  Defaults to `"Cancel"`. */
  cancelButtonLabel?: string;
  /**
   * If provided, `onSave` is called on Ctrl+S in addition to `onSaveButton`.
   * Useful when the host wants a keyboard shortcut to trigger saving without
   * necessarily showing an explicit Save button.
   */
  onSave?: () => void;
  /**
   * If provided, the right-hand panel shows a full iframe-based preview
   * instead of the Tiptap visual editor, and a rebuild button / Ctrl+Enter
   * shortcut become active.
   *
   * @param source - The current PreTeXt XML to render.
   * @param title - The current document title.
   * @param postToIframe - Helper to post a message into the preview iframe.
   */
  onPreviewRebuild?: (
    source: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

/**
 * Builds the initial {@link EditorContentState} from the props passed to
 * {@link Editors}.  Runs once per render cycle via `useMemo`.
 *
 * If the source is already PreTeXt, `pretextSource` mirrors `sourceContent`
 * with no conversion.  For other formats the function either uses the
 * caller-supplied `pretextSource` (avoiding redundant work) or runs the
 * conversion via {@link derivePretextContent}.
 */
const createEditorContentState = ({
  source: source,
  sourceFormat,
  pretextSource: pretextSource,
}: Pick<
  editorProps,
  "source" | "sourceFormat" | "pretextSource"
>): EditorContentState => {
  const sourceContent = source ?? startingContent;
  const resolvedSourceFormat = sourceFormat ?? "pretext";
  const derivedPretext =
    resolvedSourceFormat === "pretext"
      ? { pretextSource: sourceContent, pretextError: undefined }
      : pretextSource !== undefined
      ? { pretextSource, pretextError: undefined }
      : derivePretextContent(sourceContent, resolvedSourceFormat);
  return {
    sourceContent,
    sourceFormat: resolvedSourceFormat,
    ...derivedPretext,
  };
};

/**
 * Top-level editor component that wires together the Monaco code editor and
 * the right-hand preview panel (either Tiptap visual editor or full iframe
 * preview).  Also owns the menu bar and responsive layout logic.
 *
 * Content state is derived from props on every render via `useMemo` so the
 * parent always controls the source of truth; the component itself holds no
 * long-lived content state.
 */
const Editors = (props: editorProps) => {
  //Content state belongs to the "editors" pair, and it is passed down to the two editors as props.
  const { source: source, sourceFormat, pretextSource: pretextSource } = props;
  const contentState: EditorContentState = useMemo(
    () =>
      createEditorContentState({
        source: source,
        sourceFormat,
        pretextSource: pretextSource,
      }),
    [source, sourceFormat, pretextSource],
  );
  const [internalTitle, setInternalTitle] = useState(
    props.title || "Document Title",
  );
  const title = props.title ?? internalTitle;
  const [showFull, setShowFull] = useState(true);
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth < 800);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [isLatexDialogOpen, setIsLatexDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isDocinfoEditorOpen, setIsDocinfoEditorOpen] = useState(false);
  const [internalDocinfo, setInternalDocinfo] = useState(props.docinfo ?? "");
  const editorTabId = "pretext-plus-tab-editor";
  const previewTabId = "pretext-plus-tab-preview";
  const tabPanelId = "pretext-plus-tabpanel";
  const fullPreviewRef = useRef<FullPreviewHandle>(null);
  const previewContent =
    contentState.pretextSource ??
    (contentState.sourceFormat === "pretext"
      ? contentState.sourceContent
      : undefined);
  const previewUnavailable = contentState.pretextError !== undefined;

  /** Triggers a full-page preview rebuild without saving. */
  const triggerRebuild = () => {
    fullPreviewRef.current?.rebuild();
  };

  /** Calls the host's `onSave` callback then triggers a preview rebuild. */
  const triggerSaveAndRebuild = () => {
    props.onSave?.();
    fullPreviewRef.current?.rebuild();
  };

  /**
   * Keyboard shortcuts captured at the root editor div:
   * - Ctrl/Cmd+Enter → rebuild preview (when `onPreviewRebuild` is set).
   * - Ctrl/Cmd+S     → save and rebuild.
   */
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

  /**
   * Called by either sub-editor when the user changes the source content.
   * Re-derives the PreTeXt content (or records an error) then propagates the
   * full state snapshot to the host via `onContentChange`.
   *
   * @param sourceContent - The new raw source string from the editor.
   */
  const updateContentState = (sourceContent: string | undefined) => {
    const normalizedSourceContent = sourceContent || "";
    const derivedPretext =
      contentState.sourceFormat === "pretext"
        ? { pretextSource: normalizedSourceContent, pretextError: undefined }
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

  /**
   * Promotes the derived PreTeXt content to be the new canonical source,
   * switching `sourceFormat` to `"pretext"`.  Only callable when conversion
   * has succeeded (i.e. `pretextError` is undefined).
   */
  const handleConvertToPretext = () => {
    if (contentState.pretextError) {
      return;
    }
    const convertedPretext = contentState.pretextSource || "";
    const nextState: EditorContentState = {
      sourceContent: convertedPretext,
      sourceFormat: "pretext",
      pretextSource: convertedPretext,
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
      onOpenLatexImport={() => setIsLatexDialogOpen(true)}
      onOpenDocinfoEditor={() => setIsDocinfoEditorOpen(true)}
      onOpenConvertToPretext={
        contentState.sourceFormat === "latex"
          ? () => setIsConvertDialogOpen(true)
          : undefined
      }
      canConvertToPretext={contentState.pretextError === undefined}
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
        editDisabledReason=""
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
          <div style={{ height: "100%" }}>
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
      <div className="pretext-plus-editor__editor-displays">
        {editorDisplays}
        {isLatexDialogOpen ? (
          <LatexImportDialog onClose={() => setIsLatexDialogOpen(false)} />
        ) : null}
        {isConvertDialogOpen ? (
          <ConvertToPretextDialog
            latexSource={contentState.sourceContent}
            pretextSource={contentState.pretextSource ?? ""}
            onConfirm={handleConvertToPretext}
            onClose={() => setIsConvertDialogOpen(false)}
          />
        ) : null}
        {isDocinfoEditorOpen ? (
          <DocinfoEditor
            docinfo={props.docinfo ?? internalDocinfo}
            onClose={(value) => {
              setIsDocinfoEditorOpen(false);
              if (value !== undefined) {
                setInternalDocinfo(value);
                props.onContentChange(contentState.sourceContent, {
                  ...contentState,
                  docinfo: value,
                });
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Editors;
