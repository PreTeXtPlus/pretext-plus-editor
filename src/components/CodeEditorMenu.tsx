import React from 'react';
import './CodeEditorMenu.css';

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
    const handleFormat = () => {
        try {
            // Parse and format XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'application/xml');
            
            if (xmlDoc.documentElement.nodeName === 'parsererror') {
                alert('Invalid XML: ' + xmlDoc.documentElement.textContent);
                return;
            }

            // Format with indentation
            const formatted = formatXml(xmlDoc.documentElement);
            onContentChange(formatted);
        } catch (error) {
            console.error('Error formatting:', error);
            alert('Error formatting XML');
        }
    };

    return (
        <div className="code-editor-menu">
            <button
                className="menu-button"
                onClick={handleFormat}
                title="Format the XML content"
            >
                Format
            </button>
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

// Helper function to format XML with proper indentation
const formatXml = (node: Element, indent = 0): string => {
    const indentStr = '  '.repeat(indent);
    const nextIndentStr = '  '.repeat(indent + 1);
    let result = '';

    if (node.nodeType === Node.ELEMENT_NODE) {
        result += indentStr + '<' + node.nodeName;

        // Add attributes
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            result += ` ${attr.name}="${attr.value}"`;
        }

        // Check if has child nodes
        if (node.childNodes.length === 0) {
            result += ' />\n';
        } else if (node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
            // Single text node
            const text = (node.childNodes[0] as Text).textContent?.trim();
            if (text) {
                result += '>' + text + '</' + node.nodeName + '>\n';
            } else {
                result += ' />\n';
            }
        } else {
            // Multiple child nodes
            result += '>\n';
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === Node.ELEMENT_NODE) {
                    result += formatXml(child as Element, indent + 1);
                } else if (child.nodeType === Node.TEXT_NODE) {
                    const text = (child as Text).textContent?.trim();
                    if (text) {
                        result += nextIndentStr + text + '\n';
                    }
                }
            }
            result += indentStr + '</' + node.nodeName + '>\n';
        }
    }

    return result;
};

export default CodeEditorMenu;
