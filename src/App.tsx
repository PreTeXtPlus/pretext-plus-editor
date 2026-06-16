import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";
import type {
  Asset,
  FeedbackSubmission,
  SourceFormat,
} from "./types/editor";
import type { Division, DivisionType } from "./types/sections";

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

// ---------------------------------------------------------------------------
// Initial divisions for the divisions-mode demo
// ---------------------------------------------------------------------------
const DEMO_DIVISIONS: Division[] = [
  {
    id: "demo-root",
    xmlId: "demo-article",
    title: "Divisions Mode Demo",
    type: "article",
    sourceFormat: "pretext",
    content: `<article xml:id="demo-article">
<title>Divisions Mode Demo</title>
<p>Each section is a separate <c>Division</c> record in a flat pool. The TOC reads their order from <c>plus:section</c> placeholder tags embedded in this root division's content.</p>
<plus:section ref="sec-intro"/>
<plus:section ref="sec-background"/>
<plus:section ref="sec-results"/>
</article>`,
  },
  {
    id: "demo-intro",
    xmlId: "sec-intro",
    title: "Introduction",
    type: "introduction",
    sourceFormat: "pretext",
    content: `<introduction xml:id="sec-intro">
<title>Introduction</title>
<p>In the divisions model every structural element—article, chapter, section, worksheet—is a flat <c>Division</c> record. Hierarchy is expressed by <c>plus:section</c> placeholder tags inside a parent division's content.</p>
<p>Click a section in the TOC to edit it. Drag sections to reorder them—reordering updates the placeholder order in the parent's content rather than a database sort column.</p>
</introduction>`,
  },
  {
    id: "demo-background",
    xmlId: "sec-background",
    title: "Background",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="sec-background">
<title>Background</title>
<p>Previously, sections were either stored merged into one document blob or kept in order via a database sort column. In divisions mode each division owns its own content independently and parent divisions reference children by <attr>xml:id</attr>.</p>
<p>This means the XML source is the authoritative record of structure—not the database.</p>
</section>`,
  },
  {
    id: "demo-results",
    xmlId: "sec-results",
    title: "Results",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="sec-results">
<title>Results</title>
<p>The TOC reads the ordered list of <c>plus:section ref="..."</c> tags from the root division's content and displays them in that order. Drag-to-reorder rewrites those placeholder tags in-place.</p>
</section>`,
  },
  {
    id: "demo-orphan",
    xmlId: "sec-orphan",
    title: "Unplaced Section",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="sec-orphan">
<title>Unplaced Section</title>
<p>This section is not referenced by any parent division, so it appears in the <q>Unplaced divisions</q> group at the bottom of the TOC. Add a <c>plus:section ref="sec-orphan"</c> tag inside the root article's content to place it.</p>
</section>`,
  },
];

// ---------------------------------------------------------------------------
// Initial divisions for the BOOK divisions-mode demo (multi-level nesting)
// ---------------------------------------------------------------------------
const DEMO_BOOK_DIVISIONS: Division[] = [
  {
    id: "book-root",
    xmlId: "demo-book",
    title: "A Demo Book",
    type: "book",
    sourceFormat: "pretext",
    content: `<book xml:id="demo-book">
<title>A Demo Book</title>
<plus:chapter ref="ch-one"/>
<plus:chapter ref="ch-two"/>
</book>`,
  },
  {
    id: "book-ch1",
    xmlId: "ch-one",
    title: "Foundations",
    type: "chapter",
    sourceFormat: "pretext",
    content: `<chapter xml:id="ch-one">
<title>Foundations</title>
<introduction>
<p>This chapter is a <c>Division</c> of type <c>chapter</c>. Its sections are separate divisions referenced by <c>plus:section</c> placeholders below.</p>
</introduction>
<plus:section ref="ch1-sec1"/>
<plus:section ref="ch1-sec2"/>
</chapter>`,
  },
  {
    id: "book-ch1-s1",
    xmlId: "ch1-sec1",
    title: "First Principles",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="ch1-sec1">
<title>First Principles</title>
<p>A section nested two levels under the book root. Drag it within or between chapters to move it; the move rewrites <c>plus:section</c> refs in the relevant chapter's content.</p>
</section>`,
  },
  {
    id: "book-ch1-s2",
    xmlId: "ch1-sec2",
    title: "Notation",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="ch1-sec2">
<title>Notation</title>
<p>Another section in chapter one.</p>
</section>`,
  },
  {
    id: "book-ch2",
    xmlId: "ch-two",
    title: "Applications",
    type: "chapter",
    sourceFormat: "pretext",
    content: `<chapter xml:id="ch-two">
<title>Applications</title>
<plus:section ref="ch2-sec1"/>
</chapter>`,
  },
  {
    id: "book-ch2-s1",
    xmlId: "ch2-sec1",
    title: "Worked Examples",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="ch2-sec1">
<title>Worked Examples</title>
<p>The only section in chapter two — try dragging a section from chapter one into here.</p>
</section>`,
  },
  {
    id: "book-orphan-ch",
    xmlId: "ch-appendix",
    title: "Appendix (unplaced)",
    type: "chapter",
    sourceFormat: "pretext",
    content: `<chapter xml:id="ch-appendix">
<title>Appendix (unplaced)</title>
<plus:section ref="appendix-sec"/>
</chapter>`,
  },
  {
    id: "book-orphan-sec",
    xmlId: "appendix-sec",
    title: "Appendix Section",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="appendix-sec">
<title>Appendix Section</title>
<p>This section belongs to the unplaced appendix chapter, so it appears nested under it in the <q>Unplaced divisions</q> group. Use the <c>+</c> button on the appendix to attach the whole subtree to the book.</p>
</section>`,
  },
];

const handlePreviewRebuild = async (
  source: string,
  title: string,
  postToIframe: (url: string, data: any) => void,
) => {
  const token = "demo";
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
  // ---------------------------------------------------------------------------
  // Divisions mode state
  // ---------------------------------------------------------------------------
  const [divisions, setDivisions] = useState<Division[] | undefined>(undefined);
  const [activeDivisionId, setActiveDivisionId] = useState<string | null>(null);

  const isDivisionsMode = divisions !== undefined;

  // ---------------------------------------------------------------------------
  // Asset demo state
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
  const [projectAssetIds, setProjectAssetIds] = useState<Set<string>>(
    new Set(["asset-1"]),
  );
  const projectAssets = libraryAssets.filter((a) => projectAssetIds.has(a.id));

  const [projectType, setProjectType] = useState<"article" | "book">("article");

  // ---------------------------------------------------------------------------
  // Demo loaders
  // ---------------------------------------------------------------------------

  const loadPretextDemo = () => {
    setDivisions(undefined);
    setSource(defaultContent);
    setSourceFormat("pretext");
    setPretextSource(defaultContent);
    setTitle("Document Title");
    setProjectType("article");
  };

  const loadLatexDemo = () => {
    setDivisions(undefined);
    setSource(latexDemoContent);
    setSourceFormat("latex");
    setPretextSource(undefined);
    setTitle("Testing LaTeX Source Mode");
    setProjectType("article");
  };

  const loadMarkdownDemo = () => {
    setDivisions(undefined);
    setSource(markdownDemoContent);
    setSourceFormat("markdown");
    setPretextSource(undefined);
    setTitle("Testing Markdown Source Mode");
    setProjectType("article");
  };

  const loadDivisionsDemo = () => {
    setDivisions(DEMO_DIVISIONS);
    setActiveDivisionId("sec-intro");
    setTitle("Divisions Mode Demo");
    setSource("");
    setSourceFormat("pretext");
    setPretextSource(undefined);
    setProjectType("article");
  };

  const loadBookDemo = () => {
    setDivisions(DEMO_BOOK_DIVISIONS);
    setActiveDivisionId("ch1-sec1");
    setTitle("A Demo Book");
    setSource("");
    setSourceFormat("pretext");
    setPretextSource(undefined);
    setProjectType("book");
  };

  // ---------------------------------------------------------------------------
  // Division handlers (used only when isDivisionsMode)
  // ---------------------------------------------------------------------------

  const handleDivisionSelect = (xmlId: string) => {
    setActiveDivisionId(xmlId);
  };

  const handleDivisionContentChange = (xmlId: string, content: string) => {
    setDivisions((prev) =>
      prev?.map((d) => (d.xmlId === xmlId ? { ...d, content } : d)),
    );
  };

  const handleDivisionAdd = (division: Division) => {
    setDivisions((prev) => (prev ? [...prev, division] : [division]));
    setActiveDivisionId(division.xmlId);
  };

  const handleDivisionRemove = (xmlId: string) => {
    setDivisions((prev) => prev?.filter((d) => d.xmlId !== xmlId));
  };

  const handleDivisionUpdate = (
    xmlId: string,
    changes: {
      title?: string;
      type?: DivisionType;
      xmlId?: string | null;
      sourceFormat?: SourceFormat;
      label?: string | null;
    },
  ) => {
    setDivisions((prev) =>
      prev?.map((d) =>
        d.xmlId === xmlId
          ? {
              ...d,
              ...(changes.title !== undefined && { title: changes.title }),
              ...(changes.type !== undefined && { type: changes.type }),
              ...(changes.xmlId != null && { xmlId: changes.xmlId }),
              ...(changes.sourceFormat !== undefined && {
                sourceFormat: changes.sourceFormat,
              }),
            }
          : d,
      ),
    );
  };

  // ---------------------------------------------------------------------------
  // Feedback / assets
  // ---------------------------------------------------------------------------

  const handleFeedbackSubmit = async (feedback: FeedbackSubmission) => {
    console.log("Feedback submitted:", feedback);
  };

  const handleAssetInsert = (asset: Asset) => {
    console.log("Asset inserted:", asset.ref);
  };

  const handleAssetUpload = async (file: File): Promise<Asset> => {
    console.log("Asset upload started:", file.name, file.type, file.size);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      ref: file.name,
      kind: "image",
    };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setProjectAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleAssetAddUrl = async (
    url: string,
    name: string,
  ): Promise<Asset> => {
    console.log("Asset URL add started:", url, name);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const filename = url.split("/").pop()?.split("?")[0] ?? "image.png";
    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      name: name || filename.replace(/\.[^.]+$/, ""),
      ref: filename,
      kind: "image",
    };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setProjectAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleAssetAddFromLibrary = async (asset: Asset) => {
    console.log("Adding library asset to project:", asset.id, asset.name);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setProjectAssetIds((prev) => new Set([...prev, asset.id]));
    console.log("Asset added to project:", asset.ref);
  };

  // ---------------------------------------------------------------------------
  // Toolbar label
  // ---------------------------------------------------------------------------

  const toolbarLabel = isDivisionsMode
    ? "Demo: Divisions mode"
    : `Demo source: ${
        sourceFormat === "latex"
          ? "LaTeX"
          : sourceFormat === "markdown"
          ? "Markdown"
          : "PreTeXt"
      }`;

  return (
    <>
      <div className="app-demo-toolbar">
        <span className="app-demo-toolbar__label">{toolbarLabel}</span>
        <button className="app-demo-toolbar__button" onClick={loadPretextDemo}>
          Load PreTeXt Demo
        </button>
        <button className="app-demo-toolbar__button" onClick={loadLatexDemo}>
          Load LaTeX Demo
        </button>
        <button
          className="app-demo-toolbar__button"
          onClick={loadMarkdownDemo}
        >
          Load Markdown Demo
        </button>
        <button
          className="app-demo-toolbar__button"
          onClick={loadDivisionsDemo}
        >
          Load Divisions Demo
        </button>
        <button className="app-demo-toolbar__button" onClick={loadBookDemo}>
          Load Book Demo
        </button>
      </div>
      <Editors
        source={source}
        sourceFormat={sourceFormat}
        pretextSource={pretextSource}
        onContentChange={(value, meta) => {
          if (!isDivisionsMode) {
            setSource(value || "");
            setSourceFormat(meta?.sourceFormat || "pretext");
            setPretextSource(meta?.pretextSource);
          }
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
        projectType={projectType}
        projectAssets={projectAssets}
        libraryAssets={libraryAssets}
        onAssetInsert={handleAssetInsert}
        onAssetAddFromLibrary={handleAssetAddFromLibrary}
        onAssetUpload={handleAssetUpload}
        onAssetAddUrl={handleAssetAddUrl}
        divisions={divisions}
        activeDivisionId={isDivisionsMode ? activeDivisionId : undefined}
        onDivisionSelect={isDivisionsMode ? handleDivisionSelect : undefined}
        onDivisionContentChange={
          isDivisionsMode ? handleDivisionContentChange : undefined
        }
        onDivisionAdd={isDivisionsMode ? handleDivisionAdd : undefined}
        onDivisionRemove={isDivisionsMode ? handleDivisionRemove : undefined}
        onDivisionUpdate={isDivisionsMode ? handleDivisionUpdate : undefined}
      />
    </>
  );
}

export default App;
