/**
 * File validation, sanitization, and helper utilities.
 * Enforces size limits (target < 48MB for Supabase Free plan safety)
 * and safely categorizes file types.
 */

export const MAX_FILE_SIZE_BYTES = 48 * 1024 * 1024; // 48 MB

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'code'
  | 'generic';

/**
 * Sanitizes a filename to prevent path traversal and unsafe characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';
  // Strip path traversal attempts and directory separators
  const basename = filename.replace(/^.*[\\/]/, '');
  // Replace unsafe or control characters with underscores, keeping alphanumerics, dots, dashes, underscores
  const clean = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Avoid leading dots or empty strings
  const trimmed = clean.replace(/^\.+/, '');
  return trimmed || 'file';
}

/**
 * Formats bytes into human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Determines file category based on MIME type and file extension.
 */
export function getFileCategory(mimeType?: string, filename?: string): FileCategory {
  const mime = (mimeType || '').toLowerCase();
  const ext = filename ? filename.split('.').pop()?.toLowerCase() || '' : '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime.includes('presentation') ||
    mime.includes('spreadsheet') ||
    ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'csv', 'md'].includes(ext)
  ) {
    return 'document';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    ['zip', 'rar', 'tar', 'gz', '7z', 'bz2'].includes(ext)
  ) {
    return 'archive';
  }
  if (
    [
      'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'rb', 'go',
      'rs', 'c', 'cpp', 'h', 'java', 'sql', 'sh', 'yaml', 'yml', 'toml'
    ].includes(ext)
  ) {
    return 'code';
  }
  return 'generic';
}

/**
 * Validates file size against maximum limit.
 */
export function validateFileSize(sizeInBytes: number, limitInBytes: number = MAX_FILE_SIZE_BYTES): {
  valid: boolean;
  error?: string;
} {
  if (sizeInBytes <= 0) {
    return { valid: false, error: 'File is empty.' };
  }
  if (sizeInBytes > limitInBytes) {
    return {
      valid: false,
      error: `File exceeds limit of ${formatFileSize(limitInBytes)} (size: ${formatFileSize(sizeInBytes)}).`
    };
  }
  return { valid: true };
}
