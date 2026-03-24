import type { SourceFormat } from "../types/editor";
import "./MenuBar.css";

export interface MenuBarProps {
  isChecked: boolean;
  onChange: () => void;
  title?: string;
  sourceFormat?: SourceFormat;
  onConvertToPretext?: () => void;
  canConvertToPretext?: boolean;
  onTitleChange?: (value: string) => void;
  onSaveButton?: () => void;
  saveButtonLabel?: string;
  onCancelButton?: () => void;
  cancelButtonLabel?: string;
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
