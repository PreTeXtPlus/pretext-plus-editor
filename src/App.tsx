import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";
import type { FeedbackSubmission, SourceFormat } from "./types/editor";
import type { ChapterSummary, DocumentSection } from "./types/sections";

// ---------------------------------------------------------------------------
// Book demo content — simulates chapters fetched from the Rails back-end
// ---------------------------------------------------------------------------
const bookChapters: ChapterSummary[] = [
  { id: "ch-intro", title: "Introduction", xmlId: "ch-intro" },
  { id: "ch-background", title: "Background", xmlId: "ch-background" },
  { id: "ch-methods", title: "Methods", xmlId: "ch-methods" },
];

const bookChapterSources: Record<string, string> = {
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

  // Book-mode state
  const [projectType, setProjectType] = useState<"article" | "book">(
    "article",
  );
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [bookChapterList, setBookChapterList] = useState<ChapterSummary[]>(bookChapters);

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
    const chapterSource = bookChapterSources[chapterId] ?? "";
    // Simulate an async fetch: update both source and currentChapterId together
    // so React 18 batching delivers them in the same render (no stale-sections flash).
    setCurrentChapterId(chapterId);
    setSource(chapterSource);
    setPretextSource(chapterSource);
    setSourceFormat("pretext");
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
      />
    </>
  );
}

export default App;
