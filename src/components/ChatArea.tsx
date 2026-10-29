import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Search,
  Database,
  ArrowDown,
  Sparkles,
  X,
  RefreshCw,
  WifiOff,
  User,
  Users,
  AlertCircle
} from 'lucide-react';
import { Conversation, Message, Member, Attachment, TypingIndicator, ConnectionState } from '../types';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { formatDateDivider, groupMessages } from '../utils/messageGrouping';
import { filterMessagesByQuery } from '../utils/conversationUtils';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { getMemberAvatarPalette } from '../utils/avatarUtils';

interface ChatAreaProps {
  conversation: Conversation;
  messages: Message[];
  currentMember: Member;
  members: Member[];
  typingIndicators: TypingIndicator[];
  hasMore: boolean;
  onLoadMore: () => void;
  onSendMessage: (content: string, replyToId?: string | null, attachments?: Attachment[]) => Promise<void>;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenAttachment: (attachment: Attachment) => void;
  onBackToSidebar?: () => void;
  onOpenSupabaseModal: () => void;
  onTyping: () => void;
  draft?: string;
  onDraftChange?: (draft: string) => void;
  connectionState?: ConnectionState;
  lastReadTime?: number;
  onForwardMessage?: (message: Message) => void;
  onOpenFriendProfile?: (member: Member) => void;
  onRetryMessage?: (message: Message) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  currentMember,
  members,
  typingIndicators,
  hasMore,
  onLoadMore,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onOpenAttachment,
  onBackToSidebar,
  onOpenSupabaseModal,
  onTyping,
  draft,
  onDraftChange,
  connectionState = 'connected',
  lastReadTime = 0,
  onForwardMessage,
  onOpenFriendProfile,
  onRetryMessage
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [hasNewUnseen, setHasNewUnseen] = useState(false);
  const [pendingDeleteMsgId, setPendingDeleteMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef(messages.length);
  const prevConversationIdRef = useRef(conversation.id);

  const { viewportHeight, isKeyboardOpen } = useVisualViewport();

  const displayedMessages = searchQuery.trim()
    ? filterMessagesByQuery(messages, searchQuery)
    : messages;

  const messageGroups = groupMessages(displayedMessages);

  // Auto-scroll logic: only scroll if at bottom or when switching conversations
  useEffect(() => {
    const isConvChange = prevConversationIdRef.current !== conversation.id;
    prevConversationIdRef.current = conversation.id;

    if (isConvChange) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      setIsScrolledUp(false);
      setHasNewUnseen(false);
      return;
    }

    if (messages.length > prevMessagesCountRef.current) {
      if (!isScrolledUp) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setHasNewUnseen(true);
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages.length, conversation.id, isScrolledUp]);

  // Handle keyboard popup: ensure latest messages remain visible
  useEffect(() => {
    if (isKeyboardOpen && !isScrolledUp) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [isKeyboardOpen, isScrolledUp]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const scrolledAway = distanceFromBottom > 120;
      setIsScrolledUp(scrolledAway);
      if (!scrolledAway) {
        setHasNewUnseen(false);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
    setHasNewUnseen(false);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-[#F0ECFF]');
      setTimeout(() => el.classList.remove('bg-[#F0ECFF]'), 1500);
    }
  };

  const activeTypers = typingIndicators
    .filter((t) => t.conversation_id === conversation.id && t.member_id !== currentMember.id)
    .map((t) => t.display_name);

  // Direct chat other member
  const otherMemberId = conversation.type === 'direct'
    ? conversation.participant_ids?.find((id) => id !== currentMember.id)
    : null;
  const otherMember = members.find((m) => m.id === otherMemberId);

  let subtitle = '';
  if (conversation.type === 'group') {
    const onlineCount = members.filter((m) => m.is_online).length;
    subtitle = `${members.length} members · ${onlineCount} online`;
  } else if (otherMember) {
    if (otherMember.status_text) {
      subtitle = otherMember.status_text;
    } else {
      subtitle = otherMember.is_online ? 'Active now' : 'Offline';
    }
  }

  const directPalette = otherMember
    ? getMemberAvatarPalette(otherMember.avatar_color || otherMember.id || otherMember.display_name)
    : null;

  // First unread message id for divider
  const firstUnreadMsgId = lastReadTime > 0
    ? messages.find(
        (m) =>
          new Date(m.created_at).getTime() > lastReadTime &&
          m.sender_id !== currentMember.id
      )?.id
    : null;

  return (
    <main
      aria-label="Chat conversation view"
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
      className="flex-1 flex flex-col h-full bg-[#FAF8F5] relative overflow-hidden min-w-0"
    >
      {/* Network / Connection status banner */}
      {connectionState === 'reconnecting' && (
        <div className="bg-[#FEF3C7] border-b border-[#FDE68A] text-[#92400E] px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 z-30 shrink-0 animate-in slide-in-from-top duration-150">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D97706]" />
          <span>Reconnecting to circle...</span>
        </div>
      )}
      {connectionState === 'connection_failed' && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-700 px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 z-30 shrink-0 animate-in slide-in-from-top duration-150">
          <WifiOff className="w-3.5 h-3.5 text-rose-600" />
          <span>Connection disrupted. Messages will retry when connection returns.</span>
        </div>
      )}
      {connectionState === 'missing_schema_or_permissions' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-1.5 text-xs font-medium flex items-center justify-between gap-2 z-30 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Connected to Supabase, but database tables or permissions need setup.</span>
          </div>
          <button
            type="button"
            onClick={onOpenSupabaseModal}
            className="underline font-semibold hover:text-amber-950 cursor-pointer text-[11px] shrink-0"
          >
            Run Migration
          </button>
        </div>
      )}
      {connectionState === 'local_only' && (
        <div className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 px-4 py-1.5 text-xs font-medium flex items-center justify-between gap-2 z-30 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>Local Demo Mode: Messages only sync across tabs on this device.</span>
          </div>
          <button
            type="button"
            onClick={onOpenSupabaseModal}
            className="text-[#8B7CF6] font-semibold underline hover:text-[#7868E8] cursor-pointer text-[11px] shrink-0"
          >
            Connect Cloud
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3.5 border-b border-[#EAE5E0] flex items-center justify-between gap-3 bg-[#FAF8F5]/95 backdrop-blur-xs z-20 shrink-0 safe-area-top">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBackToSidebar && (
            <button
              type="button"
              onClick={onBackToSidebar}
              aria-label="Back to conversations list"
              className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center text-[#827D8B] hover:text-[#24212B] hover:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer shrink-0 -ml-1"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Conversation Avatar */}
          {conversation.type === 'direct' && otherMember ? (
            <button
              type="button"
              onClick={() => onOpenFriendProfile?.(otherMember)}
              className="relative shrink-0 cursor-pointer"
              title={`View ${otherMember.display_name}'s profile`}
            >
              {otherMember.avatar_url ? (
                <img
                  src={otherMember.avatar_url}
                  alt={otherMember.display_name}
                  className="w-8 h-8 rounded-xl object-cover border shadow-2xs"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center uppercase border shadow-2xs"
                  style={{
                    backgroundColor: directPalette?.bg,
                    color: directPalette?.text,
                    borderColor: directPalette?.border
                  }}
                >
                  {otherMember.display_name.charAt(0)}
                </div>
              )}
              {otherMember.is_online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] border border-[#DDD6FE] text-[#8B7CF6] flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-4 h-4" />
            </div>
          )}

          <div
            className="min-w-0 cursor-pointer"
            onClick={() => otherMember && onOpenFriendProfile?.(otherMember)}
          >
            <h2 className="text-sm font-bold text-[#24212B] tracking-tight truncate flex items-center gap-1.5">
              <span>{conversation.title}</span>
              {otherMember?.nickname && (
                <span className="text-[11px] font-normal text-[#827D8B] hidden sm:inline">
                  @{otherMember.nickname}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-[#827D8B] truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Top Bar Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {showSearch ? (
            <div className="flex items-center gap-1.5 border border-[#8B7CF6] rounded-xl px-2.5 py-1 bg-white shadow-2xs">
              <Search className="w-3.5 h-3.5 text-[#827D8B]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-28 sm:w-44 text-xs text-[#24212B] focus:outline-none placeholder-[#A39E98]"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearch(false);
                }}
                aria-label="Close search"
                className="p-1 text-[#827D8B] hover:text-[#24212B] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              title="Search conversation"
              aria-label="Search messages in conversation"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {otherMember && (
            <button
              type="button"
              onClick={() => onOpenFriendProfile?.(otherMember)}
              title="View profile"
              aria-label="View friend profile"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
            >
              <User className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSupabaseModal}
            title="Database & Storage Settings"
            aria-label="Database settings"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-xl transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Message Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-3 sm:py-4 space-y-3 sm:space-y-4 min-h-0"
      >
        {/* Load older messages button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              type="button"
              onClick={onLoadMore}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#827D8B] hover:text-[#24212B] border border-[#EAE5E0] bg-white hover:bg-[#F4F0EA] rounded-full transition-colors cursor-pointer shadow-2xs"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {/* Message Groups */}
        {messageGroups.length > 0 ? (
          <div className="max-w-4xl mx-auto w-full">
            {messageGroups.map((group, groupIdx) => {
              const firstMsg = group.messages[0];
              const prevGroup = groupIdx > 0 ? messageGroups[groupIdx - 1] : null;
              const showDateDivider = !prevGroup || prevGroup.dateKey !== group.dateKey;

              return (
                <div key={`group-${groupIdx}-${group.dateKey}-${group.senderId}`}>
                  {/* Date Divider */}
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4 sm:my-5">
                      <span className="text-[10px] font-semibold text-[#827D8B] uppercase tracking-widest bg-[#F4F0EA] border border-[#EAE5E0] px-3 py-1 rounded-full shadow-2xs">
                        {formatDateDivider(firstMsg.created_at)}
                      </span>
                    </div>
                  )}

                  {/* Group Messages */}
                  <div className="space-y-0.5">
                    {group.messages.map((msg, msgIdx) => {
                      const isUnreadStart = firstUnreadMsgId === msg.id;
                      return (
                        <React.Fragment key={msg.id}>
                          {/* Unread marker divider */}
                          {isUnreadStart && (
                            <div className="flex items-center justify-center my-3.5">
                              <div className="h-px bg-[#8B7CF6]/40 flex-1 max-w-[100px]" />
                              <span className="mx-2 text-[10px] font-bold text-[#8B7CF6] uppercase tracking-wider bg-[#F0ECFF] px-3 py-0.5 rounded-full border border-[#DDD6FE] shadow-2xs">
                                New messages
                              </span>
                              <div className="h-px bg-[#8B7CF6]/40 flex-1 max-w-[100px]" />
                            </div>
                          )}

                          <MessageItem
                            message={msg}
                            currentMember={currentMember}
                            isFirstInGroup={msgIdx === 0}
                            onReply={(targetMsg) => setReplyingTo(targetMsg)}
                            onEdit={onEditMessage}
                            onDelete={(id) => setPendingDeleteMsgId(id)}
                            onToggleReaction={onToggleReaction}
                            onOpenAttachment={onOpenAttachment}
                            onScrollToMessage={handleScrollToMessage}
                            onForward={onForwardMessage}
                            onOpenFriendProfile={(mId) => {
                              const found = members.find((m) => m.id === mId);
                              if (found) onOpenFriendProfile?.(found);
                            }}
                            onRetry={onRetryMessage}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6] mb-3 shadow-xs">
              <Sparkles className="w-5 h-5 fill-[#8B7CF6]" />
            </div>
            <h3 className="text-sm font-semibold text-[#24212B] mb-1">
              {searchQuery ? 'No messages found' : 'The room is quiet'}
            </h3>
            <p className="text-xs text-[#827D8B] max-w-sm leading-relaxed">
              {searchQuery
                ? 'Try searching with different keywords.'
                : 'Share a note, upload a picture, or say hello to your circle.'}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {isScrolledUp && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to newest messages"
          className="absolute bottom-20 sm:bottom-24 right-4 sm:right-6 z-20 px-3.5 py-1.5 bg-[#8B7CF6] text-white text-xs font-semibold rounded-full shadow-[0_4px_16px_rgba(139,124,246,0.35)] flex items-center gap-1.5 hover:bg-[#7868E8] transition-all cursor-pointer animate-in fade-in zoom-in-95 duration-150"
        >
          <span>{hasNewUnseen ? 'New messages ↓' : 'Latest'}</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Typing Indicator */}
      {activeTypers.length > 0 && (
        <div className="px-4 md:px-6 py-1 text-[11px] text-[#8B7CF6] italic font-medium shrink-0 animate-pulse">
          {activeTypers.length === 1
            ? `${activeTypers[0]} is typing...`
            : `${activeTypers.slice(0, 2).join(' and ')} are typing...`}
        </div>
      )}

      {/* Message Composer */}
      <MessageComposer
        conversationId={conversation.id}
        onSendMessage={onSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTyping={onTyping}
        draft={draft}
        onDraftChange={onDraftChange}
      />

      {/* Confirmation Modal for message deletion */}
      <ConfirmDeleteModal
        isOpen={Boolean(pendingDeleteMsgId)}
        onClose={() => setPendingDeleteMsgId(null)}
        onConfirm={() => {
          if (pendingDeleteMsgId) {
            onDeleteMessage(pendingDeleteMsgId);
            setPendingDeleteMsgId(null);
          }
        }}
      />
    </main>
  );
};
