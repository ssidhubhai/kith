/**
 * Client-side file download utilities.
 * Ensures cross-origin attachments (PDFs, docs, images, archives) are downloaded
 * to the mobile/desktop device filesystem instead of rendering inline in the browser tab.
 */

import { sanitizeFilename } from './fileValidation';

/**
 * Appends or updates the 'download' query parameter for storage URLs (e.g. Supabase Storage),
 * which signals the server to return 'Content-Disposition: attachment; filename="..."'.
 */
export function prepareDownloadUrl(url: string, filename: string): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  const safeFilename = sanitizeFilename(filename || 'document');

  try {
    // Attempt standard URL parsing (works for absolute URLs)
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    parsed.searchParams.set('download', safeFilename);
    return parsed.toString();
  } catch {
    // Fallback string manipulation if URL parsing fails
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}download=${encodeURIComponent(safeFilename)}`;
  }
}

export interface DownloadOptions {
  onStart?: () => void;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Triggers a device download for a file URL.
 * Converts remote files to a local blob URL so mobile browsers (Android Chrome, iOS Safari)
 * strictly enforce the HTML5 download attribute and write directly to device storage
 * instead of navigating to the PDF/document viewer.
 */
export async function downloadAttachmentFile(
  url: string,
  filename: string,
  options?: DownloadOptions
): Promise<{ success: boolean; error?: string }> {
  const safeFilename = sanitizeFilename(filename || 'download');

  if (!url) {
    const err = new Error('Download URL is empty.');
    options?.onError?.(err);
    return { success: false, error: err.message };
  }

  options?.onStart?.();

  // If already a local Blob or Data URL, trigger immediate download
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    try {
      triggerAnchorDownload(url, safeFilename);
      options?.onSuccess?.();
      return { success: true };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      options?.onError?.(err);
      return { success: false, error: err.message };
    }
  }

  const directDownloadUrl = prepareDownloadUrl(url, safeFilename);

  // Strategy 1: Fetch as Blob to produce a same-origin blob: URL.
  // This bypasses browser cross-origin restrictions on the `download` attribute,
  // forcing mobile Chrome / Safari to save the file to device rather than opening it.
  try {
    const response = await fetch(directDownloadUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });

    if (response.ok) {
      const blob = await response.blob();
      const localBlobUrl = window.URL.createObjectURL(blob);
      triggerAnchorDownload(localBlobUrl, safeFilename);

      // Clean up object URL after mobile device finishes spooling
      setTimeout(() => {
        window.URL.revokeObjectURL(localBlobUrl);
      }, 30000);

      options?.onSuccess?.();
      return { success: true };
    }
  } catch (fetchErr) {
    console.warn('[Download] Blob fetch failed, falling back to direct server download URL:', fetchErr);
  }

  // Strategy 2: Fallback to direct anchor download using server-side Content-Disposition (?download=...)
  try {
    triggerAnchorDownload(directDownloadUrl, safeFilename);
    options?.onSuccess?.();
    return { success: true };
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    options?.onError?.(errorObj);
    return { success: false, error: errorObj.message };
  }
}

/**
 * Creates and dispatches a click on an invisible anchor element with download attribute.
 */
function triggerAnchorDownload(downloadUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;

  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  // Do not set target="_blank" because on mobile it instructs the browser
  // to open a viewer tab instead of saving the file to device storage
  anchor.style.position = 'fixed';
  anchor.style.left = '-9999px';
  anchor.style.top = '-9999px';
  anchor.style.opacity = '0';

  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
  }, 1000);
}
