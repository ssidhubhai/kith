/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Member, Conversation, Message, Attachment, TypingIndicator, ConnectionState } from './types';
import { ChatEngine } from './lib/chatEngine';
import { getSupabase } from './lib/supabaseClient';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { LightboxModal } from './components/LightboxModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { FriendProfileCard } from './components/FriendProfileCard';
import { ForwardModal } from './components/ForwardModal';


export default function App() {
  const [currentMember, setCurrentMember] = useState<Member | null>(() => {
    // Check ?autostart=1 parameter
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart');
    const saved = ChatEngine.getCurrentMember();
    if (saved) return saved;
    if (autostart === '1') {
      const member: Member = {
        id: crypto.randomUUID(),
        display_name: 'Member',
        avatar_color: '#8B7CF6',
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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [inspectingMember, setInspectingMember] = useState<Member | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'sidebar';
    }
    return 'chat';
  });

  const unsubscribeConversationRef = useRef<(() => void) | null>(null);
  const typingTimeoutMap = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Connection state listener
  useEffect(() => {
    const unsub = ChatEngine.subscribeToConnectionState((state) => {
      setConnectionState(state);
    });
    return () => unsub();
  }, []);

  // Supabase Auth session restoration and state listener
  useEffect(() => {
    ChatEngine.fetchAuthenticatedMember().then((member) => {
      if (member) {
        setCurrentMember(member);
      }
    });

    const supabase = getSupabase();
    if (supabase) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            const member = await ChatEngine.fetchAuthenticatedMember();
            if (member) {
              setCurrentMember(member);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentMember(null);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);


  // Handle browser back button on mobile
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view === 'chat' && e.state.convId) {
        setActiveConversationId(e.state.convId);
        setMobileView('chat');
      } else {
        setMobileView('sidebar');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // Subscribe to presence and member directory updates
  useEffect(() => {
    if (currentMember) {
      ChatEngine.initGlobalRealtime();
    }
    const unsubPresence = ChatEngine.subscribeToPresence((memberId, isOnline) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, is_online: isOnline } : m))
      );
    });
    const unsubMembers = ChatEngine.subscribeToMembers((newMembers) => {
      setMembers(newMembers);
    });
    return () => {
      unsubPresence();
      unsubMembers();
    };
  }, [currentMember]);

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
              const idx = prev.findIndex((m) => m.id === msg.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...prev[idx], ...msg, status: 'sent' };
                return updated;
              }
              return [...prev, msg];
            } else if (action === 'update' || action === 'delete') {
              return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
            }
            return prev;
          });

          // Refresh conversations to update last message preview and unread counts
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

  // Profile save
  const handleSaveProfile = async (updates: Partial<Member>) => {
    const updated = await ChatEngine.updateCurrentMemberProfile(updates);
    setCurrentMember(updated);
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

  // Retry failed message
  const handleRetryMessage = async (msg: Message) => {
    await ChatEngine.retryFailedMessage(msg);
  };

  // Forward message
  const handleForwardMessage = async (targetConvId: string) => {
    if (!forwardingMessage) return;
    await ChatEngine.forwardMessage(forwardingMessage, targetConvId);
    setForwardingMessage(null);
    setActiveConversationId(targetConvId);
    setMobileView('chat');
    window.history.pushState({ view: 'chat', convId: targetConvId }, '');
    refreshData();
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
    window.history.pushState({ view: 'chat', convId: directConv.id }, '');
  };

  // Select conversation
  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setMobileView('chat');
    if (window.history.state?.view !== 'chat' || window.history.state?.convId !== convId) {
      window.history.pushState({ view: 'chat', convId }, '');
    }
  };

  // Back to conversation list on mobile
  const handleBackToSidebar = () => {
    setMobileView('sidebar');
    if (window.history.state?.view === 'chat') {
      window.history.back();
    }
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

  const handleSignOut = async () => {
    await ChatEngine.signOut();
    setCurrentMember(null);
    setMessages([]);
    setConversations([]);
    setMembers([]);
  };

  if (!currentMember) {
    return (
      <>
        <AuthScreen
          onAuthenticated={(member) => {
            setCurrentMember(member);
            refreshData();
          }}
          onOpenConfigModal={() => setIsSupabaseModalOpen(true)}
        />
        <SupabaseSetupModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          onConfigUpdated={() => refreshData()}
        />
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FAF8F5] text-[#24212B] font-sans antialiased">
      {/* Sidebar (Desktop always visible, Mobile conditionally visible) */}
      <div
        className={`${
          mobileView === 'sidebar' ? 'flex' : 'hidden'
        } md:flex flex-col h-full w-full md:w-80 lg:w-88 shrink-0 border-r border-[#EAE5E0] bg-[#FAF8F5]`}
      >
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          members={members}
          currentMember={currentMember}
          onStartDirectChat={handleStartDirectChat}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onUpdateDisplayName={(newName) => handleSaveProfile({ display_name: newName })}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenFriendProfile={(m) => setInspectingMember(m)}
        />
      </div>

      {/* Main Chat Area (Desktop always visible, Mobile conditionally visible) */}
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
          onBackToSidebar={handleBackToSidebar}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onTyping={handleTyping}
          draft={drafts[activeConversationId] || ''}
          onDraftChange={(newDraft) =>
            setDrafts((prev) => ({ ...prev, [activeConversationId]: newDraft }))
          }
          connectionState={connectionState}
          lastReadTime={ChatEngine.getLastReadTime(activeConversationId)}
          onForwardMessage={(msg) => setForwardingMessage(msg)}
          onOpenFriendProfile={(m) => setInspectingMember(m)}
          onRetryMessage={handleRetryMessage}
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

      {/* Account Settings & Profile Modal */}
      <AccountSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentMember={currentMember}
        onSaveProfile={handleSaveProfile}
        onSignOut={handleSignOut}
      />


      {/* Friend Profile Card */}
      <FriendProfileCard
        member={inspectingMember}
        onClose={() => setInspectingMember(null)}
        onStartDirectChat={handleStartDirectChat}
        isCurrentUser={inspectingMember?.id === currentMember.id}
        onEditProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Message Forward Modal */}
      <ForwardModal
        isOpen={Boolean(forwardingMessage)}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        conversations={conversations}
        onForward={handleForwardMessage}
      />
    </div>
  );
}
