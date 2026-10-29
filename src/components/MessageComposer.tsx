import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  X,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Attachment, Message } from '../types';
import { formatFileSize, validateFileSize } from '../utils/fileValidation';
import { EmojiGifPicker } from './EmojiGifPicker';
import { ChatEngine } from '../lib/chatEngine';

interface MessageComposerProps {
  conversationId: string;
  onSendMessage: (content: string, replyToId?: string | null, attachments?: Attachment[]) => Promise<void>;
  replyingTo: Message | null;
  onCancelReply: () => void;
  onTyping: () => void;
  draft?: string;
  onDraftChange?: (draft: string) => void;
}

interface QueuedUpload {
  id: string;
  file: File;
  progress: number;
  attachment?: Attachment;
  error?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversationId,
  onSendMessage,
  replyingTo,
  onCancelReply,
  onTyping,
  draft = '',
  onDraftChange
}) => {
  const [content, setContent] = useState(draft);
  const [queuedUploads, setQueuedUploads] = useState<QueuedUpload[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft when conversation changes
  useEffect(() => {
    setContent(draft);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [conversationId, draft]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 140)}px`;
    }
  }, [content]);

  // Auto-dismiss notice banner
  useEffect(() => {
    if (!composerNotice) return;
    const timer = setTimeout(() => setComposerNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [composerNotice]);

  const handleContentChange = (val: string) => {
    setContent(val);
    onDraftChange?.(val);
    onTyping();
  };

  const handleFilesAdded = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    for (const file of list) {
      const validation = validateFileSize(file.size);
      if (!validation.valid) {
        setComposerNotice(validation.error || 'File validation failed');
        continue;
      }

      const uploadId = crypto.randomUUID();
      const queuedItem: QueuedUpload = {
        id: uploadId,
        file,
        progress: 10
      };

      setQueuedUploads((prev) => [...prev, queuedItem]);

      try {
        const attachment = await ChatEngine.uploadFile(file, conversationId, (pct) => {
          setQueuedUploads((prev) =>
            prev.map((item) => (item.id === uploadId ? { ...item, progress: pct } : item))
          );
        });

        setQueuedUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? { ...item, progress: 100, attachment }
              : item
          )
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setQueuedUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, error: errorMsg } : item
          )
        );
      }
    }
  };

  const handleRemoveUpload = (uploadId: string) => {
    setQueuedUploads((prev) => prev.filter((item) => item.id !== uploadId));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFilesAdded(pastedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // On mobile keyboards, let user create newlines if they tap return, or send
      // If Shift key is not pressed on desktop, send
      if (window.innerWidth >= 768) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    const readyAttachments = queuedUploads
      .filter((u) => u.attachment && !u.error)
      .map((u) => u.attachment!);

    const stillUploading = queuedUploads.some((u) => !u.attachment && !u.error);
    if (stillUploading) {
      setComposerNotice('Please wait for file uploads to finish.');
      return;
    }

    if (!trimmed && readyAttachments.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSendMessage(trimmed, replyingTo?.id, readyAttachments);
      setContent('');
      onDraftChange?.('');
      setQueuedUploads([]);
      if (replyingTo) onCancelReply();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        if (window.innerWidth >= 768) {
          textareaRef.current.focus();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    const updated = content + emoji;
    handleContentChange(updated);
  };

  const handleSelectGif = async (gifUrl: string, title: string) => {
    const gifAttachment: Attachment = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      uploader_id: 'current',
      original_filename: `${title || 'animation'}.gif`,
      storage_path: gifUrl,
      mime_type: 'image/gif',
      file_size: 0,
      created_at: new Date().toISOString(),
      download_url: gifUrl
    };

    await onSendMessage('', replyingTo?.id, [gifAttachment]);
    if (replyingTo) onCancelReply();
  };

  const hasContent = content.trim().length > 0 || queuedUploads.some((u) => u.attachment);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative p-2.5 sm:p-3 md:p-4 bg-[#FAF8F5] border-t border-[#EAE5E0] safe-area-bottom shrink-0"
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-[#F0ECFF]/95 border-2 border-dashed border-[#8B7CF6] rounded-xl flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-semibold text-[#8B7CF6]">Drop files here to share with friends</p>
          <p className="text-xs text-[#827D8B]">Photos, videos and documents up to 48 MB</p>
        </div>
      )}

      {/* Notice / Alert banner */}
      {composerNotice && (
        <div className="mb-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700 animate-fadeIn">
          <span>{composerNotice}</span>
          <button
            type="button"
            onClick={() => setComposerNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Replying banner */}
      {replyingTo && (
        <div className="mb-2 px-3 py-1.5 bg-[#F0ECFF] border-l-2 border-[#8B7CF6] rounded-r-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[#827D8B]">Replying to</span>
            <span className="font-semibold text-[#8B7CF6]">{replyingTo.sender_name}:</span>
            <span className="text-[#24212B] truncate">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="p-1 text-[#827D8B] hover:text-[#24212B] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Queued uploads list */}
      {queuedUploads.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {queuedUploads.map((item) => (
            <div
              key={item.id}
              className="px-3 py-1.5 bg-white border border-[#EAE5E0] rounded-xl flex items-center gap-2.5 text-xs shadow-2xs"
            >
              <div className="p-1 bg-[#F0ECFF] rounded-md text-[#8B7CF6]">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 max-w-[130px] sm:max-w-[160px]">
                <div className="truncate text-[11px] font-semibold text-[#24212B]">
                  {item.file.name}
                </div>
                <div className="text-[10px] tabular-nums text-[#827D8B]">
                  {formatFileSize(item.file.size)}
                  {item.progress < 100 && !item.error && ` · ${item.progress}%`}
                </div>
              </div>

              {item.progress < 100 && !item.error ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B7CF6]" />
              ) : item.error ? (
                <span title={item.error}>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => handleRemoveUpload(item.id)}
                aria-label={`Remove upload ${item.file.name}`}
                className="text-[#827D8B] hover:text-[#24212B] cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer Input Surface */}
      <div className="relative border border-[#EAE5E0] rounded-2xl bg-white focus-within:border-[#8B7CF6] focus-within:ring-2 focus-within:ring-[#8B7CF6]/20 transition-all shadow-2xs">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder="Write a message... (Shift+Enter for newline)"
          className="w-full resize-none px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-sm text-[#24212B] placeholder-[#A39E98] bg-transparent focus:outline-none min-h-[44px] max-h-36 leading-relaxed"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 border-t border-[#F4F0EA]">
          <div className="flex items-center gap-1">
            {/* Attachment Button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesAdded(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              title="Attach photos or files (up to 48 MB)"
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Emoji & GIF Picker Button */}
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              aria-label="Add emoji or GIF"
              title="Emoji & GIF picker"
              className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
            >
              <Smile className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] text-[#A39E98] select-none">
              Shift+Enter for newline
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent || isSubmitting}
              aria-label="Send message"
              className="min-h-[38px] px-3.5 py-1.5 bg-[#8B7CF6] hover:bg-[#7868E8] active:bg-[#6D59D6] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Emoji & GIF Picker popover */}
      <EmojiGifPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectEmoji={handleSelectEmoji}
        onSelectGif={handleSelectGif}
      />
    </div>
  );
};
