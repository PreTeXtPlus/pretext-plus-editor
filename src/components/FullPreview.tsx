import { useEffect } from 'react';
import './FullPreview.css';

interface FullPreviewProps {
  content: string;
  title?: string;
  onRebuild: (content: string, title: string, postToIframe: (url: string, data: any) => void) => void;
}

// Utility function to POST data to an iframe
export const postToIframe = (url: string, data: any, iframeName: string) => {
  // Create a temporary form element
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.target = iframeName; // This must match the iframe's 'name' attribute
  form.style.display = 'none'; // Keep it hidden

  // Add data as hidden input fields
  for (const key in data) {
      if (Object.hasOwnProperty.call(data, key)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = data[key];
          form.appendChild(input);
      }
  }

  // Append form to body, submit it, and then remove it
  document.body.appendChild(form);
  form.submit();
  form.remove(); // Clean up the form after submission
};

const FullPreview = ({ content, title, onRebuild }:FullPreviewProps) => {
  // Trigger rebuild automatically when component mounts (when switching to full preview)
  useEffect(() => {
    preview();
  }, []);

  const preview = () => {
      const source = content;
      const previewTitle = title || "Document Title";
      
      // If consumer provided a custom rebuild handler, use it
      if (onRebuild) {
        // Provide a helper function that posts to our specific iframe
        const postHelper = (url: string, data: any) => {
          postToIframe(url, data, 'fullPreview');
        };
        onRebuild(source, previewTitle, postHelper);
        return;
      }
  }

  return (
    <div className="pretext-plus-editor__full-preview">
      <div className="pretext-plus-editor__preview-header">
        <p className="pretext-plus-editor__preview-title">Full Preview</p>
        <button
          className="pretext-plus-editor__rebuild-button"
          onClick={() => preview()}
        >
          Rebuild
        </button>
      </div>
      <div className="pretext-plus-editor__preview-container">
        <iframe
          className="pretext-plus-editor__preview-iframe"
          name="fullPreview"
        />
      </div>
    </div>
  );
};

export default FullPreview;
