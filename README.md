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
import { Editors } from "@pretextbook/web-editor";
import "@pretextbook/web-editor/dist/web-editor.css";

function App() {
  const [source, setSource] = useState("");
  const [sourceFormat, setSourceFormat] = useState<"pretext" | "latex">(
    "pretext",
  );
  const [title, setTitle] = useState("My Document");

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

interface EditorContentChange {
  sourceContent: string;
  sourceFormat: SourceFormat;
  pretextSource?: string;
  pretextError?: string;
}

interface editorProps {
  source: string; // The canonical source content
  sourceFormat?: SourceFormat; // The canonical source format
  pretextSource?: string; // Optional derived PreTeXt for previewing LaTeX sources
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
  onSave?: () => void; // Keyboard save callback
  onPreviewRebuild?: (
    source: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}
```

For LaTeX-authored documents, the editor can now derive previewable PreTeXt on the fly. The simple preview remains read-only until the document is explicitly converted to PreTeXt source.

When a document is in LaTeX mode, the toolbar exposes a `Convert to PreTeXt` action. That action replaces the canonical source with the latest generated PreTeXt so the visual editor can become editable.

### Persistence recommendation

For consuming apps, the recommended storage model is:

- store one canonical source: `source` plus `sourceFormat`
- optionally store derived `pretextSource` as a cache for LaTeX-authored documents
- do not treat LaTeX and PreTeXt as two independently editable canonical sources

Once a user clicks `Convert to PreTeXt`, the canonical source should become PreTeXt. If your product needs an audit trail, keep the original LaTeX separately in your own persistence layer.

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
