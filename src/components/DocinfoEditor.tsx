import { useEffect, useState } from "react";
import { Editor } from "@monaco-editor/react";
import "./dialog.css";

interface DocinfoEditorProps {
  /** The current docinfo XML string (the full `<docinfo>` element or empty). */
  docinfo: string;
  /** Called on Save with the updated docinfo XML, or `undefined` on Cancel. */
  onClose: (value: string | undefined) => void;
}

type DocinfoTab = "macros" | "preamble" | "other";

const latexEditorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: "on" as const,
  lineNumbers: "on" as const,
  scrollBeyondLastLine: false,
  tabSize: 2,
  fontSize: 13,
  padding: { top: 10, bottom: 10 },
};

const xmlEditorOptions = {
  ...latexEditorOptions,
  language: "xml",
};

/** Returns the text content of the named element, or "" if absent. */
const extractTextElement = (doc: Document, tagName: string): string =>
  doc.querySelector(tagName)?.textContent ?? "";

/**
 * Serializes all child elements of `<docinfo>` whose tag names are not in
 * `exclude`, returning them as indented XML lines ready for display.
 */
const extractOtherElements = (doc: Document, exclude: string[]): string => {
  const serializer = new XMLSerializer();
  return Array.from(doc.documentElement.children)
    .filter((el) => !exclude.includes(el.tagName))
    .map((el) => serializer.serializeToString(el))
    .join("\n");
};

/** Parses a docinfo XML string and returns a DOM Document (or an empty docinfo). */
const parseDocinfo = (docinfo: string): Document => {
  if (!docinfo.trim()) {
    return new DOMParser().parseFromString("<docinfo/>", "application/xml");
  }
  return new DOMParser().parseFromString(docinfo, "application/xml");
};

/**
 * Rebuilds the full `<docinfo>` XML from the three editor regions.
 * Omits elements whose content is blank.
 */
const buildDocinfo = (
  macros: string,
  preamble: string,
  other: string,
): string => {
  const parts: string[] = [];
  if (macros.trim()) parts.push(`  <macros>${macros}</macros>`);
  if (preamble.trim())
    parts.push(`  <latex-image-preamble>${preamble}</latex-image-preamble>`);
  if (other.trim()) {
    for (const line of other.trim().split("\n")) {
      parts.push(`  ${line}`);
    }
  }
  if (parts.length === 0) return "";
  return `<docinfo>\n${parts.join("\n")}\n</docinfo>`;
};

const TAB_LABELS: Record<DocinfoTab, string> = {
  macros: "LaTeX Macros",
  preamble: "Image Macros",
  other: "Other Elements",
};

const TAB_DESCRIPTIONS: Record<DocinfoTab, string> = {
  macros:
    "LaTeX macros available throughout the document. Stored in <macros> inside <docinfo>. Use \\newcommand to define new macros (avoid using \\def).",
  preamble:
    "LaTeX macros for rendering TikZ/LaTeX images. Stored in <latex-image-preamble> inside <docinfo>.",
  other:
    "Any additional <docinfo> child elements (e.g. <cross-references>, <rename>). Edit as raw XML — one element per line.",
};

/**
 * Modal dialog for editing the PreTeXt `<docinfo>` section, with three tabs:
 * Macros, Image Preamble, and Other Elements.
 */
const DocinfoEditor = ({ docinfo, onClose }: DocinfoEditorProps) => {
  const [activeTab, setActiveTab] = useState<DocinfoTab>("macros");

  const doc = parseDocinfo(docinfo);
  const [macros, setMacros] = useState(() => extractTextElement(doc, "macros"));
  const [preamble, setPreamble] = useState(() =>
    extractTextElement(doc, "latex-image-preamble"),
  );
  const [other, setOther] = useState(() =>
    extractOtherElements(doc, ["macros", "latex-image-preamble"]),
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(undefined);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSave = () => {
    onClose(buildDocinfo(macros, preamble, other));
  };

  const currentValue =
    activeTab === "macros"
      ? macros
      : activeTab === "preamble"
      ? preamble
      : other;
  const currentLanguage = activeTab === "other" ? "xml" : "latex";
  const currentSetter =
    activeTab === "macros"
      ? setMacros
      : activeTab === "preamble"
      ? setPreamble
      : setOther;

  return (
    <div
      className="pretext-plus-editor__dialog-overlay"
      onClick={() => onClose(undefined)}
    >
      <div
        className="pretext-plus-editor__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pretext-plus-editor-docinfo-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pretext-plus-editor__dialog-header">
          <div>
            <h2
              id="pretext-plus-editor-docinfo-dialog-title"
              className="pretext-plus-editor__dialog-title"
            >
              Edit docinfo/preamble elements
            </h2>
            <p className="pretext-plus-editor__dialog-copy">
              {TAB_DESCRIPTIONS[activeTab]}
            </p>
          </div>
          <button
            type="button"
            className="pretext-plus-editor__dialog-close"
            onClick={() => onClose(undefined)}
            aria-label="Close docinfo editor"
          >
            Close
          </button>
        </div>

        <div className="pretext-plus-editor__dialog-tab-bar" role="tablist">
          {(["macros", "preamble", "other"] as DocinfoTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`pretext-plus-editor__dialog-tab${
                activeTab === tab
                  ? " pretext-plus-editor__dialog-tab--active"
                  : ""
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="pretext-plus-editor__dialog-content pretext-plus-editor__dialog-content--single">
          <div className="pretext-plus-editor__dialog-section">
            <div className="pretext-plus-editor__dialog-editor">
              <Editor
                key={activeTab}
                options={
                  activeTab === "other" ? xmlEditorOptions : latexEditorOptions
                }
                height="100%"
                language={currentLanguage}
                value={currentValue}
                onChange={(value) => currentSetter(value ?? "")}
              />
            </div>
          </div>
        </div>

        <div className="pretext-plus-editor__dialog-actions">
          <button
            type="button"
            className="pretext-plus-editor__dialog-button pretext-plus-editor__dialog-button--secondary"
            onClick={() => onClose(undefined)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pretext-plus-editor__dialog-button"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocinfoEditor;
