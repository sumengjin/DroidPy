export function downloadDataUrl(
  dataUrl: string,
  filename: string,
  mimeType = 'application/octet-stream'
): void {
  if (typeof window !== 'undefined' && window.DroidPyNative?.saveBase64File) {
    window.DroidPyNative.saveBase64File(dataUrl, filename, mimeType);
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (typeof window !== 'undefined' && window.DroidPyNative?.saveBase64File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to encode file'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
    window.DroidPyNative.saveBase64File(
      dataUrl,
      filename,
      blob.type || 'application/octet-stream'
    );
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
