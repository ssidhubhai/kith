import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Search,
  Database,
  ArrowDown,
  Users,
  Info,
  X
} from 'lucide-react';
import { Conversation, Message, Member, Attachment, TypingIndicator } from '../types';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { formatDateDivider, groupMessages } from '../utils/messageGrouping';
import { filterMessagesByQuery } from '../utils/conversationUtils';

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
  onTyping
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter messages if search query active
  const displayedMessages = searchQuery.trim()
    ? filterMessagesByQuery(messages, searchQuery)
    : messages;

  // Group messages
  const messageGroups = groupMessages(displayedMessages);

  // Auto-scroll to bottom on new message unless scrolled up
  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isScrolledUp]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsScrolledUp(distanceFromBottom > 150);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-[#F5F5F5]');
      setTimeout(() => el.classList.remove('bg-[#F5F5F5]'), 1500);
    }
  };

  // Find participants for status line
  const activeTypers = typingIndicators
    .filter((t) => t.conversation_id === conversation.id && t.member_id !== currentMember.id)
    .map((t) => t.display_name);

  // Header subtitle
  let subtitle = '';
  if (conversation.type === 'group') {
    const onlineCount = members.filter((m) => m.is_online).length;
    subtitle = `${members.length} members · ${onlineCount} online`;
  } else {
    const otherId = conversation.participant_ids?.find((id) => id !== currentMember.id);
    const other = members.find((m) => m.id === otherId);
    subtitle = other?.is_online ? 'Active now' : 'Offline';
  }

  return (
    <main
      aria-label="Chat conversation view"
      className="flex-1 flex flex-col h-full bg-white relative overflow-hidden"
    >
      {/* Top Header Bar */}
      <header className="px-4 md:px-6 py-3 border-b border-[#E5E5E5] flex items-center justify-between gap-4 bg-white z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          {onBackToSidebar && (
            <button
              type="button"
              onClick={onBackToSidebar}
              aria-label="Back to conversations list"
              className="md:hidden p-1 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#171717] tracking-tight truncate">
              {conversation.title}
            </h2>
            <p className="text-[11px] text-[#737373] truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Top bar right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {showSearch ? (
            <div className="flex items-center gap-1.5 border border-[#171717] px-2 py-1 bg-white">
              <Search className="w-3.5 h-3.5 text-[#737373]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-32 sm:w-48 text-xs text-[#171717] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearch(false);
                }}
                aria-label="Close search"
                className="text-[#737373] hover:text-[#171717]"
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
              className="p-1.5 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSupabaseModal}
            title="Database & Storage Settings"
            aria-label="Database settings"
            className="p-1.5 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Message Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 space-y-4"
      >
        {/* Load older messages button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              type="button"
              onClick={onLoadMore}
              className="px-3 py-1 text-xs text-[#737373] hover:text-[#171717] border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-white transition-colors cursor-pointer"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {/* Message Groups */}
        {messageGroups.length > 0 ? (
          messageGroups.map((group, groupIdx) => {
            const firstMsg = group.messages[0];
            const prevGroup = groupIdx > 0 ? messageGroups[groupIdx - 1] : null;
            const showDateDivider = !prevGroup || prevGroup.dateKey !== group.dateKey;

            return (
              <div key={`group-${groupIdx}-${group.dateKey}-${group.senderId}`}>
                {/* Date Divider */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider bg-white px-3">
                      {formatDateDivider(firstMsg.created_at)}
                    </span>
                  </div>
                )}

                {/* Group messages */}
                <div className="space-y-0.5">
                  {group.messages.map((msg, msgIdx) => (
                    <MessageItem
                      key={msg.id}
                      message={msg}
                      currentMember={currentMember}
                      isFirstInGroup={msgIdx === 0}
                      onReply={(targetMsg) => setReplyingTo(targetMsg)}
                      onEdit={onEditMessage}
                      onDelete={onDeleteMessage}
                      onToggleReaction={onToggleReaction}
                      onOpenAttachment={onOpenAttachment}
                      onScrollToMessage={handleScrollToMessage}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center px-4">
            <p className="text-xs text-[#737373]">
              {searchQuery ? 'No messages matched your search.' : 'No messages yet. Send a message or share a file.'}
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
          className="absolute bottom-20 right-6 z-20 px-3 py-1.5 bg-[#171717] text-white text-xs font-medium shadow-md flex items-center gap-1.5 hover:bg-[#262626] transition-colors cursor-pointer"
        >
          <span>Latest</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Typing indicator */}
      {activeTypers.length > 0 && (
        <div className="px-4 md:px-6 py-1 bg-white text-[11px] text-[#737373] italic">
          {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Message Composer */}
      <MessageComposer
        conversationId={conversation.id}
        onSendMessage={onSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTyping={onTyping}
      />
    </main>
  );
};
