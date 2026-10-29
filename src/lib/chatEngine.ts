import {
  Member,
  Conversation,
  Message,
  Attachment,
  Reaction,
  TypingIndicator
} from '../types';
import { getSupabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sanitizeFilename, validateFileSize } from '../utils/fileValidation';
import { getDirectConversationKey } from '../utils/conversationUtils';

const DEFAULT_GROUP_ID = '00000000-0000-0000-0000-000000000001';
const CURRENT_MEMBER_STORAGE_KEY = 'kith_current_member';
const LOCAL_MESSAGES_KEY = 'kith_local_messages';
const LOCAL_MEMBERS_KEY = 'kith_local_members';
const LOCAL_CONVERSATIONS_KEY = 'kith_local_conversations';
const LOCAL_REACTIONS_KEY = 'kith_local_reactions';
const LOCAL_READ_STATES_KEY = 'kith_local_read_states';

// Self-clean any legacy dummy seeds from browser storage
if (typeof window !== 'undefined') {
  try {
    const rawMsgs = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (rawMsgs && (rawMsgs.includes('seed-msg-') || rawMsgs.includes('The Collective'))) {
      const parsed = JSON.parse(rawMsgs);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(m => !m.id?.startsWith('seed-'));
        localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(cleaned));
      }
    }
    const rawMembers = localStorage.getItem(LOCAL_MEMBERS_KEY);
    if (rawMembers && rawMembers.includes('11111111-1111-1111-1111-111111111111')) {
      const parsed = JSON.parse(rawMembers);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(m => !m.id?.startsWith('11111111-') && !m.id?.startsWith('22222222-') && !m.id?.startsWith('33333333-') && !m.id?.startsWith('44444444-'));
        localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(cleaned));
      }
    }
  } catch {
    // ignore
  }
}

// Multi-tab broadcast channel
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('kith_realtime_mesh')
  : null;

// Realtime listeners map: conversationId -> Set of callbacks
type MessageCallback = (message: Message, action: 'insert' | 'update' | 'delete') => void;
type ReactionCallback = (reaction: Reaction, action: 'insert' | 'delete') => void;
type TypingCallback = (typing: TypingIndicator) => void;
type PresenceCallback = (memberId: string, isOnline: boolean) => void;
type ConnectionCallback = (state: 'connected' | 'reconnecting' | 'offline') => void;

interface ConversationListeners {
  messageCallbacks: Set<MessageCallback>;
  reactionCallbacks: Set<ReactionCallback>;
  typingCallbacks: Set<TypingCallback>;
}

const listeners = new Map<string, ConversationListeners>();
const presenceListeners = new Set<PresenceCallback>();
const connectionListeners = new Set<ConnectionCallback>();
const onlineMemberSet = new Set<string>();
let currentConnectionState: 'connected' | 'reconnecting' | 'offline' = 'connected';

function notifyConnectionState(state: 'connected' | 'reconnecting' | 'offline') {
  currentConnectionState = state;
  connectionListeners.forEach(cb => cb(state));
}

// Window network listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => notifyConnectionState('connected'));
  window.addEventListener('offline', () => notifyConnectionState('offline'));
}

function broadcast(type: string, payload: unknown) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload });
    } catch {
      // ignore
    }
  }
}

// Setup incoming broadcast listener for multi-tab sync
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    const { type, payload } = event.data || {};
    if (!type || !payload) return;

    if (type === 'message_insert' || type === 'message_update' || type === 'message_delete') {
      const msg = payload as Message;
      const convListeners = listeners.get(msg.conversation_id);
      if (convListeners) {
        const action = type === 'message_insert' ? 'insert' : type === 'message_update' ? 'update' : 'delete';
        convListeners.messageCallbacks.forEach(cb => cb(msg, action));
      }
    } else if (type === 'reaction_insert' || type === 'reaction_delete') {
      const reaction = payload as { reaction: Reaction; conversation_id: string };
      const convListeners = listeners.get(reaction.conversation_id);
      if (convListeners) {
        const action = type === 'reaction_insert' ? 'insert' : 'delete';
        convListeners.reactionCallbacks.forEach(cb => cb(reaction.reaction, action));
      }
    } else if (type === 'typing') {
      const typing = payload as TypingIndicator;
      const convListeners = listeners.get(typing.conversation_id);
      if (convListeners) {
        convListeners.typingCallbacks.forEach(cb => cb(typing));
      }
    } else if (type === 'presence') {
      const { member_id, is_online } = payload as { member_id: string; is_online: boolean };
      if (is_online) {
        onlineMemberSet.add(member_id);
      } else {
        onlineMemberSet.delete(member_id);
      }
      presenceListeners.forEach(cb => cb(member_id, is_online));
    }
  };
}

export class ChatEngine {
  /**
   * Clears all local application and chat data to start 100% fresh
   */
  static clearAllData(): void {
    try {
      localStorage.removeItem(CURRENT_MEMBER_STORAGE_KEY);
      localStorage.removeItem(LOCAL_MESSAGES_KEY);
      localStorage.removeItem(LOCAL_MEMBERS_KEY);
      localStorage.removeItem(LOCAL_CONVERSATIONS_KEY);
      localStorage.removeItem(LOCAL_REACTIONS_KEY);
      localStorage.removeItem(LOCAL_READ_STATES_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * Loads current user identity from localStorage
   */
  static getCurrentMember(): Member | null {
    try {
      const data = localStorage.getItem(CURRENT_MEMBER_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Sets or updates current user identity
   */
  static async setCurrentMember(displayName: string, existingId?: string): Promise<Member> {
    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new Error('Display name cannot be empty');
    }

    const current = this.getCurrentMember();
    const memberId = existingId || current?.id || crypto.randomUUID();
    const avatarColors = ['#171717', '#262626', '#404040', '#525252', '#0A0A0A'];
    const avatarColor = current?.avatar_color || avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const member: Member = {
      id: memberId,
      display_name: trimmed,
      avatar_color: avatarColor,
      last_seen_at: new Date().toISOString(),
      created_at: current?.created_at || new Date().toISOString(),
      is_online: true
    };

    localStorage.setItem(CURRENT_MEMBER_STORAGE_KEY, JSON.stringify(member));

    // Persist into members list & Supabase
    await this.upsertMemberRecord(member);

    // Broadcast presence
    broadcast('presence', { member_id: member.id, is_online: true });
    onlineMemberSet.add(member.id);

    return member;
  }

  /**
   * Updates current user's profile and broadcasts to peers
   */
  static async updateCurrentMemberProfile(updates: Partial<Member>): Promise<Member> {
    const current = this.getCurrentMember();
    if (!current) throw new Error('Not logged in');

    const updated: Member = {
      ...current,
      ...updates,
      id: current.id,
      display_name: updates.display_name?.trim() || current.display_name
    };

    localStorage.setItem(CURRENT_MEMBER_STORAGE_KEY, JSON.stringify(updated));
    await this.upsertMemberRecord(updated);

    broadcast('member_profile_updated', updated);
    return updated;
  }

  /**
   * Upserts member into Supabase or local store
   */
  private static async upsertMemberRecord(member: Member): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('members').upsert({
          id: member.id,
          display_name: member.display_name,
          nickname: member.nickname || null,
          avatar_url: member.avatar_url || null,
          avatar_color: member.avatar_color,
          status_text: member.status_text || null,
          hide_last_seen: Boolean(member.hide_last_seen),
          last_seen_at: new Date().toISOString()
        });

        // Ensure default group conversation exists in Supabase
        await supabase.from('conversations').upsert({
          id: DEFAULT_GROUP_ID,
          type: 'group',
          title: 'The Collective'
        }, { onConflict: 'id' });

        // Join default conversation
        await supabase.from('conversation_members').upsert({
          conversation_id: DEFAULT_GROUP_ID,
          member_id: member.id
        }, { onConflict: 'conversation_id,member_id' });
      } catch (err) {
        console.warn('Supabase member upsert error, falling back to local:', err);
      }
    }

    // Always update local cache
    const members = this.getLocalMembers();
    const idx = members.findIndex(m => m.id === member.id);
    if (idx >= 0) {
      members[idx] = { ...members[idx], ...member, last_seen_at: new Date().toISOString() };
    } else {
      members.push(member);
    }
    localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(members));
  }

  /**
   * Returns list of discoverable members
   */
  static async getMembers(): Promise<Member[]> {
    const current = this.getCurrentMember();
    const supabase = getSupabase();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .order('display_name', { ascending: true });

        if (!error && data) {
          return data.map(m => ({
            ...m,
            is_online: m.id === current?.id || onlineMemberSet.has(m.id)
          }));
        }
      } catch (err) {
        console.warn('Error fetching members from Supabase, using local:', err);
      }
    }

    // Local fallback
    const local = this.getLocalMembers();
    return local.map(m => ({
      ...m,
      is_online: m.id === current?.id || onlineMemberSet.has(m.id)
    }));
  }

  /**
   * Internal helper for local members store
   */
  private static getLocalMembers(): Member[] {
    try {
      const raw = localStorage.getItem(LOCAL_MEMBERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Returns list of conversations for current member (Group chat + Direct chats)
   */
  static async getConversations(memberId: string): Promise<Conversation[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Query group and direct conversations
        const { data: convs, error } = await supabase
          .from('conversations')
          .select(`
            *,
            conversation_members (member_id)
          `)
          .order('updated_at', { ascending: false });

        if (!error && convs) {
          const list: Conversation[] = [];
          for (const c of convs) {
            const memberIds = (c.conversation_members || []).map((cm: { member_id: string }) => cm.member_id);
            if (c.type === 'group' || memberIds.includes(memberId)) {
              // Fetch last message
              const { data: lastMsg } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', c.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              list.push({
                id: c.id,
                type: c.type,
                title: c.title,
                created_at: c.created_at,
                updated_at: c.updated_at,
                participant_ids: memberIds,
                last_message: lastMsg || undefined,
                unread_count: 0
              });
            }
          }
          if (list.length > 0) {
            return list;
          }

          // If no conversations exist in Supabase yet, create default group
          await supabase.from('conversations').insert({
            id: DEFAULT_GROUP_ID,
            type: 'group',
            title: 'The Collective'
          });
          return [{
            id: DEFAULT_GROUP_ID,
            type: 'group',
            title: 'The Collective',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            participant_ids: [memberId],
            unread_count: 0
          }];
        }
      } catch (err) {
        console.warn('Supabase getConversations error:', err);
      }
    }

    // Local fallback
    return this.getLocalConversations(memberId);
  }

  /**
   * Local conversations store
   */
  private static getLocalConversations(memberId: string): Conversation[] {
    try {
      const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const messages = this.getLocalMessages();
          const readStates = this.getReadStates();

          return parsed
            .filter((c: Conversation) => c.type === 'group' || (c.participant_ids && c.participant_ids.includes(memberId)))
            .map((c: Conversation) => {
              const convMsgs = messages.filter(m => m.conversation_id === c.id);
              const lastMsg = convMsgs[convMsgs.length - 1];
              const lastRead = readStates[c.id] || 0;
              const unread = convMsgs.filter(m => m.sender_id !== memberId && new Date(m.created_at).getTime() > lastRead).length;

              return {
                ...c,
                last_message: lastMsg,
                unread_count: unread
              };
            });
        }
      }
    } catch {
      // ignore
    }

    // Default Group conversation without any dummy messages
    const defaultGroup: Conversation = {
      id: DEFAULT_GROUP_ID,
      type: 'group',
      title: 'The Collective',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      participant_ids: memberId ? [memberId] : [],
      unread_count: 0
    };

    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify([defaultGroup]));
    return [defaultGroup];
  }

  /**
   * Retrieves or creates a 1-on-1 direct conversation with another member
   */
  static async getOrCreateDirectConversation(targetMember: Member): Promise<Conversation> {
    const current = this.getCurrentMember();
    if (!current) throw new Error('Not logged in');

    const pairKey = getDirectConversationKey(current.id, targetMember.id);
    const supabase = getSupabase();

    if (supabase) {
      try {
        const { data: convMembers } = await supabase
          .from('conversation_members')
          .select('conversation_id, member_id')
          .in('member_id', [current.id, targetMember.id]);

        if (convMembers && convMembers.length > 0) {
          const counts: Record<string, number> = {};
          convMembers.forEach(cm => {
            counts[cm.conversation_id] = (counts[cm.conversation_id] || 0) + 1;
          });
          const matchId = Object.keys(counts).find(id => counts[id] === 2);
          if (matchId) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', matchId)
              .single();
            if (conv) {
              return {
                id: conv.id,
                type: 'direct',
                title: targetMember.display_name,
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                participant_ids: [current.id, targetMember.id]
              };
            }
          }
        }

        // Create new direct conversation
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            type: 'direct',
            title: targetMember.display_name
          })
          .select()
          .single();

        if (!error && newConv) {
          await supabase.from('conversation_members').insert([
            { conversation_id: newConv.id, member_id: current.id },
            { conversation_id: newConv.id, member_id: targetMember.id }
          ]);

          return {
            id: newConv.id,
            type: 'direct',
            title: targetMember.display_name,
            created_at: newConv.created_at,
            updated_at: newConv.updated_at,
            participant_ids: [current.id, targetMember.id]
          };
        }
      } catch (err) {
        console.warn('Supabase direct conversation creation error:', err);
      }
    }

    // Local fallback
    const localConvs = this.getLocalConversations(current.id);
    const existing = localConvs.find(
      c => c.type === 'direct' &&
        c.participant_ids?.includes(current.id) &&
        c.participant_ids?.includes(targetMember.id)
    );

    if (existing) {
      return existing;
    }

    const newDirect: Conversation = {
      id: `conv_${pairKey.replace(':', '_')}`,
      type: 'direct',
      title: targetMember.display_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      participant_ids: [current.id, targetMember.id],
      unread_count: 0
    };

    localConvs.unshift(newDirect);
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(localConvs));
    return newDirect;
  }

  /**
   * Retrieves messages for a conversation
   */
  static async getMessages(
    conversationId: string,
    options: { limit?: number; before?: string } = {}
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const limit = options.limit || 50;
    const supabase = getSupabase();

    if (supabase) {
      try {
        let query = supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id (display_name, avatar_color, avatar_url, nickname, status_text),
            attachments (*),
            reactions:message_reactions (*)
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(limit + 1);

        if (options.before) {
          query = query.lt('created_at', options.before);
        }

        const { data, error } = await query;
        if (!error && data) {
          const hasMore = data.length > limit;
          const trimmed = hasMore ? data.slice(0, limit) : data;
          const mapped: Message[] = trimmed.map(m => ({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            sender_name: m.sender?.display_name || 'Friend',
            sender_avatar_color: m.sender?.avatar_color || '#8B7CF6',
            sender_avatar_url: m.sender?.avatar_url,
            is_forwarded: m.is_forwarded,
            forwarded_from: m.forwarded_from,
            content: m.content,
            message_type: m.message_type,
            reply_to_message_id: m.reply_to_message_id,
            created_at: m.created_at,
            updated_at: m.updated_at,
            deleted_at: m.deleted_at,
            attachments: m.attachments || [],
            reactions: m.reactions || [],
            status: 'sent'
          }));

          return { messages: mapped.reverse(), hasMore };
        }
      } catch (err) {
        console.warn('Supabase getMessages error:', err);
      }
    }

    // Local fallback
    const all = this.getLocalMessages().filter(m => m.conversation_id === conversationId);
    let filtered = all;
    if (options.before) {
      const beforeTime = new Date(options.before).getTime();
      filtered = all.filter(m => new Date(m.created_at).getTime() < beforeTime);
    }

    const startIndex = Math.max(0, filtered.length - limit);
    const hasMore = startIndex > 0;
    const page = filtered.slice(startIndex);

    return { messages: page, hasMore };
  }

  private static getLocalMessages(): Message[] {
    try {
      const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Sends a message with optional reply, attachments, and forwarding attribution
   */
  static async sendMessage(
    conversationId: string,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[],
    metadata?: { is_forwarded?: boolean; forwarded_from?: string }
  ): Promise<Message> {
    const current = this.getCurrentMember();
    if (!current) throw new Error('Not logged in');

    const trimmed = content.trim();
    if (!trimmed && (!attachments || attachments.length === 0)) {
      throw new Error('Message cannot be empty');
    }

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    let replySnippet = null;
    if (replyToId) {
      const localMsgs = this.getLocalMessages();
      const parent = localMsgs.find(m => m.id === replyToId);
      if (parent) {
        replySnippet = {
          id: parent.id,
          sender_name: parent.sender_name || 'Friend',
          content: parent.content
        };
      }
    }

    const optimisticMessage: Message = {
      id: msgId,
      conversation_id: conversationId,
      sender_id: current.id,
      sender_name: current.display_name,
      sender_avatar_color: current.avatar_color,
      sender_avatar_url: current.avatar_url,
      content: trimmed,
      message_type: attachments && attachments.length > 0 ? 'file' : 'text',
      reply_to_message_id: replyToId || null,
      reply_to: replySnippet,
      is_forwarded: metadata?.is_forwarded || false,
      forwarded_from: metadata?.forwarded_from || undefined,
      created_at: now,
      attachments: attachments || [],
      reactions: [],
      status: 'sent'
    };

    // Save locally
    const local = this.getLocalMessages();
    local.push(optimisticMessage);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));

    this.touchConversation(conversationId);
    this.notifyMessageAction(optimisticMessage, 'insert');
    broadcast('message_insert', optimisticMessage);

    // Persist to Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('messages').insert({
          id: msgId,
          conversation_id: conversationId,
          sender_id: current.id,
          content: trimmed,
          message_type: optimisticMessage.message_type,
          reply_to_message_id: replyToId || null,
          is_forwarded: metadata?.is_forwarded || false,
          forwarded_from: metadata?.forwarded_from || null
        });

        if (error) {
          console.error('Supabase message insert failed:', error);
        } else if (attachments && attachments.length > 0) {
          const records = attachments.map(att => ({
            id: att.id,
            message_id: msgId,
            conversation_id: conversationId,
            uploader_id: current.id,
            original_filename: att.original_filename,
            storage_path: att.storage_path,
            mime_type: att.mime_type,
            file_size: att.file_size
          }));
          await supabase.from('attachments').insert(records);
        }
      } catch (err) {
        console.error('Supabase error while sending message:', err);
      }
    }

    return optimisticMessage;
  }

  /**
   * Forwards a message to another conversation preserving attribution
   */
  static async forwardMessage(
    sourceMessage: Message,
    targetConversationId: string
  ): Promise<Message> {
    return this.sendMessage(
      targetConversationId,
      sourceMessage.content,
      null,
      sourceMessage.attachments,
      {
        is_forwarded: true,
        forwarded_from: sourceMessage.sender_name || 'Friend'
      }
    );
  }

  static async editMessage(messageId: string, newContent: string): Promise<void> {
    const trimmed = newContent.trim();
    if (!trimmed) throw new Error('Message cannot be empty');

    const now = new Date().toISOString();
    const local = this.getLocalMessages();
    const msg = local.find(m => m.id === messageId);
    if (msg) {
      msg.content = trimmed;
      msg.updated_at = now;
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));
      this.notifyMessageAction(msg, 'update');
      broadcast('message_update', msg);
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('messages')
          .update({ content: trimmed, updated_at: now })
          .eq('id', messageId);
      } catch (err) {
        console.error('Supabase edit error:', err);
      }
    }
  }

  static async deleteMessage(messageId: string): Promise<void> {
    const now = new Date().toISOString();
    const local = this.getLocalMessages();
    const msg = local.find(m => m.id === messageId);
    if (msg) {
      msg.deleted_at = now;
      msg.content = 'This message was deleted';
      msg.attachments = [];
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));
      this.notifyMessageAction(msg, 'delete');
      broadcast('message_delete', msg);
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('messages')
          .update({
            deleted_at: now,
            content: 'This message was deleted'
          })
          .eq('id', messageId);
      } catch (err) {
        console.error('Supabase delete error:', err);
      }
    }
  }

  static async toggleReaction(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    const current = this.getCurrentMember();
    if (!current) return;

    const local = this.getLocalMessages();
    const msg = local.find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = [];

    const existingIdx = msg.reactions.findIndex(
      r => r.message_id === messageId && r.member_id === current.id && r.emoji === emoji
    );

    const supabase = getSupabase();

    if (existingIdx >= 0) {
      const removed = msg.reactions.splice(existingIdx, 1)[0];
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));
      this.notifyReactionAction(conversationId, removed, 'delete');
      broadcast('reaction_delete', { reaction: removed, conversation_id: conversationId });

      if (supabase) {
        try {
          await supabase
            .from('message_reactions')
            .delete()
            .match({ message_id: messageId, member_id: current.id, emoji });
        } catch (err) {
          console.error('Supabase reaction remove error:', err);
        }
      }
    } else {
      const reaction: Reaction = {
        id: crypto.randomUUID(),
        message_id: messageId,
        member_id: current.id,
        emoji,
        created_at: new Date().toISOString()
      };
      msg.reactions.push(reaction);
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));
      this.notifyReactionAction(conversationId, reaction, 'insert');
      broadcast('reaction_insert', { reaction, conversation_id: conversationId });

      if (supabase) {
        try {
          await supabase.from('message_reactions').insert({
            id: reaction.id,
            message_id: messageId,
            member_id: current.id,
            emoji
          });
        } catch (err) {
          console.error('Supabase reaction insert error:', err);
        }
      }
    }
  }

  static async uploadFile(
    file: File,
    conversationId: string,
    onProgress?: (progress: number) => void
  ): Promise<Attachment> {
    const current = this.getCurrentMember();
    if (!current) throw new Error('Not logged in');

    const validation = validateFileSize(file.size);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const safeName = sanitizeFilename(file.name);
    const fileId = crypto.randomUUID();
    const storagePath = `${conversationId}/${fileId}_${safeName}`;

    onProgress?.(30);

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('kith_attachments')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        onProgress?.(85);

        if (!error && data) {
          const { data: urlData } = supabase.storage
            .from('kith_attachments')
            .getPublicUrl(storagePath);

          onProgress?.(100);

          return {
            id: fileId,
            conversation_id: conversationId,
            uploader_id: current.id,
            original_filename: safeName,
            storage_path: storagePath,
            mime_type: file.type || 'application/octet-stream',
            file_size: file.size,
            created_at: new Date().toISOString(),
            download_url: urlData.publicUrl
          };
        } else {
          console.warn('Supabase storage upload failed, falling back to local blob:', error);
        }
      } catch (err) {
        console.warn('Supabase upload exception:', err);
      }
    }

    // Local blob fallback
    onProgress?.(70);
    const blobUrl = URL.createObjectURL(file);
    onProgress?.(100);

    return {
      id: fileId,
      conversation_id: conversationId,
      uploader_id: current.id,
      original_filename: safeName,
      storage_path: `local/${fileId}/${safeName}`,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      created_at: new Date().toISOString(),
      download_url: blobUrl
    };
  }

  static sendTyping(conversationId: string): void {
    const current = this.getCurrentMember();
    if (!current) return;

    const payload: TypingIndicator = {
      member_id: current.id,
      display_name: current.display_name,
      conversation_id: conversationId,
      timestamp: Date.now()
    };

    broadcast('typing', payload);

    const supabase = getSupabase();
    if (supabase) {
      try {
        const channel = supabase.channel(`typing:${conversationId}`);
        channel.send({
          type: 'broadcast',
          event: 'typing',
          payload
        });
      } catch {
        // ignore
      }
    }
  }

  static markAsRead(conversationId: string): void {
    const states = this.getReadStates();
    states[conversationId] = Date.now();
    localStorage.setItem(LOCAL_READ_STATES_KEY, JSON.stringify(states));
  }

  private static getReadStates(): Record<string, number> {
    try {
      const raw = localStorage.getItem(LOCAL_READ_STATES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  }

  private static touchConversation(conversationId: string): void {
    const local = this.getLocalConversations('');
    const c = local.find(item => item.id === conversationId);
    if (c) {
      c.updated_at = new Date().toISOString();
      localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(local));
    }
  }

  static subscribeToConversation(
    conversationId: string,
    callbacks: {
      onMessage: MessageCallback;
      onReaction: ReactionCallback;
      onTyping: TypingCallback;
    }
  ): () => void {
    if (!listeners.has(conversationId)) {
      listeners.set(conversationId, {
        messageCallbacks: new Set(),
        reactionCallbacks: new Set(),
        typingCallbacks: new Set()
      });
    }

    const convListeners = listeners.get(conversationId)!;
    convListeners.messageCallbacks.add(callbacks.onMessage);
    convListeners.reactionCallbacks.add(callbacks.onReaction);
    convListeners.typingCallbacks.add(callbacks.onTyping);

    const activeClient = getSupabase();
    let supabaseChannel: RealtimeChannel | null = null;

    if (activeClient) {
      try {
        supabaseChannel = activeClient
          .channel(`room:${conversationId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`
            },
            async (payload) => {
              if (payload.eventType === 'INSERT') {
                const newRow = payload.new as any;
                const { data: sender } = await activeClient
                  .from('members')
                  .select('display_name, avatar_color, avatar_url, nickname, status_text')
                  .eq('id', newRow.sender_id)
                  .maybeSingle();

                const msg: Message = {
                  id: newRow.id,
                  conversation_id: newRow.conversation_id,
                  sender_id: newRow.sender_id,
                  sender_name: sender?.display_name || 'Friend',
                  sender_avatar_color: sender?.avatar_color || '#8B7CF6',
                  sender_avatar_url: sender?.avatar_url,
                  is_forwarded: newRow.is_forwarded,
                  forwarded_from: newRow.forwarded_from,
                  content: newRow.content,
                  message_type: newRow.message_type,
                  reply_to_message_id: newRow.reply_to_message_id,
                  created_at: newRow.created_at,
                  updated_at: newRow.updated_at,
                  deleted_at: newRow.deleted_at,
                  status: 'sent'
                };
                callbacks.onMessage(msg, 'insert');
              } else if (payload.eventType === 'UPDATE') {
                callbacks.onMessage(payload.new as Message, 'update');
              } else if (payload.eventType === 'DELETE') {
                callbacks.onMessage(payload.old as Message, 'delete');
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'message_reactions'
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                callbacks.onReaction(payload.new as Reaction, 'insert');
              } else if (payload.eventType === 'DELETE') {
                callbacks.onReaction(payload.old as Reaction, 'delete');
              }
            }
          )
          .on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload && payload.conversation_id === conversationId) {
              callbacks.onTyping(payload as TypingIndicator);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              notifyConnectionState('connected');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              notifyConnectionState('reconnecting');
            }
          });
      } catch (err) {
        console.warn('Supabase realtime subscription failed:', err);
      }
    }

    return () => {
      convListeners.messageCallbacks.delete(callbacks.onMessage);
      convListeners.reactionCallbacks.delete(callbacks.onReaction);
      convListeners.typingCallbacks.delete(callbacks.onTyping);

      if (
        convListeners.messageCallbacks.size === 0 &&
        convListeners.reactionCallbacks.size === 0 &&
        convListeners.typingCallbacks.size === 0
      ) {
        listeners.delete(conversationId);
      }

      if (activeClient && supabaseChannel) {
        activeClient.removeChannel(supabaseChannel);
      }
    };
  }

  static getLastReadTime(conversationId: string): number {
    const states = this.getReadStates();
    return states[conversationId] || 0;
  }

  static subscribeToConnectionState(callback: ConnectionCallback): () => void {
    connectionListeners.add(callback);
    callback(currentConnectionState);
    return () => {
      connectionListeners.delete(callback);
    };
  }

  static getConnectionState(): 'connected' | 'reconnecting' | 'offline' {
    return currentConnectionState;
  }

  static subscribeToPresence(callback: PresenceCallback): () => void {
    presenceListeners.add(callback);
    return () => {
      presenceListeners.delete(callback);
    };
  }

  private static notifyMessageAction(msg: Message, action: 'insert' | 'update' | 'delete'): void {
    const convListeners = listeners.get(msg.conversation_id);
    if (convListeners) {
      convListeners.messageCallbacks.forEach(cb => cb(msg, action));
    }
  }

  private static notifyReactionAction(conversationId: string, reaction: Reaction, action: 'insert' | 'delete'): void {
    const convListeners = listeners.get(conversationId);
    if (convListeners) {
      convListeners.reactionCallbacks.forEach(cb => cb(reaction, action));
    }
  }
}
