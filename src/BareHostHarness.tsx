import { useRef, useState } from "react";
import Editors from "./components/Editors";
import type { EditorContentChange } from "./types/editor";
import type { Division } from "./types/sections";

// ---------------------------------------------------------------------------
// Minimal host harness — the BARE MINIMUM a consumer must do.
//
// This intentionally does the least possible:
//   1. Feeds the initial `divisions` / `title` in ONCE.
//   2. Listens to the change callbacks purely to LOG what it would persist —
//      it never echoes anything back as new props.
//
// Because the editor's store now owns the live editing buffer, typing,
// switching divisions, the title field, and "Convert to PreTeXt" must all
// reflect live edits even though `divisions`/`title` never change identity.
//
// The "Push external reset" button simulates a genuine external update (e.g. a
// save that reconciles server-assigned ids, or switching projects): it swaps in
// a brand-new `divisions` array, which MUST override the local edits.
// ---------------------------------------------------------------------------

const INITIAL_DIVISIONS: Division[] = [
  {
    id: "root",
    xmlId: "harness-article",
    title: "Bare Host Harness",
    type: "article",
    sourceFormat: "pretext",
    content: `<article xml:id="harness-article">
<title>Bare Host Harness</title>
<p>The host feeds these divisions in once and only logs the callbacks.</p>
<plus:section ref="sec-one"/>
<plus:section ref="sec-two"/>
</article>`,
  },
  {
    id: "s1",
    xmlId: "sec-one",
    title: "Section One",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="sec-one">
<title>Section One</title>
<p>Type here. The edit should appear live even though the host never echoes it back into props.</p>
</section>`,
  },
  {
    id: "s2",
    xmlId: "sec-two",
    title: "Section Two",
    type: "section",
    sourceFormat: "latex",
    content: `\\section{Section Two}

This section is LaTeX. Open "Convert to PreTeXt" — the converted preview should
reflect whatever you've typed, and confirming should add a live PreTeXt division.`,
  },
];

const RESET_DIVISIONS: Division[] = [
  {
    id: "root",
    xmlId: "harness-article",
    title: "Reset From Server",
    type: "article",
    sourceFormat: "pretext",
    content: `<article xml:id="harness-article">
<title>Reset From Server</title>
<p>This content was pushed in as a genuine EXTERNAL update. It must override any local edits.</p>
<plus:section ref="sec-one"/>
</article>`,
  },
  {
    id: "s1",
    xmlId: "sec-one",
    title: "Reconciled Section",
    type: "section",
    sourceFormat: "pretext",
    content: `<section xml:id="sec-one">
<title>Reconciled Section</title>
<p>Server-reconciled content. Local edits to this section are gone after the reset.</p>
</section>`,
  },
];

function BareHostHarness() {
  // Seeded ONCE. `setDivisions` is only ever called by the explicit external
  // reset button below — never from the change callbacks.
  const [divisions, setDivisions] = useState<Division[]>(INITIAL_DIVISIONS);
  // Seeded once and never updated by the host — proves the title field stays
  // live purely from the store.
  const [title] = useState("Bare Host Harness");
  const renderCount = useRef(0);
  renderCount.current += 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          borderBottom: "1px solid #ccc",
          background: "#f7f7f7",
        }}
      >
        <strong>Bare Host Harness</strong>
        <span style={{ color: "#666" }}>
          (host renders: {renderCount.current}) — callbacks only log; props are
          never echoed
        </span>
        <button onClick={() => setDivisions([...RESET_DIVISIONS])}>
          Push external reset
        </button>
        <button onClick={() => setDivisions([...INITIAL_DIVISIONS])}>
          Restore initial
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editors
          divisions={divisions}
          title={title}
          // Callbacks ONLY log — the host deliberately does not feed edits back.
          onContentChange={(change: EditorContentChange) =>
            console.log("[host] onContentChange", change.xmlId, change.sourceContent)
          }
          onTitleChange={(value) => console.log("[host] onTitleChange", value)}
          onDivisionSelect={(xmlId) => console.log("[host] onDivisionSelect", xmlId)}
          onDivisionAdd={(d) => console.log("[host] onDivisionAdd", d.xmlId)}
          onDivisionRemove={(xmlId) => console.log("[host] onDivisionRemove", xmlId)}
          onDivisionUpdate={(xmlId, changes) =>
            console.log("[host] onDivisionUpdate", xmlId, changes)
          }
        />
      </div>
    </div>
  );
}

export default BareHostHarness;
