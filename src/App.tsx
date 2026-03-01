import "./App.css";
import Editors from "./components/Editors";
import { defaultContent } from "./defaultContent";
import { useState } from "react";

const handlePreviewRebuild = async (
  content: string,
  title: string,
  postToIframe: (url: string, data: any) => void,
) => {
  const token = "demo"; // In real usage, get a valid token from your backend
  const postData = { source: content, title: title, token: token };
  postToIframe("https://build.pretext.plus", postData);
};

function App() {
  const [content, setContent] = useState(defaultContent);
  const [title, setTitle] = useState("Document Title");
  return (
    <>
      <Editors
        content={content}
        onContentChange={(value) => setContent(value || "")}
        title={title}
        onTitleChange={(value) => setTitle(value || "Document Title")}
        onSaveButton={() => console.log("Save clicked")}
        saveButtonLabel="Save and ..."
        onCancelButton={() => console.log("Cancel clicked")}
        cancelButtonLabel="Cancel"
        onPreviewRebuild={handlePreviewRebuild}
      />
      <textarea
        value={title}
        readOnly
        style={{
          display: "none",
          width: "98vw",
          height: "20vh",
          marginTop: "10px",
        }}
      ></textarea>
      <textarea
        value={content}
        readOnly
        style={{
          display: "none",
          width: "98vw",
          height: "20vh",
          marginTop: "10px",
        }}
      ></textarea>
    </>
  );
}

export default App;
