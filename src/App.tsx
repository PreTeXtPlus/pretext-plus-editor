import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";
import type {
  Asset,
  FeedbackSubmission,
  SourceFormat,
} from "./types/editor";
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

const markdownDemoContent = `# Markdown Demo

This demo lets you test the new **markdown** source mode in the code editor.

## Features To Try

- Heading and paragraph editing
- Lists and inline code like \`inline code\`
- Fenced code blocks

## Example Math-like Text

Markdown mode currently treats this as plain text:

\\[ E = mc^2 \\]

## Blocks and environments.

Theorem:
  This is the theorem.

  Proof:
    This is the proof.

More text.
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

  // ---------------------------------------------------------------------------
  // Asset demo state — simulates a Rails-backed library + project association
  //
  // libraryAssets = all assets across all projects for this user
  // projectAssetIds = which library assets are associated with the current project
  // ---------------------------------------------------------------------------
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([
    {
      id: "asset-1",
      name: "Euler Formula",
      ref: "euler-formula.png",
      kind: "image",
    },
    {
      id: "asset-2",
      name: "Markdown Logo",
      ref: "markdown-logo.svg",
      kind: "image",
    },
    {
      id: "asset-3",
      name: "PreTeXt Logo",
      ref: "pretext-logo.png",
      kind: "image",
    },
    {
      id: "asset-4",
      name: "Sample Activity",
      ref: "sample-activity",
      kind: "doenet",
    },
  ]);
  // Only asset-1 is associated with the current project initially
  const [projectAssetIds, setAssetIds] = useState<Set<string>>(
    new Set(["asset-1"]),
  );
  const projectAssets = libraryAssets.filter((a) => projectAssetIds.has(a.id));

  const [projectType, setProjectType] = useState<"article" | "book">("article");

  const loadPretextDemo = () => {
    setSource(defaultContent);
    setSourceFormat("pretext");
    setPretextSource(defaultContent);
    setTitle("Document Title");
    setEditMode("document");
    setProjectType("article");
  };

  const loadLatexDemo = () => {
    setSource(latexDemoContent);
    setSourceFormat("latex");
    setPretextSource(undefined);
    setTitle("Testing LaTeX Source Mode");
    setEditMode("document");
    setProjectType("article");
  };

  const loadMarkdownDemo = () => {
    setSource(markdownDemoContent);
    setSourceFormat("markdown");
    setPretextSource(undefined);
    setTitle("Testing Markdown Source Mode");
    setEditMode("document");
    setProjectType("article");
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

  const handleAssetInsert = (asset: Asset) => {
    console.log("Asset inserted:", asset.ref);
  };

  const handleAssetAddFromLibrary = async (asset: Asset) => {
    console.log("Adding library asset to project:", asset.id, asset.name);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setAssetIds((prev) => new Set([...prev, asset.id]));
  };

  const handleAssetUpload = async (file: File): Promise<Asset> => {
    console.log("Asset upload:", file.name);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      ref: file.name,
      kind: "image",
    };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleAssetAddUrl = async (url: string, name: string): Promise<Asset> => {
    console.log("Asset URL add:", url);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const filename = url.split("/").pop()?.split("?")[0] ?? "image.png";
    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      name: name || filename.replace(/\.[^.]+$/, ""),
      ref: filename,
      kind: "image",
    };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleCreateDoenet = async (name: string, ref: string): Promise<Asset> => {
    console.log("Create Doenet:", name, ref);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const newAsset: Asset = { id: `asset-${Date.now()}`, name, ref, kind: "doenet" };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleAssetRemove = (asset: Asset) => {
    console.log("Remove asset from project:", asset.id);
    setAssetIds((prev) => { const next = new Set(prev); next.delete(asset.id); return next; });
  };

  return (
    <>
      <div className="app-demo-toolbar">
        <span className="app-demo-toolbar__label">
          {`Demo source: ${sourceFormat === "latex" ? "LaTeX" : sourceFormat === "markdown" ? "Markdown" : "PreTeXt"} | Mode: ${editMode}`}
        </span>
        <button className="app-demo-toolbar__button" onClick={loadPretextDemo}>
          Load PreTeXt Demo
        </button>
        <button className="app-demo-toolbar__button" onClick={loadLatexDemo}>
          Load LaTeX Demo
        </button>
        <button className="app-demo-toolbar__button" onClick={loadMarkdownDemo}>
          Load Markdown Demo
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
        projectType={projectType}
        projectAssets={projectAssets}
        libraryAssets={libraryAssets}
        onAssetInsert={handleAssetInsert}
        onAssetAddFromLibrary={handleAssetAddFromLibrary}
        onAssetUpload={handleAssetUpload}
        onAssetAddUrl={handleAssetAddUrl}
        onCreateDoenet={handleCreateDoenet}
        onAssetRemove={handleAssetRemove}
      />
    </>
  );
}

export default App;
