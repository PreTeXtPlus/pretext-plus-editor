import "./MenuBar.css";

export interface MenuBarProps {
  /**
   * Whether the "Full" preview mode is active.
   * The toggle slider reflects `isChecked === true` → Full, `false` → Simple.
   */
  isChecked: boolean;
  /** Called when the user clicks the Simple/Full preview mode toggle. */
  onChange: () => void;
  /** Current document title shown in the editable title field. */
  title?: string;
  /** Called when the user changes the title field value. */
  onTitleChange?: (value: string) => void;
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
  let previewModeToggle;
  if (props.showPreviewModeToggle === false) {
    previewModeToggle = null;
  } else {
    previewModeToggle = (
      <label className="pretext-plus-editor__preview-toggle">
        <input
          type="checkbox"
          checked={!props.isChecked}
          onChange={props.onChange}
          className="pretext-plus-editor__preview-toggle-input"
        />
        <div className="pretext-plus-editor__preview-toggle-container">
          <span className="pretext-plus-editor__preview-toggle-label">
            Simple
          </span>
          <span
            className={`pretext-plus-editor__preview-toggle-slider ${
              props.isChecked
                ? "pretext-plus-editor__preview-toggle-slider--active"
                : ""
            }`}
          >
            <span
              className={`pretext-plus-editor__preview-toggle-dot ${
                props.isChecked
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
          checked={props.isChecked}
          onChange={props.onChange}
          className="pretext-plus-editor__preview-toggle-input"
        />
      </label>
    );
  }

  return (
    <div className="pretext-plus-editor__menu-bar">
      <div className="pretext-plus-editor__menu-left">
        {props.title !== undefined && props.onTitleChange && (
          <label className="pretext-plus-editor__title-label">
            Title{" "}
            <input
              className="pretext-plus-editor__title-input"
              type="text"
              value={props.title}
              onChange={(e) => props.onTitleChange?.(e.target.value)}
            />
          </label>
        )}
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
        {previewModeToggle}
      </div>
    </div>
  );
};

export default MenuBar;
