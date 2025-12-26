
import 'primereact/resources/themes/lara-light-blue/theme.css'; //theme
import 'primereact/resources/primereact.min.css'; //core css
import 'primeicons/primeicons.css'; //icons
import 'primeflex/primeflex.css'; // flex
import './App.css';
import Editors from './components/Editors';
import { defaultContent } from './defaultContent';
import { useState } from 'react';



function App() {
  const [content, setContent] = useState(defaultContent);
  const [title, setTitle] = useState("Document Title");
  return (
    <>
      <Editors
        content={content}
        onContentChange={(value) => setContent(value || '')}
        title={title}
        onTitleChange={(value) => setTitle(value || "Document Title")}
        onSaveButton={() => console.log("Save clicked")}
        saveButtonLabel="Save and ..."
        onCancelButton={() => console.log("Cancel clicked")}
        cancelButtonLabel="Cancel" />
        <textarea value={title} readOnly style={{display: 'flex', width: '98vw', height: '20vh', marginTop: '10px'}}></textarea>
      <textarea value={content} readOnly style={{display: 'flex', width: '98vw', height: '20vh', marginTop: '10px'}}></textarea>
    </>
  )
}

export default App
