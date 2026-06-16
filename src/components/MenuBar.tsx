import { useEditorStore } from "../store/hooks";
import StoreFeedbackLink from "./StoreFeedbackLink";
import "./MenuBar.css";

export interface MenuBarProps {
  /** If provided, a Save button is rendered. */
  onSaveButton?: () => void;
  /** Label for the Save button.  Defaults to `"Save"`. */
  saveButtonLabel?: string;
  /** If provided, a Cancel button is rendered. */
  onCancelButton?: () => void;
  /** Label for the Cancel button.  Defaults to `"Cancel"`. */
  cancelButtonLabel?: string;
  /**
   * When `false`, the Simple/Full preview mode toggle is hidden entirely.
   * Defaults to showing the toggle.
   */
  showPreviewModeToggle?: boolean;
}

const MenuBar = (props: MenuBarProps) => {
  const showFullPreview = useEditorStore((s) => s.showFullPreview);
  const setShowFullPreview = useEditorStore((s) => s.setShowFullPreview);
  const title = useEditorStore((s) => s.title);
  const updateTitle = useEditorStore((s) => s.updateTitle);

  let previewModeToggle;
  if (props.showPreviewModeToggle === false) {
    previewModeToggle = null;
  } else {
    previewModeToggle = (
      <label className="pretext-plus-editor__preview-toggle">
        <input
          type="checkbox"
          checked={!showFullPreview}
          onChange={() => setShowFullPreview(!showFullPreview)}
          className="pretext-plus-editor__preview-toggle-input"
        />
        <div className="pretext-plus-editor__preview-toggle-container">
          <span className="pretext-plus-editor__preview-toggle-label">
            Simple
          </span>
          <span
            className={`pretext-plus-editor__preview-toggle-slider ${
              showFullPreview
                ? "pretext-plus-editor__preview-toggle-slider--active"
                : ""
            }`}
          >
            <span
              className={`pretext-plus-editor__preview-toggle-dot ${
                showFullPreview
                  ? "pretext-plus-editor__preview-toggle-dot--active"
                  : ""
              }`}
            ></span>
          </span>
          <span className="pretext-plus-editor__preview-toggle-label">
            Full
          </span>
        </div>
        <span className="pretext-plus-editor__preview-toggle-caption">
          Preview Mode
        </span>
        <input
          type="checkbox"
          checked={showFullPreview}
          onChange={() => setShowFullPreview(!showFullPreview)}
          className="pretext-plus-editor__preview-toggle-input"
        />
      </label>
    );
  }

  return (
    <div className="pretext-plus-editor__menu-bar">
      <div className="pretext-plus-editor__menu-left">
        <label className="pretext-plus-editor__title-label">
          Title{" "}
          <input
            className="pretext-plus-editor__title-input"
            type="text"
            value={title}
            onChange={(e) => updateTitle(e.target.value)}
          />
        </label>
      </div>
      <div className="pretext-plus-editor__menu-right">
        {props.onSaveButton && (
          <button
            className="pretext-plus-editor__button pretext-plus-editor__button--save"
            onClick={props.onSaveButton}
          >
            {props.saveButtonLabel || "Save"}
          </button>
        )}
        {props.onCancelButton && (
          <button
            className="pretext-plus-editor__button pretext-plus-editor__button--cancel"
            onClick={props.onCancelButton}
          >
            {props.cancelButtonLabel || "Cancel"}
          </button>
        )}
        <StoreFeedbackLink label="Give feedback" context="main-editor" />
        {previewModeToggle}
      </div>
    </div>
  );
};

export default MenuBar;
