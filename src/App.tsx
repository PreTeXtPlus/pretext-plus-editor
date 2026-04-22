import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";
import type { FeedbackSubmission, SourceFormat } from "./types/editor";
import type { DocumentSection } from "./types/sections";

const latexDemoContent = String.raw`

This paragraph appears before the first section, so it becomes the introduction
when editing section-by-section.

\section{Background}

This is the first proper section. It contains inline math like $a^2 + b^2 = c^2$
and displayed math:
\[
  E = mc^2
\]

\section{Methods}

Here is the second section. You can add \textbf{bold} text, \emph{emphasis},
and environments like \texttt{verbatim}.

\section{Results}

The third section can contain whatever you like.

`;

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
  const [editMode, setEditMode] = useState<"document" | "sectioned">(
    "document",
  );

  const loadPretextDemo = () => {
    setSource(defaultContent);
    setSourceFormat("pretext");
    setPretextSource(defaultContent);
    setTitle("Document Title");
    setEditMode("document");
  };

  const loadLatexDemo = () => {
    setSource(latexDemoContent);
    setSourceFormat("latex");
    setPretextSource(undefined);
    setTitle("Testing LaTeX Source Mode");
    setEditMode("document");
  };

  const handleSectionsChange = (sections: DocumentSection[]) => {
    console.log(
      "Sections changed:",
      sections.map((s) => ({ id: s.id, title: s.title, type: s.type })),
    );
  };

  const handleSectionChange = (section: DocumentSection) => {
    console.log("Section edited:", {
      id: section.id,
      title: section.title,
      type: section.type,
    });
  };

  const handleFeedbackSubmit = async (feedback: FeedbackSubmission) => {
    console.log("Feedback submitted:", feedback);
  };

  return (
    <>
      <div className="app-demo-toolbar">
        <span className="app-demo-toolbar__label">
          Demo source: {sourceFormat === "latex" ? "LaTeX" : "PreTeXt"} | Mode:{" "}
          {editMode}
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
        onFeedbackSubmit={handleFeedbackSubmit}
        projectUrl="https://example.com/projects/demo"
        onSave={() => console.log("Save triggered via keyboard")}
        onPreviewRebuild={handlePreviewRebuild}
        editMode={editMode}
        onEditModeChange={(mode) => {
          console.log("Edit mode changed to:", mode);
          setEditMode(mode);
        }}
        onSectionsChange={handleSectionsChange}
        onSectionChange={handleSectionChange}
      />
    </>
  );
}

export default App;
