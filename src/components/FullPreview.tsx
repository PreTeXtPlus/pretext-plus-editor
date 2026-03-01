import { useEffect, useState, useRef, useCallback } from "react";
import "./FullPreview.css";
import { postToIframe } from "./postToIframe";

interface FullPreviewProps {
  content: string;
  title?: string;
  onRebuild: (
    content: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

const FullPreview = ({ content, title, onRebuild }: FullPreviewProps) => {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const preview = useCallback(() => {
    const source = content;
    const previewTitle = title || "Document Title";

    setIsRebuilding(true);

    // If consumer provided a custom rebuild handler, use it
    if (onRebuild) {
      // Provide a helper function that posts to our specific iframe
      const postHelper = (url: string, data: any) => {
        postToIframe(url, data, "fullPreview");
      };
      onRebuild(source, previewTitle, postHelper);
      return;
    }
  }, [content, title, onRebuild]);

  // Trigger rebuild automatically when component mounts (when switching to full preview)
  // This only runs ONCE on mount, NOT when content/title changes
  useEffect(() => {
    preview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIframeLoad = () => {
    setIsRebuilding(false);
  };

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
        {isRebuilding && (
          <div className="pretext-plus-editor__rebuilding-overlay">
            <div className="pretext-plus-editor__rebuilding-popup">
              <div className="pretext-plus-editor__spinner"></div>
              <p className="pretext-plus-editor__rebuilding-text">
                Rebuilding...
              </p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="pretext-plus-editor__preview-iframe"
          name="fullPreview"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
};

export default FullPreview;
