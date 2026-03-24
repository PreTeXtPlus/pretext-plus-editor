import type { SourceFormat } from "../types/editor";
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
  /** Badge label indicating the source format (`"pretext"` or `"latex"`). */
  sourceFormat?: SourceFormat;
  /**
   * If provided, a "Convert to PreTeXt" button is shown.
   * Called when the user clicks that button to promote the derived PreTeXt
   * to the canonical source.
   */
  onConvertToPretext?: () => void;
  /**
   * Controls whether the "Convert to PreTeXt" button is enabled.
   * Should be `false` when conversion has failed (i.e. a `pretextError` exists).
   */
  canConvertToPretext?: boolean;
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
        <span className="pretext-plus-editor__source-badge">
          Source: {props.sourceFormat === "latex" ? "LaTeX" : "PreTeXt"}
        </span>
      </div>
      <div className="pretext-plus-editor__menu-right">
        {props.onConvertToPretext && (
          <button
            className="pretext-plus-editor__button pretext-plus-editor__button--convert"
            onClick={props.onConvertToPretext}
            disabled={props.canConvertToPretext === false}
            title="Promote the current derived PreTeXt into the canonical source"
          >
            Convert to PreTeXt
          </button>
        )}
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
