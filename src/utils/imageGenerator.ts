/** Trigger a browser download for a PNG (or any) data URL. */
export const downloadImage = (dataUrl: string, filename: string = 'draft-results.png'): void => {
  // Convert data URL to a blob for reliable downloads across browsers.
  const byteString = atob(dataUrl.split(',')[1]);
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeString });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = filename;
  link.href = blobUrl;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  requestAnimationFrame(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  });
};
