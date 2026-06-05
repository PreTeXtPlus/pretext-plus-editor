import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";
import type {
  Asset,
  FeedbackSubmission,
  SourceFormat,
} from "./types/editor";
import type { DocumentChapter, DocumentSection } from "./types/sections";

// ---------------------------------------------------------------------------
// Book demo content — simulates chapters fetched from the Rails back-end
//
// The "server-side" map holds the full source for every chapter, including
// ones the editor has not yet asked for.  The client-facing `chapters` array
// (state inside App) starts with metadata-only entries (no `content`); when
// the editor calls `onChapterRequestLoad`, we simulate an async fetch from
// this map and populate the chapter's `content` field.
// ---------------------------------------------------------------------------
const SERVER_CHAPTER_SOURCES: Record<string, string> = {
  "ch-intro": `<chapter xml:id="ch-intro">
  <title>Introduction</title>
  <introduction>
    <title>Welcome</title>
    <p>This introductory chapter explains the premise of the book.</p>
  </introduction>
  <section xml:id="sec-motivation">
    <title>Motivation</title>
    <p>Here we motivate the study with some inline math: <m>e^{i\\pi} + 1 = 0</m>.</p>
  </section>
  <section xml:id="sec-overview">
    <title>Overview</title>
    <p>Here is an overview of what's to come.</p>
  </section>
</chapter>`,

  "ch-background": `<chapter xml:id="ch-background">
  <title>Background</title>
  <section xml:id="sec-definitions">
    <title>Definitions</title>
    <p>Key definitions appear here.</p>
    <definition xml:id="def-key">
      <title>Key Term</title>
      <p>A <term>key term</term> is something important.</p>
    </definition>
  </section>
  <section xml:id="sec-prior-work">
    <title>Prior Work</title>
    <p>Here we survey related work.</p>
  </section>
</chapter>`,

  "ch-methods": `<chapter xml:id="ch-methods">
  <title>Methods</title>
  <section xml:id="sec-approach">
    <title>Approach</title>
    <p>Our main approach is described here. We use <m>f(x) = x^2</m> as our primary tool.</p>
  </section>
  <conclusion>
    <title>Chapter Summary</title>
    <p>To summarize the methods covered in this chapter...</p>
  </conclusion>
</chapter>`,
};

const bookChapters: DocumentChapter[] = [
  { id: "ch-intro", title: "Introduction", xmlId: "ch-intro" },
  { id: "ch-background", title: "Background", xmlId: "ch-background" },
  { id: "ch-methods", title: "Methods", xmlId: "ch-methods" },
];

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

  // Book-mode state
  const [projectType, setProjectType] = useState<"article" | "book">(
    "article",
  );
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [bookChapterList, setBookChapterList] = useState<DocumentChapter[]>(bookChapters);

  const loadPretextDemo = () => {
    setSource(defaultContent);
    setSourceFormat("pretext");
    setPretextSource(defaultContent);
    setTitle("Document Title");
    setEditMode("document");
    setProjectType("article");
    setCurrentChapterId(null);
  };

  const loadLatexDemo = () => {
    setSource(latexDemoContent);
    setSourceFormat("latex");
    setPretextSource(undefined);
    setTitle("Testing LaTeX Source Mode");
    setEditMode("document");
    setProjectType("article");
    setCurrentChapterId(null);
  };

  const loadMarkdownDemo = () => {
    setSource(markdownDemoContent);
    setSourceFormat("markdown");
    setPretextSource(undefined);
    setTitle("Testing Markdown Source Mode");
    setEditMode("document");
    setProjectType("article");
    setCurrentChapterId(null);
  };

  const loadBookDemo = () => {
    // Start in book mode with no chapter loaded yet so the TOC empty-state is visible
    setProjectType("book");
    setCurrentChapterId(null);
    setSource("");
    setSourceFormat("pretext");
    setPretextSource(undefined);
    setTitle("Sample Book");
    setEditMode("sectioned");
  };

  const handleChapterSelect = (chapterId: string) => {
    const chapterSource =
      bookChapterList.find((c) => c.id === chapterId)?.content ??
      SERVER_CHAPTER_SOURCES[chapterId] ??
      "";
    // Flush any unsaved edits from the outgoing chapter into bookChapterList
    // so that collapsing/re-expanding it later shows the edited sections.
    // We snapshot `source` (the live editor content) rather than ch.content
    // (which is only updated on saves/DnD) to avoid losing in-flight edits.
    setBookChapterList((prev) =>
      prev.map((ch) => {
        if (ch.id === chapterId) return { ...ch, content: chapterSource };
        if (ch.id === currentChapterId) return { ...ch, content: source };
        return ch;
      }),
    );
    // Update both source and currentChapterId together so React 18 batching
    // delivers them in the same render (no stale-sections flash).
    setCurrentChapterId(chapterId);
    setSource(chapterSource);
    setPretextSource(chapterSource);
    setSourceFormat("pretext");
  };

  // -------------------------------------------------------------------------
  // New chapter callbacks (Phase 1: declared and wired into the demo state,
  // not yet driven by the editor UI — that lands in subsequent phases).
  // -------------------------------------------------------------------------

  /**
   * Simulate the back-end fetch of a chapter's source.  In a real host this
   * would be an authenticated HTTP request to Rails; here we just read from
   * the in-memory SERVER_CHAPTER_SOURCES map after a short delay.
   */
  const handleChapterRequestLoad = (chapterId: string) => {
    console.log("Chapter load requested:", chapterId);
    setTimeout(() => {
      setBookChapterList((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? { ...ch, content: SERVER_CHAPTER_SOURCES[chapterId] ?? "" }
            : ch,
        ),
      );
    }, 150);
  };

  /**
   * Persist an updated chapter content back to the "server" and reflect it
   * in the in-memory chapter list so subsequent reads see the new value.
   */
  const handleChapterContentChange = (chapterId: string, content: string) => {
    console.log("Chapter content changed:", chapterId, `(${content.length} chars)`);
    SERVER_CHAPTER_SOURCES[chapterId] = content;
    setBookChapterList((prev) =>
      prev.map((ch) => (ch.id === chapterId ? { ...ch, content } : ch)),
    );
  };

  const handleChapterAdd = (afterChapterId: string | null) => {
    const newId = `ch-${Math.random().toString(36).slice(2, 8)}`;
    const newChapter: DocumentChapter = {
      id: newId,
      title: "New Chapter",
      xmlId: newId,
      content: `<chapter xml:id="${newId}">\n  <title>New Chapter</title>\n</chapter>`,
    };
    SERVER_CHAPTER_SOURCES[newId] = newChapter.content!;
    setBookChapterList((prev) => {
      if (afterChapterId === null) return [...prev, newChapter];
      const idx = prev.findIndex((c) => c.id === afterChapterId);
      if (idx === -1) return [...prev, newChapter];
      return [...prev.slice(0, idx + 1), newChapter, ...prev.slice(idx + 1)];
    });
    console.log("Chapter added:", newId);
  };

  const handleChapterRemove = (chapterId: string) => {
    console.log("Chapter removed:", chapterId);
    delete SERVER_CHAPTER_SOURCES[chapterId];
    setBookChapterList((prev) => prev.filter((c) => c.id !== chapterId));
    if (currentChapterId === chapterId) setCurrentChapterId(null);
  };

  const handleChapterUpdate = (
    chapterId: string,
    changes: { title?: string; xmlId?: string | null; label?: string | null },
  ) => {
    console.log("Chapter updated:", chapterId, changes);
    setBookChapterList((prev) =>
      prev.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              title: changes.title ?? ch.title,
              xmlId: changes.xmlId === null ? undefined : changes.xmlId ?? ch.xmlId,
              label: changes.label === null ? undefined : changes.label ?? ch.label,
            }
          : ch,
      ),
    );
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
          {projectType === "book"
            ? `Book demo | chapter: ${currentChapterId ?? "none"}`
            : `Demo source: ${sourceFormat === "latex" ? "LaTeX" : sourceFormat === "markdown" ? "Markdown" : "PreTeXt"} | Mode: ${editMode}`}
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
        <button className="app-demo-toolbar__button" onClick={loadBookDemo}>
          Load Book Demo
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
        chapters={projectType === "book" ? bookChapterList : undefined}
        currentChapterId={projectType === "book" ? currentChapterId : undefined}
        onChapterSelect={
          projectType === "book" ? handleChapterSelect : undefined
        }
        onChaptersReorder={
          projectType === "book"
            ? (reordered) => setBookChapterList(reordered)
            : undefined
        }
        onChapterRequestLoad={
          projectType === "book" ? handleChapterRequestLoad : undefined
        }
        onChapterContentChange={
          projectType === "book" ? handleChapterContentChange : undefined
        }
        onChapterAdd={projectType === "book" ? handleChapterAdd : undefined}
        onChapterRemove={projectType === "book" ? handleChapterRemove : undefined}
        onChapterUpdate={projectType === "book" ? handleChapterUpdate : undefined}
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
