// Type definitions for @pretextbook/web-editor

export interface editorProps {
  content: string;
  onContentChange: (value: string | undefined) => void;
  title?: string;
  onTitleChange?: (value: string) => void;
  onSaveButton?: () => void;
  saveButtonLabel?: string;
  onCancelButton?: () => void;
  cancelButtonLabel?: string;
}

export function Editors(props: editorProps): JSX.Element;

export function CodeEditor(props: any): JSX.Element;

export function VisualEditor(props: any): JSX.Element;

export function FullPreview(props: any): JSX.Element;
