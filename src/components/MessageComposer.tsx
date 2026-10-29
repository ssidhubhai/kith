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
  onTyping
}) => {
  const [content, setContent] = useState('');
  const [queuedUploads, setQueuedUploads] = useState<QueuedUpload[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 160)}px`;
    }
  }, [content]);

  // Handle file selection
  const handleFilesAdded = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    for (const file of list) {
      const validation = validateFileSize(file.size);
      if (!validation.valid) {
        alert(validation.error);
        continue;
      }

      const uploadId = crypto.randomUUID();
      const queuedItem: QueuedUpload = {
        id: uploadId,
        file,
        progress: 10
      };

      setQueuedUploads((prev) => [...prev, queuedItem]);

      // Start upload in background
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

  // Remove queued file
  const handleRemoveUpload = (uploadId: string) => {
    setQueuedUploads((prev) => prev.filter((item) => item.id !== uploadId));
  };

  // Clipboard paste support (e.g. pasted screenshot or image)
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

  // Drag and drop support
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
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    const readyAttachments = queuedUploads
      .filter((u) => u.attachment && !u.error)
      .map((u) => u.attachment!);

    const stillUploading = queuedUploads.some((u) => !u.attachment && !u.error);
    if (stillUploading) {
      alert('Please wait for file uploads to finish.');
      return;
    }

    if (!trimmed && readyAttachments.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSendMessage(trimmed, replyingTo?.id, readyAttachments);
      setContent('');
      setQueuedUploads([]);
      if (replyingTo) onCancelReply();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectGif = async (gifUrl: string, title: string) => {
    // Send GIF immediately as an attachment or message
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
      className="relative p-3 md:p-4 bg-white border-t border-[#E5E5E5]"
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-[#FAFAFA]/95 border-2 border-dashed border-[#171717] flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-semibold text-[#171717]">Drop files here to share</p>
          <p className="text-xs text-[#737373]">Files up to 48 MB supported</p>
        </div>
      )}

      {/* Replying banner */}
      {replyingTo && (
        <div className="mb-2 px-3 py-1.5 bg-[#FAFAFA] border-l-2 border-[#171717] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[#737373]">Replying to</span>
            <span className="font-semibold text-[#171717]">{replyingTo.sender_name}:</span>
            <span className="text-[#737373] truncate">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="p-1 text-[#737373] hover:text-[#171717] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Queued uploads list */}
      {queuedUploads.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {queuedUploads.map((item) => (
            <div
              key={item.id}
              className="px-2.5 py-1.5 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center gap-2 text-xs"
            >
              <FileText className="w-3.5 h-3.5 text-[#171717] shrink-0" />
              <div className="min-w-0 max-w-[140px]">
                <div className="truncate text-[11px] font-medium text-[#171717]">
                  {item.file.name}
                </div>
                <div className="text-[10px] tabular-nums text-[#737373]">
                  {formatFileSize(item.file.size)}
                  {item.progress < 100 && !item.error && ` · ${item.progress}%`}
                </div>
              </div>

              {item.progress < 100 && !item.error ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#737373]" />
              ) : item.error ? (
                <span title={item.error}>
                  <AlertCircle className="w-3 h-3 text-red-600" />
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => handleRemoveUpload(item.id)}
                aria-label={`Remove upload ${item.file.name}`}
                className="text-[#737373] hover:text-[#171717] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer Input Box */}
      <div className="relative border border-[#E5E5E5] focus-within:border-[#171717] bg-[#FAFAFA] focus-within:bg-white transition-colors">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onTyping();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          className="w-full resize-none px-3.5 py-2.5 text-sm text-[#171717] placeholder-[#A3A3A3] bg-transparent focus:outline-none min-h-[42px] max-h-40 leading-relaxed"
        />

        {/* Toolbar below textarea */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#F0F0F0]">
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
              title="Attach files or photos (up to 48 MB)"
              className="p-1.5 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Emoji & GIF Picker Button */}
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              aria-label="Add emoji or GIF"
              title="Emoji and GIF picker"
              className="p-1.5 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-[#A3A3A3] select-none">
              Shift+Enter for newline
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent || isSubmitting}
              aria-label="Send message"
              className="px-3 py-1.5 bg-[#171717] hover:bg-[#262626] active:bg-black text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3 h-3" />
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
