import { useState } from "react";
import { Editor } from "@monaco-editor/react";

interface DocinfoEditorProps {
  /** The current docinfo content to display. */
  docinfo: string;
  /** Called (debounced 500 ms) whenever the user edits the docinfo content. */
  onClose: (value: string | undefined) => void;
}

/**
 * Modal dialog that lets the user edit specific elements inside the docinfo section of the PreTeXt source.
 * Currently supports editing the "macros" element, which is intended for storing document-wide macros and similar information that may be needed for previewing or other derived state.
 */
const DocinfoEditor = ({ docinfo, onClose }: DocinfoEditorProps) => {
  const editorOptions = {
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: "on" as const,
    lineNumbers: "off" as const,
    scrollBeyondLastLine: false,
    tabSize: 2,
    fontSize: 13,
    padding: { top: 10, bottom: 10 },
  };

  // Extract the content of the <macros> element from the docinfo, if it exists
  let macrosContent = "";
  if (docinfo) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(docinfo, "application/xml");
    const macrosElement = doc.querySelector("macros");
    if (macrosElement) {
      macrosContent = macrosElement.textContent || "";
    }
  }

  return (
    <div className="docinfo-editor">
      <h2 className="docinfo-editor__title">Edit Docinfo</h2>
      <Editor options={editorOptions} height="80%" value={macrosContent} />
      <button
        className="docinfo-editor__button"
        onClick={() => onClose(macrosContent)}
      >
        Save and Close
      </button>
      <button
        className="docinfo-editor__button"
        onClick={() => onClose(undefined)}
      >
        Cancel
      </button>
    </div>
  );
};

export default DocinfoEditor;
