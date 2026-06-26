import "./App.css";
import Editors from "./components/Editors";
import { useMemo, useState } from "react";
import type {
  Asset,
  EditorContentChange,
  FeedbackSubmission,
  SourceFormat,
} from "./types/editor";
import type { Division, DivisionType } from "./types/sections";
import { assembleProjectSource } from "./sectionUtils";

/** A self-contained placeholder image (no network dependency) for demo image assets. */
function demoImageDataUrl(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-size="20" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Initial divisions for the article demo
// ---------------------------------------------------------------------------
const DEMO_DIVISIONS: Division[] = [
  {
    id: "demo-root",
    xmlId: "demo-article",
    title: "",
    type: "article",
    sourceFormat: "pretext",
    content: `<article>
<title>Divisions Mode Demo for Article</title>
<p>Each section is a separate <c>Division</c> record in a flat pool. The TOC reads their order from <c>plus:section</c> placeholder tags embedded in this root division's content.</p>
<p>Divisions can mix source formats: most sections below are authored in PreTeXt, but <c>sec-latex</c> is authored in LaTeX and <c>sec-markdown</c> in Markdown. Each is converted to PreTeXt for the preview.</p>
<plus:section ref="sec-intro"/>
<plus:section ref="sec-background"/>
<plus:section ref="sec-results"/>
<plus:section ref="sec-latex"/>
<plus:section ref="sec-markdown"/>
</article>
`,
  },
  {
    id: "demo-intro",
    xmlId: "sec-intro",
    title: "",
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
    title: "",
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
    id: "demo-latex",
    xmlId: "sec-latex",
    title: "A LaTeX Section",
    type: "section",
    sourceFormat: "latex",
    // LaTeX divisions are stored as raw LaTeX. The leading
    // `\section{title}\label{xml:id}` line is the structural header: the code
    // editor locks it (double-click it to edit the title/xml:id from the TOC),
    // and the `\label` becomes the division's `xml:id` on conversion. Body
    // content is converted to PreTeXt for the preview.
    content: `\\section{A LaTeX Section}\\label{sec-latex}

This section is authored in \\LaTeX{} rather than PreTeXt. The editor locks the
leading \\verb|\\section{...}| line; edit its title and xml:id from the TOC.

Inline math like $E = mc^2$ and display math both convert to PreTeXt:
\\[
  \\int_0^1 x^2 \\, dx = \\frac{1}{3}.
\\]

\\begin{itemize}
  \\item LaTeX lists become PreTeXt lists.
  \\item \\textbf{Bold} and \\emph{emphasis} convert too.
\\end{itemize}`,
  },
  {
    id: "demo-markdown",
    xmlId: "sec-markdown",
    title: "A Markdown Section",
    type: "section",
    sourceFormat: "markdown",
    // Markdown divisions are real markdown files: a YAML frontmatter block
    // (division/xml:id/label — shown locked in the code editor) followed by the
    // markdown body. The remark-pretext converter turns the whole file into the
    // proper <section xml:id="...">…</section> element.
    content: `---
division: section
xml:id: sec-markdown
---

# A Markdown Section

This section is authored in **Markdown**, which is auto-converted to PreTeXt.

You can use *emphasis*, \`inline code\`, and inline math such as $a^2 + b^2 = c^2$.

- Markdown bullet lists become PreTeXt lists.
- A second item to show structure.

1. Ordered lists work too.
2. And convert on preview.`,
  },
  {
    id: "demo-orphan",
    xmlId: "sec-orphan",
    title: "",
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

// ---------------------------------------------------------------------------
// Single-division demos for the non-PreTeXt source formats — a single root
// `article` division authored entirely in LaTeX or Markdown, so the whole
// document goes through the per-division convert-to-PreTeXt path rather than
// having LaTeX/Markdown nested as leaf sections under a PreTeXt root.
// ---------------------------------------------------------------------------
const LATEX_DEMO_DIVISIONS: Division[] = [
  {
    id: "latex-root",
    xmlId: "latex-demo",
    title: "Testing LaTeX Source Mode",
    type: "article",
    sourceFormat: "latex",
    content: String.raw`This paragraph appears before the first section, so it becomes the
introduction when converted to PreTeXt.

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

The third section can contain whatever you like.`,
  },
];

const MARKDOWN_DEMO_DIVISIONS: Division[] = [
  {
    id: "markdown-root",
    xmlId: "markdown-demo",
    title: "Testing Markdown Source Mode",
    type: "article",
    sourceFormat: "markdown",
    content: `---
division: article
xml:id: markdown-demo
---

# Markdown Demo

This demo lets you test the **markdown** source mode in the code editor.

## Features To Try

- Heading and paragraph editing
- Lists and inline code like \`inline code\`
- Fenced code blocks

## Example Math-like Text

Inline math such as $E = mc^2$ converts to PreTeXt.

## Blocks and environments

Theorem:
  This is the theorem.

  Proof:
    This is the proof.

More text.`,
  },
];

// ---------------------------------------------------------------------------
// Full-build payload assembly (demo-only)
//
// `onPreviewRebuild` only ever receives the *active division's* converted
// content (see Editors.tsx's `previewContent`), so it can't show what a real
// "full build" would send: the whole document with every `<plus:* ref="..."/>`
// placeholder resolved and every LaTeX/Markdown division converted to PreTeXt.
// `assembleProjectSource` (from the library) reproduces that assembly from the
// `divisions` pool so the payload panel below can show it live, independent
// of the (broken, tokenless) preview iframe.
// ---------------------------------------------------------------------------

const handlePreviewRebuild = async (
  source: string,
  title: string,
  postToIframe: (url: string, data: any) => void,
) => {
  const token = import.meta.env.VITE_BUILD_TOKEN || "demo";
  const postData = { source: source, title: title, token: token };
  console.log("Posting full build payload to preview iframe:", postData);
  postToIframe("https://build.pretext.plus", postData);
};

function App() {
  const [title, setTitle] = useState("Divisions Mode Demo");
  // ---------------------------------------------------------------------------
  // Divisions state — the host always provides a list of divisions.
  // ---------------------------------------------------------------------------
  const [divisions, setDivisions] = useState<Division[]>(DEMO_DIVISIONS);
  const [activeDivisionId, setActiveDivisionId] = useState<string | null>(
    "sec-intro",
  );

  // ---------------------------------------------------------------------------
  // Asset demo state
  // ---------------------------------------------------------------------------
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([
    {
      id: "asset-1",
      name: "Euler Formula",
      ref: "euler-formula.png",
      kind: "image",
      isFile: true,
      url: demoImageDataUrl("Euler Formula", "#0e639c"),
      contentType: "image/svg+xml",
      source: "<shortdescription>Euler's formula relating complex exponentials to trigonometric functions.</shortdescription>",
    },
    {
      id: "asset-2",
      name: "Markdown Logo",
      ref: "markdown-logo.svg",
      kind: "image",
      isFile: true,
      url: demoImageDataUrl("Markdown Logo", "#0f766e"),
      contentType: "image/svg+xml",
      source: "<shortdescription>The Markdown logo.</shortdescription>",
    },
    {
      id: "asset-3",
      name: "PreTeXt Logo",
      ref: "pretext-logo.png",
      kind: "image",
      isFile: true,
      url: demoImageDataUrl("PreTeXt Logo", "#7c3aed"),
      contentType: "image/svg+xml",
      source: "<shortdescription>The PreTeXt logo.</shortdescription>",
    },
    {
      id: "asset-4",
      name: "Sample Activity",
      ref: "sample-activity",
      kind: "doenet",
      source: "<!-- DoenetML for the sample activity goes here -->",
    },
  ]);
  const [projectAssetIds, setProjectAssetIds] = useState<Set<string>>(
    new Set(["asset-1"]),
  );
  const projectAssets = libraryAssets.filter((a) => projectAssetIds.has(a.id));

  const [projectType, setProjectType] = useState<"article" | "book">("article");
  const [demoLabel, setDemoLabel] = useState("Article");

  // ---------------------------------------------------------------------------
  // Full-build payload panel (demo-only debug tool)
  // ---------------------------------------------------------------------------
  const [showBuildPayload, setShowBuildPayload] = useState(false);

  const rootDivision = divisions.find(
    (d) => d.type === "book" || d.type === "article" || d.type === "slideshow",
  ) ?? divisions[0];

  const fullBuildPayload = useMemo(() => {
    if (!rootDivision) return null;
    return {
      source: assembleProjectSource(divisions, rootDivision.xmlId, projectAssets),
      title,
      token: "demo",
    };
  }, [divisions, rootDivision, title, projectAssets]);

  // ---------------------------------------------------------------------------
  // Demo loaders
  // ---------------------------------------------------------------------------

  const loadDivisionsDemo = () => {
    setDivisions(DEMO_DIVISIONS);
    setActiveDivisionId("sec-intro");
    setTitle("Divisions Mode Demo");
    setProjectType("article");
    setDemoLabel("Article");
  };

  const loadBookDemo = () => {
    setDivisions(DEMO_BOOK_DIVISIONS);
    setActiveDivisionId("ch1-sec1");
    setTitle("A Demo Book");
    setProjectType("book");
    setDemoLabel("Book");
  };

  const loadLatexDemo = () => {
    setDivisions(LATEX_DEMO_DIVISIONS);
    setActiveDivisionId("latex-demo");
    setTitle("Testing LaTeX Source Mode");
    setProjectType("article");
    setDemoLabel("LaTeX");
  };

  const loadMarkdownDemo = () => {
    setDivisions(MARKDOWN_DEMO_DIVISIONS);
    setActiveDivisionId("markdown-demo");
    setTitle("Testing Markdown Source Mode");
    setProjectType("article");
    setDemoLabel("Markdown");
  };

  // ---------------------------------------------------------------------------
  // Division handlers
  // ---------------------------------------------------------------------------

  const handleDivisionSelect = (xmlId: string) => {
    setActiveDivisionId(xmlId);
  };

  // Unified content-change handler: every change (division edit, structural
  // reorder, or docinfo edit) arrives keyed by the affected division's xmlId.
  const handleContentChange = (change: EditorContentChange) => {
    setDivisions((prev) =>
      prev.map((d) =>
        d.xmlId === change.xmlId
          ? { ...d, content: change.sourceContent }
          : d,
      ),
    );
  };

  const handleDivisionAdd = async (division: Division): Promise<string> => {
    setDivisions((prev) => [...prev, division]);
    setActiveDivisionId(division.xmlId);
    // Simulate a Rails round-trip that provisions the record's real id.
    // The editor already shows the division locally; this id is patched in
    // once it resolves, without affecting the xmlId used everywhere else.
    console.log("Division provisioning started:", division.xmlId);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `division-${Date.now()}`;
  };

  const handleDivisionRemove = (xmlId: string) => {
    setDivisions((prev) => prev.filter((d) => d.xmlId !== xmlId));
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
      prev.map((d) =>
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
      isFile: true,
      url: URL.createObjectURL(file),
      contentType: file.type,
    };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setProjectAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleAssetFetchUrl = async (url: string): Promise<File> => {
    console.log("Fetching URL on the user's behalf (demo stand-in for a server-side proxy):", url);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const filename = url.split("/").pop()?.split("?")[0] ?? "image.png";
    // A real host fetches `url` server-side (avoiding CORS) and streams the
    // bytes back; it must not persist anything here — persistence happens
    // when the returned file is passed to onAssetUpload.
    return new File([], filename, { type: "image/png" });
  };

  const handleAssetAddFromLibrary = async (asset: Asset) => {
    console.log("Adding library asset to project:", asset.id, asset.name);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setProjectAssetIds((prev) => new Set([...prev, asset.id]));
    console.log("Asset added to project:", asset.ref);
  };

  const handleCreateDoenet = async (name: string, ref: string): Promise<Asset> => {
    console.log("Creating Doenet activity:", name, ref);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const newAsset: Asset = { id: `asset-${Date.now()}`, name, ref, kind: "doenet" };
    setLibraryAssets((prev) => [...prev, newAsset]);
    setProjectAssetIds((prev) => new Set([...prev, newAsset.id]));
    return newAsset;
  };

  const handleAssetRemove = (asset: Asset) => {
    console.log("Removing asset from project:", asset.ref);
    setProjectAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(asset.id);
      return next;
    });
  };

  const handleAssetUpdate = async (asset: Asset) => {
    console.log("Updating asset:", asset.ref, asset.source);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setLibraryAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
  };

  // ---------------------------------------------------------------------------
  // Toolbar label
  // ---------------------------------------------------------------------------

  const toolbarLabel = `Demo: ${demoLabel}`;

  return (
    <>
      <div className="app-demo-toolbar">
        <span className="app-demo-toolbar__label">{toolbarLabel}</span>
        <button
          className="app-demo-toolbar__button"
          onClick={loadDivisionsDemo}
        >
          Load Article Demo
        </button>
        <button className="app-demo-toolbar__button" onClick={loadBookDemo}>
          Load Book Demo
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
          onClick={() => setShowBuildPayload((v) => !v)}
        >
          {showBuildPayload ? "Hide Build Payload" : "Show Build Payload"}
        </button>
      </div>
      {showBuildPayload && fullBuildPayload && (
        <div className="app-build-payload-overlay">
          <div className="app-build-payload-overlay__header">
            <span>Full Build Payload (live, updates as divisions change)</span>
            <div className="app-build-payload-overlay__actions">
              <button
                className="app-demo-toolbar__button"
                onClick={() =>
                  navigator.clipboard.writeText(
                    JSON.stringify(fullBuildPayload, null, 2),
                  )
                }
              >
                Copy JSON
              </button>
              <button
                className="app-demo-toolbar__button"
                onClick={() => setShowBuildPayload(false)}
              >
                Close
              </button>
            </div>
          </div>
          <pre className="app-build-payload-overlay__body">
            {JSON.stringify(fullBuildPayload, null, 2)}
          </pre>
        </div>
      )}
      <Editors
        onContentChange={handleContentChange}
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
        onAssetFetchUrl={handleAssetFetchUrl}
        onCreateDoenet={handleCreateDoenet}
        onAssetRemove={handleAssetRemove}
        onAssetUpdate={handleAssetUpdate}
        divisions={divisions}
        activeDivisionId={activeDivisionId}
        onDivisionSelect={handleDivisionSelect}
        onDivisionAdd={handleDivisionAdd}
        onDivisionRemove={handleDivisionRemove}
        onDivisionUpdate={handleDivisionUpdate}
      />
    </>
  );
}

export default App;
