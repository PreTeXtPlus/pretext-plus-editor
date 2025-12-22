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
      const token = "sLL4EsTJ3s3RA3";
      const postData = { source: source, title: title, token: token };
      postToIframe('https://build.pretext.plus', postData, 'fullPreview');
  }

  return (
    <div className="editor-panel">
      <p>Full Preview <button onClick={() => preview()}>Build</button></p>
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
