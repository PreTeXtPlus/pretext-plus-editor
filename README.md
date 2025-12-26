# PreTeXt Plus Editor

An in-browser editor for PreTeXt documents with visual and code editing modes.

## Installation

```bash
npm install @pretextbook/web-editor
```

## Usage

### Basic Setup

```tsx
import React, { useState } from 'react';
import { Editors } from '@pretextbook/web-editor';
import '@pretextbook/web-editor/dist/web-editor.css';

function App() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('My Document');

  return (
    <Editors
      content={content}
      onContentChange={setContent}
      title={title}
      onTitleChange={setTitle}
      onSaveButton={() => console.log('Save clicked')}
      saveButtonLabel="Save"
      onCancelButton={() => console.log('Cancel clicked')}
      cancelButtonLabel="Cancel"
    />
  );
}

export default App;
```

### Styling

The editor includes CSS styles that must be imported. You have two options:

**Option 1: Import the CSS file directly** (recommended)
```tsx
import '@pretextbook/web-editor/dist/web-editor.css';
```

**Option 2: Import in your CSS file**
```css
@import '@pretextbook/web-editor/dist/web-editor.css';
```

## Props

The `Editors` component accepts the following props:

```tsx
interface editorProps {
  content: string;                          // The current PreTeXt content
  onContentChange: (value: string | undefined) => void;  // Called when content changes
  title?: string;                           // Document title
  onTitleChange?: (value: string) => void;  // Called when title changes
  onSaveButton?: () => void;                // Save button callback
  saveButtonLabel?: string;                 // Custom save button text
  onCancelButton?: () => void;              // Cancel button callback
  cancelButtonLabel?: string;               // Custom cancel button text
}
```

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

