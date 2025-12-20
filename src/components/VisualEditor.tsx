/* eslint-disable @typescript-eslint/no-explicit-any */
import { Focus, Gapcursor, UndoRedo } from "@tiptap/extensions";
import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from "@tiptap/react";
import { Editor, Node } from "@tiptap/core";
import { BulletList, OrderedList, ListItem } from '@tiptap/extension-list'
import { MathDisplay, MathEquation, MathInline } from "../extensions/Math";
import "katex/dist/katex.min.css";
import Divisions from "../extensions/Divisions";
import Inline from "../extensions/Inline";
import Blocks from "../extensions/Blocks";
import CodeBlock from "@tiptap/extension-code-block";
import Title from "../extensions/Title";
import Definition from "../extensions/Definition";
import RawPtx from "../extensions/RawPtx";
import "../styles.scss";
import { cleanPtx } from "../utils";
import { json2ptx } from "../json2ptx";
import { useState } from 'react';
import { MenuBar } from "./MenuBar";
import { PtxBubbleMenu } from "./BubbleMenu";
//import { PtxFloatingMenu } from "./FloatingMenu";
import { getCursorPos } from "../extensions/getCursorPos";
//import KeyboardCommands from "../extensions/Keyboard";


const Document = Node.create({
  name: "ptxFragment",
  topNode: true,
  content: "title? introduction? chapter* section* subsection* worksheet*",
});

//export function toggleMenu() {
//  const x = document.getElementById("menuid");
//  if (x) {
//    x.style.display = x.style.display === "none" ? "block" : "none";
//  }
//  console.log("can you see the menu?");
//  return true;
//}

const extensions = [
  CodeBlock.configure({
    defaultLanguage: "xml",
  }),
  //KeyboardCommands,
  Document,
  Inline,
  BulletList,
  OrderedList,
  ListItem,
  Blocks,
  Divisions,
  Title,
  Definition,
  RawPtx,
  MathInline,
  MathEquation,
  MathDisplay,
  Focus.configure({ mode: "deepest" }),
  UndoRedo,
  Gapcursor,
  //onPaste: (currentEditor, files, htmlContent) => {
  //  files.forEach((file) => {
  //    if (htmlContent) {
  //      console.log(htmlContent);
  //      return false;
  //    }
  //    const fileReader = new FileReader();
  //    fileReader.readAsDataURL(file);
  //    fileReader.onload = () => {
  //      currentEditor
  //        .chain()
  //        .insertContentAt(currentEditor.state.selection.anchor, {
  //          type: "image",
  //          attrs: { src: fileReader.result },
  //        })
  //        .focus()
  //        .run();
  //    };
  //  });
  //},
];

interface VisualEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const WarningMessage: React.FC<{ isValid: boolean }> = ({ isValid }) => {
  if (!isValid) {
    return (
      <div className="warning-message">
        <p>
          Warning: PreTeXt source contains a schema error. You will not be able to edit the content on this panel until that is fixed.
        </p>
      </div>
    );
  } else {
    return null;
  }
};


const InfoMessage = ({ editor }: { editor: Editor }) => {
  const [cursorInfo, setCursorInfo] = useState({
    pos: 0,
    parentType: "",
    depth: 0,
    prevNodeIsText: false,
    nextNodeIsText: false,
    prevNodeSize: 0,
    nextNodeSize: 0,
    inTextNode: false,
    location: "",
    parentTypeAlt: "",
  });

  useEffect(() => {
    if (!editor) return;

    const updateCursorInfo = () => {
      const cursor = getCursorPos(editor);
      const altCursor = editor.state.selection.$anchor;
      const location = `Line: ${altCursor.start()} Column: ${altCursor.parentOffset}`;
      setCursorInfo({
        pos: cursor.pos(),
        parentType: cursor.parentType(),
        depth: cursor.depth(),
        prevNodeIsText: cursor.prevNodeIsText(),
        nextNodeIsText: cursor.nextNodeIsText(),
        prevNodeSize: cursor.prevNodeSize(),
        nextNodeSize: cursor.nextNodeSize(),
        inTextNode: cursor.inTextNode(),
        location,
        parentTypeAlt: altCursor.parent.type.name,
      });
    };

    updateCursorInfo();

    editor.on("selectionUpdate", updateCursorInfo);

    return () => {
      editor.off("selectionUpdate", updateCursorInfo);
    };
  }, [editor]);



  return (
    <div className="info">
      <p>Debugging Info:</p>
      <ul>
        <li>Position: {cursorInfo.pos}</li>
        <li>Parent Type: {cursorInfo.parentType}</li>
        <li>Depth: {cursorInfo.depth}</li>
        <li>Node before is text? {cursorInfo.prevNodeIsText ? "Yes" : "No"}</li>
        <li>Node after is text? {cursorInfo.nextNodeIsText ? "Yes" : "No"}</li>
        <li>Previous node size: {cursorInfo.prevNodeSize}</li>
        <li>Next node size: {cursorInfo.nextNodeSize}</li>
        <li>In text node? {cursorInfo.inTextNode ? "Yes" : "No"}</li>
        <li>Location: {cursorInfo.location}</li>
        <li>Parent type: {cursorInfo.parentTypeAlt}</li>
      </ul>
    </div>
  );
};

interface VisualEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const VisualEditor = ({ content, onChange }: VisualEditorProps) => {

  const [isValid, setIsValid] = useState(true);


  const editor = useEditor({
    extensions,
    content: "",
    onContentError(props) {
      console.log("Content error: ", props.error);
      props.disableCollaboration();
      props.editor.setEditable(false, false);
    },
    enableContentCheck: true,
    onUpdate: ({ editor }) => {
      onChange( json2ptx(editor.getJSON()) );
    }
  });


  // The following will update the visual editor when there is an external change to the content.  
  const isExternalUpdateRef = useRef(true);

  useEffect(() => {
    if (editor && content !== editor.getHTML() && isExternalUpdateRef.current) {
      const initialText = content;
      console.log("Content changed, updating VisualEditor");
      console.log("New content: ", initialText);
      console.log("Current editor content: ", editor.getHTML());
      if (editor) {
        console.log("Loading content into VisualEditor");
        try {
          editor.commands.setContent(cleanPtx(initialText), { emitUpdate: false });
          setIsValid(true);
        } catch (error) {
          console.error("Error setting content: ", error);
          setIsValid(false);
        }
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      isExternalUpdateRef.current = false;
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    isExternalUpdateRef.current = true;
  }, [content]);


  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable, false);
    }
  }
    , [editor, isEditable]);

  return (
    <div className="editor-panel">
      <p>Simplified Preview</p>
      <label style={{ textAlign: "right", paddingRight: "10px" }}>
        <input type="checkbox" checked={isEditable} onChange={() => setIsEditable(!isEditable)} />
        Edit
      </label>
      <div className={(isEditable ? "editable" : "read-only") + " ptx-page"}>
      {/* <WarningMessage isValid={isValid} /> */}
      {/* <MenuBar editor={editor} /> */}
        <EditorContent editor={editor} />
      </div>
      <PtxBubbleMenu editor={editor} />
      {/*<InfoMessage editor={editor} />*/}
    </div>
  );
};

export default VisualEditor;
