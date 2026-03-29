import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";
import type { SourceFormat } from "./types/editor";

const latexDemoContent = String.raw`
\section{Introduction}

This is a short LaTeX document for testing the new source-format workflow.

\subsection{Math}

Inline math such as $a^2+b^2=c^2$ should round-trip through the preview pipeline.
\end{document}`;

const handlePreviewRebuild = async (
  content: string,
  title: string,
  postToIframe: (url: string, data: any) => void,
) => {
  const token = "demo"; // In real usage, get a valid token from your backend
  const postData = { source: content, title: title, token: token };
  postToIframe("https://build.pretext.plus", postData);
};

function App() {
  const [content, setContent] = useState(defaultContent);
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("pretext");
  const [pretextContent, setPretextContent] = useState<string | undefined>(
    defaultContent,
  );
  const [title, setTitle] = useState("Document Title");

  const loadPretextDemo = () => {
    setContent(defaultContent);
    setSourceFormat("pretext");
    setPretextContent(defaultContent);
    setTitle("Document Title");
  };

  const loadLatexDemo = () => {
    setContent(latexDemoContent);
    setSourceFormat("latex");
    setPretextContent(undefined);
    setTitle("Testing LaTeX Source Mode");
  };

  return (
    <>
      <div className="app-demo-toolbar">
        <span className="app-demo-toolbar__label">
          Demo source: {sourceFormat === "latex" ? "LaTeX" : "PreTeXt"}
        </span>
        <button className="app-demo-toolbar__button" onClick={loadPretextDemo}>
          Load PreTeXt Demo
        </button>
        <button className="app-demo-toolbar__button" onClick={loadLatexDemo}>
          Load LaTeX Demo
        </button>
      </div>
      <Editors
        content={content}
        sourceFormat={sourceFormat}
        pretextContent={pretextContent}
        onContentChange={(value, meta) => {
          setContent(value || "");
          setSourceFormat(meta?.sourceFormat || "pretext");
          setPretextContent(meta?.pretextContent);
        }}
        title={title}
        onTitleChange={(value) => setTitle(value || "Document Title")}
        onSaveButton={() => console.log("Save clicked")}
        saveButtonLabel="Save and ..."
        onCancelButton={() => console.log("Cancel clicked")}
        cancelButtonLabel="Cancel"
        onSave={() => console.log("Save triggered via keyboard")}
        onPreviewRebuild={handlePreviewRebuild}
      />
      <textarea
        value={title}
        readOnly
        style={{
          display: "none",
          width: "98vw",
          height: "20vh",
          marginTop: "10px",
        }}
      ></textarea>
      <textarea
        value={content}
        readOnly
        style={{
          display: "none",
          width: "98vw",
          height: "20vh",
          marginTop: "10px",
        }}
      ></textarea>
    </>
  );
}

export default App;
