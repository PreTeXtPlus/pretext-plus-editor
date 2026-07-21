import {
  useEffect,
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import "./FullPreview.css";
import { postToIframe } from "./postToIframe";
import {
  describePreviewError,
  isLocalPreviewAvailable,
  renderPreviewHtml,
} from "./wasmPreview";

interface FullPreviewProps {
  content: string;
  title?: string;
  /**
   * Server-side rebuild handler. Optional: when the browser can render
   * locally (WebAssembly JSPI), the preview builds in-page and this is never
   * called. It remains the fallback for engines without JSPI, so hosts that
   * must support them should keep providing it.
   */
  onRebuild?: (
    content: string,
    title: string,
    postToIframe: (url: string, data: any) => void,
  ) => void;
}

export interface FullPreviewHandle {
  rebuild: () => void;
}

const FullPreview = forwardRef<FullPreviewHandle, FullPreviewProps>(
  ({ content, title, onRebuild }, ref) => {
    const [isRebuilding, setIsRebuilding] = useState(false);
    // The last render that succeeded. Kept across failures so a transient
    // typo does not blank the panel and lose the author's place.
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const savedScrollPosition = useRef<{ x: number; y: number } | null>(null);
    // Only the newest render may commit: a fast second rebuild must not be
    // overwritten by a slower one that started earlier.
    const renderToken = useRef(0);

    // Decided once: whether this engine can render in-page at all. A host that
    // provides no server handler gets the local path regardless, since there
    // is nothing to fall back to.
    const renderLocally = isLocalPreviewAvailable() || !onRebuild;

    const preview = useCallback(() => {
      const source = content;
      const previewTitle = title || "Document Title";

      // Save scroll position before rebuilding so the author keeps their place.
      // Readable for a local render (srcdoc inherits this origin); a
      // cross-origin server preview will throw, which is fine.
      try {
        const iframeWindow = iframeRef.current?.contentWindow;
        if (iframeWindow) {
          savedScrollPosition.current = {
            x: iframeWindow.scrollX,
            y: iframeWindow.scrollY,
          };
        }
      } catch {
        savedScrollPosition.current = null;
      }

      setIsRebuilding(true);

      if (renderLocally) {
        const token = ++renderToken.current;
        renderPreviewHtml(source)
          .then((html) => {
            if (token !== renderToken.current) {
              return;
            }
            setPreviewHtml(html);
            setError(null);
          })
          .catch((err) => {
            if (token !== renderToken.current) {
              return;
            }
            // Keep whatever is already on screen; only report the failure.
            setError(describePreviewError(err));
          })
          .finally(() => {
            if (token === renderToken.current) {
              setIsRebuilding(false);
            }
          });
        return;
      }

      // Server path: the host posts the source into our named iframe.
      const postHelper = (url: string, data: any) => {
        postToIframe(url, data, "fullPreview");
      };
      onRebuild?.(source, previewTitle, postHelper);
    }, [content, title, onRebuild, renderLocally]);

    // Rebuild once when the preview is opened. Deliberately not on every
    // content change: rebuilds are driven by save (Ctrl+S), Ctrl+Enter, and
    // the Rebuild button, so a half-typed document is never rendered.
    useEffect(() => {
      preview();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({ rebuild: preview }), [preview]);

    const handleIframeLoad = () => {
      // A local render settles its own rebuilding state once the promise
      // resolves; the server path has nothing else to tell it that the build
      // finished.
      if (!renderLocally) {
        setIsRebuilding(false);
      }
      if (savedScrollPosition.current) {
        try {
          iframeRef.current?.contentWindow?.scrollTo(
            savedScrollPosition.current.x,
            savedScrollPosition.current.y,
          );
        } catch {
          // Cross-origin iframe; scroll position cannot be restored.
        }
        savedScrollPosition.current = null;
      }
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
        {error && (
          <div
            className="pretext-plus-editor__preview-error"
            role="status"
            aria-live="polite"
          >
            <span className="pretext-plus-editor__preview-error-text">
              <strong>Preview not updated:</strong> {error}
            </span>
            <button
              className="pretext-plus-editor__preview-error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss preview error"
            >
              ×
            </button>
          </div>
        )}
        <div className="pretext-plus-editor__preview-container">
          {/*
            A warm local render takes ~90ms — a full-screen modal would strobe.
            The blocking overlay is kept for the two cases that genuinely take
            a while: a server build, and the first local render of a session
            (which downloads and instantiates the WASM renderer). After that a
            subtle pill is enough.
          */}
          {isRebuilding &&
            (!renderLocally || previewHtml === null ? (
              <div className="pretext-plus-editor__rebuilding-overlay">
                <div className="pretext-plus-editor__rebuilding-popup">
                  <div className="pretext-plus-editor__spinner"></div>
                  <p className="pretext-plus-editor__rebuilding-text">
                    {renderLocally
                      ? "Preparing preview..."
                      : "Rebuilding..."}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="pretext-plus-editor__rebuilding-pill"
                role="status"
                aria-live="polite"
              >
                Updating…
              </div>
            ))}
          <iframe
            ref={iframeRef}
            className="pretext-plus-editor__preview-iframe"
            name="fullPreview"
            title="PreTeXt preview"
            onLoad={handleIframeLoad}
            // srcdoc drives the local path; the server path posts a form into
            // this iframe by name instead and must not have srcdoc set.
            {...(renderLocally && previewHtml !== null
              ? { srcDoc: previewHtml }
              : {})}
          />
        </div>
      </div>
    );
  },
);

FullPreview.displayName = "FullPreview";

export default FullPreview;
