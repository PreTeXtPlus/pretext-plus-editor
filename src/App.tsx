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
  source: string,
  title: string,
  postToIframe: (url: string, data: any) => void,
) => {
  const token = "demo"; // In real usage, get a valid token from your backend
  const postData = { source: source, title: title, token: token };
  postToIframe("https://build.pretext.plus", postData);
};

function App() {
  const [source, setSource] = useState(defaultContent);
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("pretext");
  const [pretextSource, setPretextSource] = useState<string | undefined>(
    defaultContent,
  );
  const [title, setTitle] = useState("Document Title");

  const loadPretextDemo = () => {
    setSource(defaultContent);
    setSourceFormat("pretext");
    setPretextSource(defaultContent);
    setTitle("Document Title");
  };

  const loadLatexDemo = () => {
    setSource(latexDemoContent);
    setSourceFormat("latex");
    setPretextSource(undefined);
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
        source={source}
        sourceFormat={sourceFormat}
        pretextSource={pretextSource}
        onContentChange={(value, meta) => {
          setSource(value || "");
          setSourceFormat(meta?.sourceFormat || "pretext");
          setPretextSource(meta?.pretextSource);
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
        value={source}
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
