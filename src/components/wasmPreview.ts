/**
 * In-browser PreTeXt → HTML rendering for the full preview.
 *
 * `@pretextbook/pretext-html` runs the official PreTeXt XSLT stylesheets
 * through a WebAssembly build of libxslt, so a preview no longer needs a round
 * trip to a build server: a render costs ~400ms cold (stylesheet compile plus
 * a CDN fetch of the stylesheet bundle, once per session) and ~90ms warm.
 *
 * Two things about the dependency shape are load-bearing:
 *
 *  - **The import is dynamic.** `@pretextbook/libxslt-wasm` instantiates its
 *    1.3MB WASM module with a *top-level await*, so a static import would pay
 *    that cost on page load for every consumer, whether or not they ever open
 *    a preview. Loading it on first render keeps it off the critical path.
 *  - **Both packages are external to this library's bundle** (see
 *    vite.config.ts). The WASM binary is located with
 *    `new URL("libxslt.wasm", import.meta.url)`; leaving the packages external
 *    lets the consuming app's bundler emit and serve that asset, which is what
 *    Vite and webpack already know how to do.
 *
 * Rendering requires WebAssembly JSPI (stack switching), which not every
 * engine ships. Callers must check {@link isLocalPreviewAvailable} first and
 * fall back to a server build when it is false.
 */

/** Options accepted by a local render. Mirrors the subset we actually use. */
interface LocalRenderOptions {
  /** Light/dark theme for the rendered page; omit for its native behaviour. */
  theme?: "light" | "dark" | "system";
}

type PretextHtmlModule = typeof import("@pretextbook/pretext-html");

let modulePromise: Promise<PretextHtmlModule> | undefined;

/**
 * Whether this engine can render locally. JSPI is the hard requirement: the
 * WASM build suspends mid-transform to fetch stylesheets, which is impossible
 * without it.
 *
 * Deliberately does not import the renderer — this is called during layout to
 * decide whether to offer the preview at all, and must stay synchronous and
 * free.
 */
export function isLocalPreviewAvailable(): boolean {
  return (
    typeof WebAssembly !== "undefined" &&
    typeof globalThis.fetch === "function" &&
    "Suspending" in WebAssembly
  );
}

function loadRenderer(): Promise<PretextHtmlModule> {
  if (!modulePromise) {
    modulePromise = import("@pretextbook/pretext-html");
    // Let a failed load (offline, blocked CDN) be retried rather than cached
    // as a permanent failure.
    modulePromise.catch(() => {
      modulePromise = undefined;
    });
  }
  return modulePromise;
}

/**
 * Serializes renders. **Load-bearing, not an optimisation.**
 *
 * `renderHtml` is not reentrant: it drives a single cached compiled
 * stylesheet through a patched `globalThis.fetch` and shared mount tables.
 * The transform *suspends* mid-run (that is what JSPI is for) to fetch
 * stylesheets, and a second render entering during that window interleaves
 * with the first and corrupts libxslt's internal state.
 *
 * The symptom is badly misleading. The collision surfaces as an out-of-bounds
 * memory access, which the renderer's error mapping reports as "the document
 * is too large … (stack overflow)" no matter how small the document is; worse,
 * the WASM instance stays broken for the rest of the session, failing every
 * later render with a pthread mutex assertion. React's StrictMode double
 * invokes mount effects in development, so without this chain the very first
 * preview reliably poisons the renderer.
 */
let renderChain: Promise<unknown> = Promise.resolve();

async function runRender(
  source: string,
  options: LocalRenderOptions,
): Promise<string> {
  const { renderHtml } = await loadRenderer();
  const { html } = await renderHtml({
    sourcePath: "/source/main.ptx",
    projectDir: "/source",
    sourceContent: source,
    ...(options.theme ? { theme: options.theme } : {}),
  });
  return html;
}

/**
 * Render a complete PreTeXt document to a standalone HTML page.
 *
 * `source` must be a whole `<pretext>` document — which is what
 * `wrapDivisionForPreview` produces — so fragment mode is not needed. The
 * paths are virtual: nothing is read from a filesystem, and `sourceContent`
 * carries the actual text.
 *
 * Renders are queued, never overlapped (see {@link renderChain}). Throws on
 * malformed XML or a failed transform; the caller decides what to do with
 * that (FullPreview keeps the last good render and shows a banner).
 */
export function renderPreviewHtml(
  source: string,
  options: LocalRenderOptions = {},
): Promise<string> {
  // Chain off both outcomes: one failed render must not wedge the queue.
  const result = renderChain.then(
    () => runRender(source, options),
    () => runRender(source, options),
  );
  // The chain tracks completion only — swallow here so an unhandled rejection
  // is not reported for the internal handle. Callers still see the rejection.
  renderChain = result.catch(() => undefined);
  return result;
}

/**
 * Turn a render failure into something worth showing an author.
 *
 * libxslt reports parse errors on the console rather than in the thrown
 * error, so the message is often generic; the common authoring case (a
 * malformed document mid-edit) is worth naming explicitly rather than
 * surfacing "PreTeXt XSLT transform failed".
 */
export function describePreviewError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  if (/transform failed/i.test(message)) {
    return (
      "Could not build the preview. This usually means the PreTeXt is not " +
      "yet well-formed — check for an unclosed tag."
    );
  }
  return message;
}
