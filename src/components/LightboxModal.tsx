import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Loader2, Check } from 'lucide-react';
import { Attachment } from '../types';
import { downloadAttachmentFile } from '../utils/fileDownload';

interface LightboxModalProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ attachment, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (attachment) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, onClose]);

  if (!attachment) return null;

  const url = attachment.download_url || '';

  const handleDownload = async () => {
    if (isDownloading || !url) return;
    setIsDownloading(true);
    try {
      const res = await downloadAttachmentFile(url, attachment.original_filename);
      if (res.success) {
        setIsDownloaded(true);
        setTimeout(() => setIsDownloaded(false), 2500);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview lightbox"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 md:p-8 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div
        className="w-full flex items-center justify-between text-white/80 max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 truncate max-w-md">
          <span className="text-xs font-mono truncate text-white">
            {attachment.original_filename}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            aria-label={`Download ${attachment.original_filename} to device`}
            title="Download to device"
            className="p-2 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#8B7CF6]" />
            ) : isDownloaded ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image lightbox"
            className="p-2 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>


      {/* Media container */}
      <div
        className="flex-1 flex items-center justify-center max-w-5xl max-h-[80vh] w-full my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {attachment.mime_type.startsWith('video/') ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] object-contain shadow-2xl"
          />
        ) : (
          <img
            src={url}
            alt={attachment.original_filename}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[80vh] object-contain shadow-2xl select-none"
          />
        )}
      </div>

      {/* Bottom info */}
      <div className="text-[11px] text-white/50 text-center">
        Press Escape or click outside to dismiss
      </div>
    </div>
  );
};
