interface FullPreviewProps {
  content: string;
}

const FullPreview = ({ content }:FullPreviewProps) => {
  const postToIframe = (url:string, data:any, iframeName:string) => {
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
  }

  const preview = () => {
      const source = content;
      const title = "foobar";
      // @ts-ignore
      let token:string = window.buildToken
      if (token === undefined) {
        token = import.meta.env.VITE_APP_BUILD_TOKEN
      }
      const postData = { source: source, title: title, token: token };
      postToIframe('https://build.pretext.plus', postData, 'fullPreview');
  }

  return (
    <div className="editor-panel">
      <div className="relative mb-2 flex items-center justify-center pt-2">
        <p className="text-base font-medium m-0 text-center">Full Preview</p>
        <button
          className="absolute right-0 rounded-sm px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
          onClick={() => preview()}
        >
          Rebuild
        </button>
      </div>
      <div>
        <iframe
          style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '70vh' }}
          name="fullPreview"
          src="https://build.pretext.plus" />
      </div>
    </div>
  );
};

export default FullPreview;
