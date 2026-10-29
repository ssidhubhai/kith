/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Member, Conversation, Message, Attachment, TypingIndicator } from './types';
import { ChatEngine, DEFAULT_FRIENDS } from './lib/chatEngine';
import { EntryScreen } from './components/EntryScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { LightboxModal } from './components/LightboxModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';

export default function App() {
  const [currentMember, setCurrentMember] = useState<Member | null>(() => {
    // Check ?autostart=1 parameter
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart');
    const saved = ChatEngine.getCurrentMember();
    if (saved) return saved;
    if (autostart === '1') {
      const alex = DEFAULT_FRIENDS[0];
      const member: Member = {
        id: alex.id,
        display_name: alex.display_name,
        avatar_color: alex.avatar_color,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_online: true
      };
      localStorage.setItem('kith_current_member', JSON.stringify(member));
      return member;
    }
    return null;
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('00000000-0000-0000-0000-000000000001');
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const [activeAttachmentLightbox, setActiveAttachmentLightbox] = useState<Attachment | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('chat');

  const unsubscribeConversationRef = useRef<(() => void) | null>(null);
  const typingTimeoutMap = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Load members and conversations when user is logged in
  const refreshData = useCallback(async () => {
    if (!currentMember) return;
    const [fetchedMembers, fetchedConversations] = await Promise.all([
      ChatEngine.getMembers(),
      ChatEngine.getConversations(currentMember.id)
    ]);
    setMembers(fetchedMembers);
    setConversations(fetchedConversations);

    // If active conversation not in list or blank, select first conversation
    if (fetchedConversations.length > 0) {
      const exists = fetchedConversations.some((c) => c.id === activeConversationId);
      if (!exists) {
        setActiveConversationId(fetchedConversations[0].id);
      }
    }
  }, [currentMember, activeConversationId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Subscribe to presence
  useEffect(() => {
    const unsubPresence = ChatEngine.subscribeToPresence((memberId, isOnline) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, is_online: isOnline } : m))
      );
    });
    return () => unsubPresence();
  }, []);

  // Load messages and subscribe to active conversation
  useEffect(() => {
    if (!currentMember || !activeConversationId) return;

    let isMounted = true;

    // Load initial messages
    ChatEngine.getMessages(activeConversationId, { limit: 50 }).then((res) => {
      if (isMounted) {
        setMessages(res.messages);
        setHasMore(res.hasMore);
      }
    });

    // Mark as read
    ChatEngine.markAsRead(activeConversationId);

    // Clean up previous subscription
    if (unsubscribeConversationRef.current) {
      unsubscribeConversationRef.current();
    }

    // Subscribe to real-time events
    unsubscribeConversationRef.current = ChatEngine.subscribeToConversation(
      activeConversationId,
      {
        onMessage: (msg, action) => {
          setMessages((prev) => {
            if (action === 'insert') {
              // Avoid duplicates if already exists
              if (prev.some((m) => m.id === msg.id)) {
                return prev.map((m) => (m.id === msg.id ? msg : m));
              }
              return [...prev, msg];
            } else if (action === 'update' || action === 'delete') {
              return prev.map((m) => (m.id === msg.id ? msg : m));
            }
            return prev;
          });

          // Refresh conversations to update last message preview
          refreshData();
        },
        onReaction: (reaction, action) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== reaction.message_id) return msg;
              const currentReactions = msg.reactions || [];
              if (action === 'insert') {
                if (
                  currentReactions.some(
                    (r) => r.member_id === reaction.member_id && r.emoji === reaction.emoji
                  )
                ) {
                  return msg;
                }
                return { ...msg, reactions: [...currentReactions, reaction] };
              } else {
                return {
                  ...msg,
                  reactions: currentReactions.filter(
                    (r) => !(r.member_id === reaction.member_id && r.emoji === reaction.emoji)
                  )
                };
              }
            })
          );
        },
        onTyping: (typing) => {
          setTypingIndicators((prev) => {
            const exists = prev.some((t) => t.member_id === typing.member_id);
            if (exists) return prev;
            return [...prev, typing];
          });

          // Clear after 3 seconds
          if (typingTimeoutMap.current.has(typing.member_id)) {
            clearTimeout(typingTimeoutMap.current.get(typing.member_id)!);
          }
          const timer = setTimeout(() => {
            setTypingIndicators((prev) =>
              prev.filter((t) => t.member_id !== typing.member_id)
            );
          }, 3000);
          typingTimeoutMap.current.set(typing.member_id, timer);
        }
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribeConversationRef.current) {
        unsubscribeConversationRef.current();
        unsubscribeConversationRef.current = null;
      }
    };
  }, [activeConversationId, currentMember, refreshData]);

  // Load older messages (pagination)
  const handleLoadMore = async () => {
    if (!activeConversationId || messages.length === 0) return;
    const oldestTimestamp = messages[0].created_at;
    const res = await ChatEngine.getMessages(activeConversationId, {
      limit: 30,
      before: oldestTimestamp
    });
    setMessages((prev) => [...res.messages, ...prev]);
    setHasMore(res.hasMore);
  };

  // Entry screen submit
  const handleEnterApp = async (displayName: string, existingId?: string) => {
    const member = await ChatEngine.setCurrentMember(displayName, existingId);
    setCurrentMember(member);
    refreshData();
  };

  // Change display name
  const handleUpdateDisplayName = async (newName: string) => {
    const member = await ChatEngine.setCurrentMember(newName, currentMember?.id);
    setCurrentMember(member);
    refreshData();
  };

  // Send message
  const handleSendMessage = async (
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ) => {
    if (!activeConversationId) return;
    await ChatEngine.sendMessage(activeConversationId, content, replyToId, attachments);
  };

  // Edit message
  const handleEditMessage = async (messageId: string, newContent: string) => {
    await ChatEngine.editMessage(messageId, newContent);
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    await ChatEngine.deleteMessage(messageId);
  };

  // Toggle reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeConversationId) return;
    await ChatEngine.toggleReaction(activeConversationId, messageId, emoji);
  };

  // Start direct chat with friend
  const handleStartDirectChat = async (targetMember: Member) => {
    const directConv = await ChatEngine.getOrCreateDirectConversation(targetMember);
    await refreshData();
    setActiveConversationId(directConv.id);
    setMobileView('chat');
  };

  // Select conversation
  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setMobileView('chat');
  };

  // Broadcast typing
  const handleTyping = () => {
    if (activeConversationId) {
      ChatEngine.sendTyping(activeConversationId);
    }
  };

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || {
    id: activeConversationId,
    type: 'group' as const,
    title: 'The Collective',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!currentMember) {
    return <EntryScreen onEnter={handleEnterApp} currentMember={currentMember} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-[#171717] font-sans antialiased">
      {/* Sidebar (Desktop visible, Mobile conditionally visible) */}
      <div
        className={`${
          mobileView === 'sidebar' ? 'block' : 'hidden'
        } md:block h-full w-full md:w-auto shrink-0`}
      >
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          members={members}
          currentMember={currentMember}
          onStartDirectChat={handleStartDirectChat}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onUpdateDisplayName={handleUpdateDisplayName}
        />
      </div>

      {/* Main Chat Area (Desktop visible, Mobile conditionally visible) */}
      <div
        className={`${
          mobileView === 'chat' ? 'flex' : 'hidden'
        } md:flex flex-1 h-full min-w-0`}
      >
        <ChatArea
          conversation={activeConversation}
          messages={messages}
          currentMember={currentMember}
          members={members}
          typingIndicators={typingIndicators}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
          onOpenAttachment={(att) => setActiveAttachmentLightbox(att)}
          onBackToSidebar={() => setMobileView('sidebar')}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onTyping={handleTyping}
        />
      </div>

      {/* Lightbox for full image/video view */}
      <LightboxModal
        attachment={activeAttachmentLightbox}
        onClose={() => setActiveAttachmentLightbox(null)}
      />

      {/* Supabase Setup & SQL Migration Modal */}
      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigUpdated={() => refreshData()}
      />
    </div>
  );
}
