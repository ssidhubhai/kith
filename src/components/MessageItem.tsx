import React, { useState } from 'react';
import {
  Reply,
  MoreHorizontal,
  Smile,
  Edit2,
  Trash2,
  Copy,
  Check,
  FileText,
  FileArchive,
  FileCode,
  File,
  Download,
  AlertCircle,
  Loader2,
  Film
} from 'lucide-react';
import { Message, Attachment, Member } from '../types';
import { formatMessageTime } from '../utils/messageGrouping';
import { formatFileSize, getFileCategory } from '../utils/fileValidation';

interface MessageItemProps {
  message: Message;
  currentMember: Member;
  isFirstInGroup: boolean;
  onReply: (message: Message) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenAttachment: (attachment: Attachment) => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentMember,
  isFirstInGroup,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onOpenAttachment,
  onScrollToMessage
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isOwn = message.sender_id === currentMember.id;
  const isDeleted = Boolean(message.deleted_at);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editContent.trim()) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '🎉'];

  // Group reactions by emoji: { emoji: [member_id] }
  const reactionMap = (message.reactions || []).reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.member_id);
    return acc;
  }, {});

  const renderAttachmentIcon = (att: Attachment) => {
    const cat = getFileCategory(att.mime_type, att.original_filename);
    switch (cat) {
      case 'pdf':
      case 'document':
        return <FileText className="w-5 h-5 text-[#171717]" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-[#171717]" />;
      case 'code':
        return <FileCode className="w-5 h-5 text-[#171717]" />;
      case 'video':
        return <Film className="w-5 h-5 text-[#171717]" />;
      default:
        return <File className="w-5 h-5 text-[#171717]" />;
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
      className={`group relative px-4 md:px-6 py-1 transition-colors hover:bg-[#FAFAFA] ${
        isFirstInGroup ? 'mt-3' : 'mt-0.5'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar (only rendered on first in group) */}
        {isFirstInGroup ? (
          <div
            className="w-8 h-8 bg-[#171717] text-white text-xs font-semibold flex items-center justify-center shrink-0 uppercase select-none"
            style={{ backgroundColor: message.sender_avatar_color || '#171717' }}
          >
            {(message.sender_name || 'U').charAt(0)}
          </div>
        ) : (
          <div className="w-8 shrink-0 flex justify-end">
            <span className="text-[10px] tabular-nums text-[#A3A3A3] opacity-0 group-hover:opacity-100 transition-opacity select-none pt-0.5">
              {formatMessageTime(message.created_at)}
            </span>
          </div>
        )}

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Header (sender name + timestamp) */}
          {isFirstInGroup && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold text-[#171717]">
                {message.sender_name || 'Friend'}
              </span>
              <span className="text-[10px] tabular-nums text-[#737373]">
                {formatMessageTime(message.created_at)}
              </span>
              {message.updated_at && !isDeleted && (
                <span className="text-[10px] text-[#A3A3A3] italic">(edited)</span>
              )}
            </div>
          )}

          {/* Reply Quote Preview */}
          {message.reply_to && !isDeleted && (
            <button
              type="button"
              onClick={() => onScrollToMessage && onScrollToMessage(message.reply_to!.id)}
              className="mb-1.5 flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#171717] transition-colors cursor-pointer text-left border-l-2 border-[#171717] pl-2 py-0.5 bg-[#FAFAFA]"
            >
              <span className="font-medium">{message.reply_to.sender_name}:</span>
              <span className="truncate max-w-md">{message.reply_to.content}</span>
            </button>
          )}

          {/* Message Content or Edit Input */}
          {isDeleted ? (
            <p className="text-xs text-[#A3A3A3] italic">
              This message was deleted
            </p>
          ) : isEditing ? (
            <form onSubmit={handleSaveEdit} className="mt-1 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                autoFocus
                rows={2}
                className="w-full p-2 text-xs bg-white border border-[#171717] focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-[#171717] text-white text-xs font-medium hover:bg-[#262626] transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 bg-white border border-[#E5E5E5] text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              {message.content && (
                <p className="text-sm text-[#171717] leading-relaxed break-words whitespace-pre-wrap selection:bg-[#171717] selection:text-white">
                  {message.content}
                </p>
              )}

              {/* Attachments Section */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((att) => {
                    const isImg = getFileCategory(att.mime_type, att.original_filename) === 'image';
                    const isVideo = getFileCategory(att.mime_type, att.original_filename) === 'video';
                    const isAudio = getFileCategory(att.mime_type, att.original_filename) === 'audio';

                    if (isImg) {
                      return (
                        <div
                          key={att.id}
                          onClick={() => onOpenAttachment(att)}
                          className="relative inline-block max-w-sm rounded-none border border-[#E5E5E5] overflow-hidden cursor-zoom-in bg-[#FAFAFA]"
                        >
                          <img
                            src={att.download_url}
                            alt={att.original_filename}
                            referrerPolicy="no-referrer"
                            className="max-h-72 w-auto object-cover"
                            loading="lazy"
                          />
                        </div>
                      );
                    }

                    if (isVideo) {
                      return (
                        <div key={att.id} className="max-w-md border border-[#E5E5E5]">
                          <video
                            src={att.download_url}
                            controls
                            className="max-h-72 w-full object-contain bg-black"
                          />
                        </div>
                      );
                    }

                    if (isAudio) {
                      return (
                        <div key={att.id} className="p-2 border border-[#E5E5E5] bg-[#FAFAFA] max-w-md">
                          <audio src={att.download_url} controls className="w-full h-8" />
                          <div className="mt-1 text-[11px] text-[#737373] truncate">
                            {att.original_filename} ({formatFileSize(att.file_size)})
                          </div>
                        </div>
                      );
                    }

                    // Document / Generic File Card
                    return (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-3 p-3 border border-[#E5E5E5] bg-white hover:border-[#171717] transition-colors max-w-sm"
                      >
                        <div className="p-2 bg-[#FAFAFA] border border-[#E5E5E5]">
                          {renderAttachmentIcon(att)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[#171717] truncate">
                            {att.original_filename}
                          </div>
                          <div className="text-[10px] tabular-nums text-[#737373]">
                            {formatFileSize(att.file_size)}
                          </div>
                        </div>
                        <a
                          href={att.download_url}
                          download={att.original_filename}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Download ${att.original_filename}`}
                          className="p-1.5 text-[#737373] hover:text-[#171717] transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Reactions bar */}
          {Object.keys(reactionMap).length > 0 && !isDeleted && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {Object.entries(reactionMap).map(([emoji, memberIds]) => {
                const userReacted = memberIds.includes(currentMember.id);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction(message.id, emoji)}
                    className={`px-2 py-0.5 text-xs border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      userReacted
                        ? 'bg-[#F5F5F5] border-[#171717] text-[#171717]'
                        : 'bg-white border-[#E5E5E5] text-[#737373] hover:border-[#A3A3A3]'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="tabular-nums font-mono text-[11px]">{memberIds.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pending / Failed Status */}
          {message.status === 'pending' && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#737373]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Sending...</span>
            </div>
          )}
          {message.status === 'failed' && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-red-600 font-medium">
              <AlertCircle className="w-3 h-3" />
              <span>Failed to send. Click to retry.</span>
            </div>
          )}
        </div>

        {/* Hover / Action Toolbar */}
        {!isDeleted && showActions && (
          <div
            role="toolbar"
            aria-label="Message actions"
            className="absolute top-0 right-4 -translate-y-1/2 flex items-center bg-white border border-[#E5E5E5] shadow-xs z-10 divide-x divide-[#E5E5E5]"
          >
            {/* Quick Reactions */}
            <div className="flex items-center px-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(message.id, emoji)}
                  aria-label={`React with ${emoji}`}
                  className="p-1 hover:bg-[#F5F5F5] text-xs transition-colors cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Reply */}
            <button
              type="button"
              onClick={() => onReply(message)}
              title="Reply"
              aria-label="Reply to message"
              className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={handleCopyText}
              title="Copy message"
              aria-label="Copy message text"
              className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Edit (only if sender is current user) */}
            {isOwn && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Edit message"
                aria-label="Edit message"
                className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete (only if sender is current user) */}
            {isOwn && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                title="Delete message"
                aria-label="Delete message"
                className="p-1.5 text-[#737373] hover:text-red-600 hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
