# PreTeXt Plus Editor

An in-browser editor for PreTeXt documents with visual and code editing modes.

## Installation

```bash
npm install @pretextbook/web-editor
```

## Usage

### Basic Setup

```tsx
import React, { useState } from "react";
import {
  Editors,
  type FeedbackSubmission,
  type PretextProjectCopyRequest,
} from "@pretextbook/web-editor";
import "@pretextbook/web-editor/dist/web-editor.css";

function App() {
  const [source, setSource] = useState("");
  const [sourceFormat, setSourceFormat] = useState<"pretext" | "latex">(
    "pretext",
  );
  const [title, setTitle] = useState("My Document");

  const handleFeedbackSubmit = async (feedback: FeedbackSubmission) => {
    await fetch("/api/editor-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
    });
  };

  const handleCreatePretextProjectCopy = async (
    request: PretextProjectCopyRequest,
  ) => {
    await fetch("/api/projects/create_pretext_copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  };

  return (
    <Editors
      source={source}
      sourceFormat={sourceFormat}
      onContentChange={(value, meta) => {
        setSource(value || "");
        setSourceFormat(meta?.sourceFormat || "pretext");
      }}
      title={title}
      onTitleChange={setTitle}
      onSaveButton={() => console.log("Save clicked")}
      saveButtonLabel="Save"
      onCancelButton={() => console.log("Cancel clicked")}
      cancelButtonLabel="Cancel"
      projectUrl={window.location.href}
      onFeedbackSubmit={handleFeedbackSubmit}
      onCreatePretextProjectCopy={handleCreatePretextProjectCopy}
    />
  );
}

export default App;
```

### Styling

**Important:** This package uses Tailwind CSS internally, but **all styles are pre-compiled and bundled** in the CSS file. You don't need to install or configure Tailwind CSS in your project.

Simply import the CSS file:

```tsx
import "@pretextbook/web-editor/dist/web-editor.css";
```

Or in your CSS file:

```css
@import "@pretextbook/web-editor/dist/web-editor.css";
```

All button styles, layout, and MenuBar styling will work automatically without any additional setup.

```css
@import "@pretextbook/web-editor/dist/web-editor.css";
```

## Props

The `Editors` component accepts the following props:

```tsx
type SourceFormat = "pretext" | "latex";

interface FeedbackSubmission {
  context: string;
  email?: string;
  message: string;
  includeCurrentSource: boolean;
  currentSource?: string;
  projectUrl?: string;
  sourceFormat?: SourceFormat;
  title?: string;
  submittedAt: string;
}

interface PretextProjectCopyRequest {
  pretextSource: string;
  title: string;
  projectUrl?: string;
}

interface EditorContentChange {
  sourceContent: string;
  sourceFormat: SourceFormat;
  pretextSource?: string;
  pretextError?: string;
  docinfo?: string;
  commonDocinfo?: string;
  useCommonDocinfo?: boolean;
}

interface editorProps {
  source: string; // The canonical source content
  sourceFormat?: SourceFormat; // The canonical source format
  pretextSource?: string; // Optional derived PreTeXt for previewing LaTeX sources
  docinfo?: string; // Project-specific docinfo XML
  commonDocinfo?: string; // User-level common docinfo/preamble XML
  useCommonDocinfo?: boolean; // Use common docinfo for this project
  onUseCommonDocinfoChange?: (value: boolean) => void;
  onCommonDocinfoChange?: (value: string) => void;
  onContentChange: (
    value: string | undefined,
    meta?: EditorContentChange,
  ) => void;
  title?: string; // Document title
  onTitleChange?: (value: string) => void; // Called when title changes
  onSaveButton?: () => void; // Save button callback
  saveButtonLabel?: string; // Custom save button text
  onCancelButton?: () => void; // Cancel button callback
  cancelButtonLabel?: string; // Custom cancel button text
  onFeedbackSubmit?: (feedback: FeedbackSubmission) => void | Promise<void>;
  projectUrl?: string;
  onCreatePretextProjectCopy?: (
    request: PretextProjectCopyRequest,
  ) => void | Promise<void>;
  onSave?: () => void; // Keyboard save callback
  onPreviewRebuild?: (
    source: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

interface DocinfoEditorCloseValue {
  docinfo: string;
  commonDocinfo: string;
  useCommonDocinfo: boolean;
}

interface DocinfoEditorProps {
  docinfo: string;
  onClose: (value: DocinfoEditorCloseValue | undefined) => void;
  showCommonDocinfoControls?: boolean;
  commonDocinfo?: string;
  initialUseCommonDocinfo?: boolean;
}
```

`DocinfoEditor` is exported for host apps that want to edit user-level common docinfo directly.

For LaTeX-authored documents, the editor derives previewable PreTeXt on the fly. The simple preview remains read-only for the LaTeX source project; visual editing becomes available in the new PreTeXt copy your app creates.

When a document is in LaTeX mode and `onCreatePretextProjectCopy` is provided, the toolbar exposes a Convert to PreTeXt action. Clicking it opens a confirmation dialog and, if confirmed, sends the converted PreTeXt to your callback so your app can create a new project copy.

The current LaTeX project is not replaced by this action.

When `onFeedbackSubmit` is provided, the editor shows Give feedback links in the main menu and LaTeX conversion dialog. The popup collects:

- optional email address
- required feedback message
- optional inclusion of current source
- project URL (when available)

The collected payload is sent to your callback so your app can email it, store it, or route it to another workflow.

### Rails Integration Pattern

```tsx
const handleFeedbackSubmit = async (feedback: FeedbackSubmission) => {
  await fetch("/editor_feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ editor_feedback: feedback }),
  });
};

const handleCreatePretextProjectCopy = async (
  request: PretextProjectCopyRequest,
) => {
  await fetch("/projects/create_pretext_copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_copy: request }),
  });
};
```

Typical server behavior:

- Feedback endpoint stores the message and optionally sends an email to support.
- Project-copy endpoint creates a new project with the same title and `pretextSource` as canonical source.
- Original project remains unchanged.

### Persistence recommendation

For consuming apps, the recommended storage model is:

- store one canonical source: `source` plus `sourceFormat`
- optionally store derived `pretextSource` as a cache for LaTeX-authored documents
- do not treat LaTeX and PreTeXt as two independently editable canonical sources

If your product needs an audit trail, keep the original LaTeX and created PreTeXt copy linked in your own persistence layer.

## Features

- **Visual Editor**: Intuitive WYSIWYG editor for PreTeXt documents using Tiptap
- **Code Editor**: Monaco-powered code editor with syntax highlighting
- **Full Preview**: Full-page preview of your document
- **Synchronized Editing**: Changes in one editor instantly reflect in the other
- **Split View**: View code and visual editor side-by-side
- **Math Support**: KaTeX support for rendering mathematical expressions
- **Keyboard Shortcuts**: Intuitive keyboard navigation and commands

## Peer Dependencies

This package requires:

- `react` >= 16.8.0
- `react-dom` >= 16.8.0

These must be installed separately in your project.

## Browser Support

This package requires a modern browser with ES2020 support.

## Development

For development setup:

```bash
npm install
npm run dev
```

To build the library:

```bash
npm run build
```

To build the demo application:

```bash
npm run build:demo
```

## Publishing

See [PUBLISHING.md](./PUBLISHING.md) for instructions on publishing to npm.

## License

MIT
