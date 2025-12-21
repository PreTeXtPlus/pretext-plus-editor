import React from 'react';
import './CodeEditorMenu.css';
import { formatPretext } from '@pretextbook/format';

interface CodeEditorMenuProps {
    content: string;
    onContentChange: (newContent: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const CodeEditorMenu: React.FC<CodeEditorMenuProps> = ({
    content,
    onContentChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
}) => {
    // const handleFormat = () => {
    //     try {
    //         // Format with indentation
    //         onContentChange(formatPretext(content));
    //     } catch (error) {
    //         console.error('Error formatting:', error);
    //         alert('Error formatting XML');
    //     }
    // };

    return (
        <div className="code-editor-menu">
            {/* <button
                className="menu-button"
                onClick={handleFormat}
                title="Format the XML content"
            >
                Format
            </button> */}
            <button
                className="menu-button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo the last action"
            >
                Undo
            </button>
            <button
                className="menu-button"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo the last action"
            >
                Redo
            </button>
        </div>
    );
};


export default CodeEditorMenu;
