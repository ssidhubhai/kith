import React, { useState, useRef } from 'react';
import {
  Reply,
  Edit2,
  Trash2,
  Copy,
  Check,
  FileText,
  FileArchive,
  FileCode,
  File,
  Download,
  Film,
  MoreHorizontal,
  X,
  CornerUpRight,
  Heart,
  Smile
} from 'lucide-react';
import { Message, Attachment, Member } from '../types';
import { formatMessageTime } from '../utils/messageGrouping';
import { formatFileSize, getFileCategory } from '../utils/fileValidation';
import { getMemberAvatarPalette } from '../utils/avatarUtils';

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
  onForward?: (message: Message) => void;
  onOpenFriendProfile?: (memberId: string) => void;
  onRetry?: (message: Message) => void;
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
  onScrollToMessage,
  onForward,
  onOpenFriendProfile,
  onRetry
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDesktopActions, setShowDesktopActions] = useState(false);
  const [showMobileActionSheet, setShowMobileActionSheet] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [copied, setCopied] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const isOwn = message.sender_id === currentMember.id;
  const isDeleted = Boolean(message.deleted_at);
  const avatarPalette = getMemberAvatarPalette(message.sender_avatar_color || message.sender_id || message.sender_name);

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
      setShowMobileActionSheet(false);
    } catch {
      // ignore
    }
  };

  // Double-tap on bubble for quick ❤️ reaction
  const handleBubbleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    // Ignore clicks on inner buttons, links, inputs
    if ((e.target as HTMLElement).closest('button, a, input, textarea, video, audio')) {
      return;
    }
    const now = Date.now();
    if (now - lastTapTimeRef.current < 320) {
      if (!isDeleted) {
        onToggleReaction(message.id, '❤️');
        setShowDoubleTapHeart(true);
        setTimeout(() => setShowDoubleTapHeart(false), 700);
      }
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }
  };

  // Touch long press support for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleted) return;
    handleBubbleInteraction(e);
    longPressTimerRef.current = setTimeout(() => {
      setShowMobileActionSheet(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '🎉', '💡'];

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
        return <FileText className="w-5 h-5 text-[#8B7CF6]" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-[#C2410C]" />;
      case 'code':
        return <FileCode className="w-5 h-5 text-[#0F766E]" />;
      case 'video':
        return <Film className="w-5 h-5 text-[#7E22CE]" />;
      default:
        return <File className="w-5 h-5 text-[#827D8B]" />;
    }
  };

  return (
    <>
      <div
        id={`message-${message.id}`}
        onMouseEnter={() => setShowDesktopActions(true)}
        onMouseLeave={() => setShowDesktopActions(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onClick={handleBubbleInteraction}
        className={`group relative px-3 sm:px-4 md:px-6 py-1 transition-colors hover:bg-[#F4F0EA]/40 ${
          isFirstInGroup ? 'mt-3 sm:mt-4' : 'mt-1'
        }`}
      >
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Avatar (First in group) */}
          {isFirstInGroup ? (
            <button
              type="button"
              onClick={() => onOpenFriendProfile?.(message.sender_id)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-semibold flex items-center justify-center shrink-0 uppercase select-none border shadow-2xs mt-0.5 cursor-pointer hover:scale-105 transition-transform"
              style={{
                backgroundColor: avatarPalette.bg,
                color: avatarPalette.text,
                borderColor: avatarPalette.border
              }}
              title={`View ${message.sender_name}'s profile`}
            >
              {message.sender_avatar_url ? (
                <img
                  src={message.sender_avatar_url}
                  alt={message.sender_name || 'Friend'}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                (message.sender_name || 'F').charAt(0)
              )}
            </button>
          ) : (
            <div className="w-7 sm:w-8 shrink-0 flex justify-end">
              <span className="text-[10px] tabular-nums text-[#827D8B] opacity-0 group-hover:opacity-100 transition-opacity select-none pt-1">
                {formatMessageTime(message.created_at)}
              </span>
            </div>
          )}

          {/* Content Column */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            {isFirstInGroup && (
              <div className="flex items-baseline gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => onOpenFriendProfile?.(message.sender_id)}
                  className="text-xs font-semibold text-[#24212B] hover:text-[#8B7CF6] transition-colors truncate cursor-pointer"
                >
                  {message.sender_name || 'Friend'}
                </button>
                <span className="text-[10px] tabular-nums text-[#827D8B] shrink-0">
                  {formatMessageTime(message.created_at)}
                </span>
                {message.status === 'pending' && (
                  <span className="text-[10px] text-amber-600 italic shrink-0">· sending...</span>
                )}
                {message.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onRetry?.(message)}
                    title={message.error || 'Failed to deliver to Supabase. Click to retry.'}
                    className="text-[10px] text-rose-600 font-semibold underline shrink-0 cursor-pointer hover:text-rose-700"
                  >
                    · Not delivered (Retry)
                  </button>
                )}
                {message.updated_at && !isDeleted && (
                  <span className="text-[10px] text-[#827D8B] italic shrink-0">(edited)</span>
                )}
              </div>
            )}

            {/* Forwarded Header */}
            {message.is_forwarded && !isDeleted && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8B7CF6] mb-1">
                <CornerUpRight className="w-3.5 h-3.5" />
                <span>Forwarded from {message.forwarded_from || 'Friend'}</span>
              </div>
            )}

            {/* Reply Quote Preview */}
            {message.reply_to && !isDeleted && (
              <button
                type="button"
                onClick={() => onScrollToMessage && onScrollToMessage(message.reply_to!.id)}
                className="mb-1.5 flex items-center gap-1.5 text-xs text-[#827D8B] hover:text-[#24212B] transition-colors cursor-pointer text-left border-l-2 border-[#8B7CF6] pl-2.5 py-1 bg-[#F4F0EA]/80 rounded-r-lg max-w-xl"
              >
                <span className="font-semibold text-[#8B7CF6] shrink-0">{message.reply_to.sender_name}:</span>
                <span className="truncate">{message.reply_to.content || 'Original message unavailable'}</span>
              </button>
            )}

            {/* Message Body or Edit Field */}
            {isDeleted ? (
              <p className="text-xs text-[#827D8B] italic py-0.5">
                This message was deleted
              </p>
            ) : isEditing ? (
              <form onSubmit={handleSaveEdit} className="mt-1 space-y-2 max-w-xl">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                  rows={2}
                  className="w-full p-2.5 text-xs bg-white border border-[#8B7CF6] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8B7CF6] text-[#24212B]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 bg-white border border-[#EAE5E0] text-xs font-medium text-[#827D8B] hover:text-[#24212B] rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="relative inline-block max-w-full">
                {message.content && (
                  <div
                    className={`inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed max-w-full border message-content relative ${
                      isOwn
                        ? 'bg-[#F0ECFF] border-[#DDD6FE] text-[#24212B] rounded-br-sm'
                        : 'bg-white border-[#EAE5E0] text-[#24212B] shadow-2xs rounded-bl-sm'
                    }`}
                  >
                    {message.content}

                    {/* Double-tap pop animation */}
                    {showDoubleTapHeart && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200">
                        <Heart className="w-10 h-10 text-rose-500 fill-rose-500 drop-shadow-md animate-bounce" />
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments Section */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2 max-w-full">
                    {message.attachments.map((att) => {
                      const isImg = getFileCategory(att.mime_type, att.original_filename) === 'image';
                      const isVideo = getFileCategory(att.mime_type, att.original_filename) === 'video';
                      const isAudio = getFileCategory(att.mime_type, att.original_filename) === 'audio';

                      if (isImg) {
                        return (
                          <div
                            key={att.id}
                            onClick={() => onOpenAttachment(att)}
                            className="relative inline-block max-w-full sm:max-w-md rounded-xl border border-[#EAE5E0] overflow-hidden cursor-zoom-in bg-[#F4F0EA] shadow-xs hover:border-[#8B7CF6] transition-all"
                          >
                            <img
                              src={att.download_url}
                              alt={att.original_filename}
                              referrerPolicy="no-referrer"
                              className="max-h-64 sm:max-h-72 w-auto object-cover rounded-xl"
                              loading="lazy"
                            />
                          </div>
                        );
                      }

                      if (isVideo) {
                        return (
                          <div key={att.id} className="max-w-full sm:max-w-md rounded-xl overflow-hidden border border-[#EAE5E0] shadow-xs">
                            <video
                              src={att.download_url}
                              controls
                              className="max-h-64 sm:max-h-72 w-full object-contain bg-[#24212B]"
                            />
                          </div>
                        );
                      }

                      if (isAudio) {
                        return (
                          <div key={att.id} className="p-3 border border-[#EAE5E0] bg-white rounded-xl max-w-full sm:max-w-md shadow-2xs">
                            <audio src={att.download_url} controls className="w-full h-8" />
                            <div className="mt-1.5 text-[11px] text-[#827D8B] truncate">
                              {att.original_filename} ({formatFileSize(att.file_size)})
                            </div>
                          </div>
                        );
                      }

                      // Document Card
                      return (
                        <div
                          key={att.id}
                          className="flex items-center gap-2.5 p-2.5 sm:p-3 border border-[#EAE5E0] bg-white hover:border-[#8B7CF6] rounded-xl transition-all max-w-full sm:max-w-sm shadow-2xs"
                        >
                          <div className="p-2 sm:p-2.5 bg-[#F0ECFF] border border-[#DDD6FE] rounded-lg shrink-0">
                            {renderAttachmentIcon(att)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[#24212B] truncate" title={att.original_filename}>
                              {att.original_filename}
                            </div>
                            <div className="text-[10px] tabular-nums text-[#827D8B]">
                              {formatFileSize(att.file_size)}
                            </div>
                          </div>
                          <a
                            href={att.download_url}
                            download={att.original_filename}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Download ${att.original_filename}`}
                            className="p-2 text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-lg transition-colors shrink-0"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reactions Row */}
                {!isDeleted && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {Object.entries(reactionMap).map(([emoji, userIds]) => {
                      const userReacted = userIds.includes(currentMember.id);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onToggleReaction(message.id, emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                            userReacted
                              ? 'bg-[#F0ECFF] border-[#8B7CF6] text-[#6D28D9] font-semibold'
                              : 'bg-white border-[#EAE5E0] text-[#24212B] hover:border-[#8B7CF6]/40'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] tabular-nums">{userIds.length}</span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setShowMobileActionSheet(true)}
                      title="Add reaction"
                      aria-label="Add reaction to message"
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] border border-dashed border-[#DDD6FE] bg-white hover:bg-[#F0ECFF] text-[#8B7CF6] transition-all cursor-pointer shadow-2xs"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile ... Options Trigger */}
          {!isDeleted && (
            <button
              type="button"
              onClick={() => setShowMobileActionSheet(true)}
              aria-label="Message options"
              className="md:hidden min-w-[36px] min-h-[36px] flex items-center justify-center text-[#827D8B] hover:text-[#24212B] active:bg-[#F0ECFF] rounded-xl self-center shrink-0 cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Hover Floating Actions Toolbar */}
          {!isDeleted && showDesktopActions && (
            <div className="hidden md:flex items-center gap-0.5 border border-[#EAE5E0] bg-white rounded-xl shadow-md p-0.5 absolute -top-3 right-4 z-10 animate-in fade-in zoom-in-95 duration-100">
              {/* Quick Reactions */}
              <div className="flex items-center border-r border-[#EAE5E0] pr-1 mr-1">
                {['❤️', '👍', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction(message.id, emoji)}
                    className="p-1 hover:bg-[#F0ECFF] rounded-lg transition-transform hover:scale-115 text-xs cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onReply(message)}
                title="Reply"
                aria-label="Reply to message"
                className="p-1.5 text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-md transition-colors cursor-pointer"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                title="Copy text"
                aria-label="Copy message text"
                className="p-1.5 text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-md transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {onForward && (
                <button
                  type="button"
                  onClick={() => onForward(message)}
                  title="Forward message"
                  aria-label="Forward message"
                  className="p-1.5 text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-md transition-colors cursor-pointer"
                >
                  <CornerUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              {isOwn && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit message"
                  aria-label="Edit message"
                  className="p-1.5 text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-md transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

              {isOwn && (
                <button
                  type="button"
                  onClick={() => onDelete(message.id)}
                  title="Delete message"
                  aria-label="Delete message"
                  className="p-1.5 text-[#827D8B] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Action Sheet */}
      {showMobileActionSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Message action sheet"
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-[#24212B]/40 backdrop-blur-xs"
          onClick={() => setShowMobileActionSheet(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl border-t border-[#EAE5E0] p-4 space-y-4 shadow-xl safe-area-bottom animate-in slide-in-from-bottom duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header & Quick Reactions */}
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE5E0]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#827D8B]">
                Reactions & Options
              </span>
              <button
                type="button"
                onClick={() => setShowMobileActionSheet(false)}
                aria-label="Close options"
                className="p-1.5 text-[#827D8B] hover:text-[#24212B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-around py-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction(message.id, emoji);
                    setShowMobileActionSheet(false);
                  }}
                  className="p-2.5 text-2xl hover:bg-[#F0ECFF] rounded-2xl transition-transform active:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action buttons list */}
            <div className="space-y-1 pt-1 border-t border-[#EAE5E0]">
              <button
                type="button"
                onClick={() => {
                  onReply(message);
                  setShowMobileActionSheet(false);
                }}
                className="w-full h-11 px-3 flex items-center gap-3 text-xs font-semibold text-[#24212B] hover:bg-[#FAF8F5] active:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
              >
                <Reply className="w-4 h-4 text-[#8B7CF6]" />
                <span>Reply to message</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="w-full h-11 px-3 flex items-center gap-3 text-xs font-semibold text-[#24212B] hover:bg-[#FAF8F5] active:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-[#827D8B]" />
                <span>{copied ? 'Copied to clipboard' : 'Copy message text'}</span>
              </button>

              {onForward && (
                <button
                  type="button"
                  onClick={() => {
                    onForward(message);
                    setShowMobileActionSheet(false);
                  }}
                  className="w-full h-11 px-3 flex items-center gap-3 text-xs font-semibold text-[#24212B] hover:bg-[#FAF8F5] active:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
                >
                  <CornerUpRight className="w-4 h-4 text-[#8B7CF6]" />
                  <span>Forward message</span>
                </button>
              )}

              {isOwn && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setShowMobileActionSheet(false);
                  }}
                  className="w-full h-11 px-3 flex items-center gap-3 text-xs font-semibold text-[#24212B] hover:bg-[#FAF8F5] active:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-[#827D8B]" />
                  <span>Edit message</span>
                </button>
              )}

              {isOwn && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(message.id);
                    setShowMobileActionSheet(false);
                  }}
                  className="w-full h-11 px-3 flex items-center gap-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete message</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
