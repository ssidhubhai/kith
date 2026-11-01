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
import { OfflineIndicator } from './components/OfflineIndicator';
import { useVisualViewport } from './hooks/useVisualViewport';


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

  const { viewportHeight, isKeyboardOpen } = useVisualViewport();

  const unsubscribeConversationRef = useRef<(() => void) | null>(null);
  const typingTimeoutMap = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Connection state listener
  useEffect(() => {
    const unsub = ChatEngine.subscribeToConnectionState((state) => {
      setConnectionState(state);
      // Auto-reconcile messages if transitioning back to connected
      if (state === 'connected' && activeConversationId && currentMember) {
        ChatEngine.getMessages(activeConversationId, { limit: 50 }).then((res) => {
          setMessages((prev) => {
            const map = new Map<string, Message>();
            prev.forEach((m) => map.set(m.id, m));
            res.messages.forEach((m) => map.set(m.id, m));
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        });
      }
    });
    return () => unsub();
  }, [activeConversationId, currentMember]);



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


  // Root beforeinstallprompt listener to capture install event at application level
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('KithChat root: beforeinstallprompt captured.');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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

    // If no conversation currently active, default to the first one (Collective)
    setActiveConversationId((prevId) => {
      if (!prevId && fetchedConversations.length > 0) {
        return fetchedConversations[0].id;
      }
      return prevId;
    });
  }, [currentMember]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Network online recovery listener
  useEffect(() => {
    const handleReconnect = () => {
      if (activeConversationId && currentMember) {
        ChatEngine.reconcileState(activeConversationId).then((res) => {
          if (res.messages && res.messages.length > 0) {
            setMessages((prev) => {
              const map = new Map<string, Message>();
              prev.forEach((m) => map.set(m.id, m));
              res.messages!.forEach((m) => map.set(m.id, m));
              return Array.from(map.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
          refreshData();
        });
      }
    };

    window.addEventListener('online', handleReconnect);
    return () => window.removeEventListener('online', handleReconnect);
  }, [activeConversationId, currentMember, refreshData]);

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
                updated[idx] = {
                  ...prev[idx],
                  ...msg,
                  attachments: (msg.attachments && msg.attachments.length > 0) ? msg.attachments : prev[idx].attachments,
                  status: 'sent'
                };
                return updated;
              }
              const next = [...prev, msg];
              return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            } else if (action === 'update' || action === 'delete') {
              return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
            }
            return prev;
          });

          // Optimistically update conversation list preview without heavy network re-fetch
          setConversations((prev) => {
            return prev.map((c) => {
              if (c.id === msg.conversation_id) {
                return {
                  ...c,
                  last_message: msg,
                  updated_at: msg.created_at
                };
              }
              return c;
            }).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
          });
        },
        onAttachmentInsert: (att) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === att.message_id) {
                const existing = m.attachments || [];
                if (existing.some((a) => a.id === att.id)) return m;
                return { ...m, attachments: [...existing, att] };
              }
              return m;
            })
          );
        },
        onReaction: (reaction, action) => {
          setMessages((prev) =>
            prev.map((msg) => {
              const currentReactions = msg.reactions || [];
              if (action === 'insert') {
                if (msg.id !== reaction.message_id) return msg;
                if (
                  currentReactions.some(
                    (r) => (reaction.id && r.id === reaction.id) || (r.member_id === reaction.member_id && r.emoji === reaction.emoji)
                  )
                ) {
                  return msg;
                }
                return { ...msg, reactions: [...currentReactions, reaction] };
              } else {
                // Delete action: reaction might match by id OR by (message_id, member_id, emoji)
                const isTargetMsg = reaction.message_id ? msg.id === reaction.message_id : currentReactions.some((r) => r.id === reaction.id);
                if (!isTargetMsg) return msg;

                return {
                  ...msg,
                  reactions: currentReactions.filter(
                    (r) =>
                      !(
                        (reaction.id && r.id === reaction.id) ||
                        (r.member_id === reaction.member_id && r.emoji === reaction.emoji)
                      )
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
  const handleEnterApp = async (
    displayName: string,
    existingId?: string,
    initialProfile?: Partial<Member>
  ) => {
    const member = await ChatEngine.setCurrentMember(displayName, existingId, initialProfile);
    setCurrentMember(member);
    refreshData();
  };

  // Profile save
  const handleSaveProfile = async (updates: Partial<Member>) => {
    const updated = await ChatEngine.updateCurrentMemberProfile(updates);
    setCurrentMember(updated);
    refreshData();
  };

  // Send message with failure throwing to preserve composer state
  const handleSendMessage = useCallback(async (
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ) => {
    if (!activeConversationId) return;
    const sent = await ChatEngine.sendMessage(activeConversationId, content, replyToId, attachments);
    if (sent.status === 'failed') {
      throw new Error(sent.error || 'Failed to send message. Please retry.');
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, last_message: sent, updated_at: sent.created_at }
          : c
      )
    );
  }, [activeConversationId]);

  // Retry failed message
  const handleRetryMessage = useCallback(async (msg: Message) => {
    await ChatEngine.retryFailedMessage(msg);
  }, []);

  // Forward message
  const handleForwardMessage = useCallback(async (targetConvId: string) => {
    if (!forwardingMessage) return;
    await ChatEngine.forwardMessage(forwardingMessage, targetConvId);
    setForwardingMessage(null);
    setActiveConversationId(targetConvId);
    setMobileView('chat');
    window.history.pushState({ view: 'chat', convId: targetConvId }, '');
    refreshData();
  }, [forwardingMessage, refreshData]);

  // Edit message
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    await ChatEngine.editMessage(messageId, newContent);
  }, []);

  // Delete message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    await ChatEngine.deleteMessage(messageId);
  }, []);

  // Toggle reaction
  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!activeConversationId) return;
    await ChatEngine.toggleReaction(activeConversationId, messageId, emoji);
  }, [activeConversationId]);

  // Start direct chat with friend
  const handleStartDirectChat = useCallback(async (targetMember: Member) => {
    try {
      const directConv = await ChatEngine.getOrCreateDirectConversation(targetMember);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === directConv.id);
        return exists ? prev : [directConv, ...prev];
      });
      setActiveConversationId(directConv.id);
      const cached = ChatEngine.getCachedMessages(directConv.id);
      setMessages(cached);
      setMobileView('chat');
      if (window.history.state?.convId !== directConv.id) {
        window.history.pushState({ view: 'chat', convId: directConv.id }, '');
      }
    } catch (err) {
      console.error('Failed to open direct conversation:', err);
    }
  }, []);

  // Delete unwanted/stale friend or account
  const handleDeleteMember = useCallback(async (memberId: string) => {
    try {
      await ChatEngine.deleteMember(memberId);
      refreshData();
    } catch (err) {
      console.error('Failed to delete member:', err);
    }
  }, [refreshData]);

  // Select conversation with instantaneous cached message loading to eliminate stale flash
  const handleSelectConversation = useCallback((convId: string) => {
    if (convId === activeConversationId) {
      setMobileView('chat');
      return;
    }
    setActiveConversationId(convId);
    const cached = ChatEngine.getCachedMessages(convId);
    setMessages(cached);
    setMobileView('chat');
    if (window.history.state?.view !== 'chat' || window.history.state?.convId !== convId) {
      window.history.pushState({ view: 'chat', convId }, '');
    }
  }, [activeConversationId]);

  // Back to conversation list on mobile
  const handleBackToSidebar = useCallback(() => {
    setMobileView('sidebar');
    if (window.history.state?.view === 'chat') {
      window.history.back();
    }
  }, []);

  // Broadcast typing
  const handleTyping = useCallback(() => {
    if (activeConversationId) {
      ChatEngine.sendTyping(activeConversationId);
    }
  }, [activeConversationId]);

  // Draft change handler
  const handleDraftChange = useCallback((newDraft: string) => {
    setDrafts((prev) => {
      if (prev[activeConversationId] === newDraft) return prev;
      return { ...prev, [activeConversationId]: newDraft };
    });
  }, [activeConversationId]);

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
    <div
      style={isKeyboardOpen && viewportHeight ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` } : undefined}
      className="fixed inset-0 flex h-[100dvh] w-full overflow-hidden bg-[#FAF8F5] text-[#24212B] font-sans antialiased"
    >
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
          onDeleteMember={handleDeleteMember}
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
          onDraftChange={handleDraftChange}
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
        onDeleteMember={handleDeleteMember}
      />

      {/* Message Forward Modal */}
      <ForwardModal
        isOpen={Boolean(forwardingMessage)}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        conversations={conversations}
        onForward={handleForwardMessage}
      />

      {/* Offline connectivity indicator banner */}
      <OfflineIndicator />
    </div>
  );
}
