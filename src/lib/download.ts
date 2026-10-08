/** Saves a Blob as a file download in the browser. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the click has taken the URL first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
