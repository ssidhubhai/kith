import {
  Member,
  Conversation,
  Message,
  Attachment,
  Reaction,
  TypingIndicator,
  ConnectionState
} from '../types';
import { getSupabase, isSupabaseConfigured, isLocalModeExplicitlyEnabled } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sanitizeFilename, validateFileSize } from '../utils/fileValidation';
import { getDirectConversationKey } from '../utils/conversationUtils';
import { deriveUsernameFromGoogle, isInternalEmail } from '../utils/authValidation';

const DEFAULT_GROUP_ID = '00000000-0000-0000-0000-000000000001';
const CURRENT_MEMBER_STORAGE_KEY = 'kith_current_member';
const LOCAL_MESSAGES_KEY = 'kith_local_messages';
const LOCAL_MEMBERS_KEY = 'kith_local_members';
const LOCAL_CONVERSATIONS_KEY = 'kith_local_conversations';
const LOCAL_READ_STATES_KEY = 'kith_local_read_states';

// Multi-tab broadcast channel for local multi-tab synchronization
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('kith_realtime_mesh')
  : null;

type MessageCallback = (message: Message, action: 'insert' | 'update' | 'delete') => void;
type ReactionCallback = (reaction: Reaction, action: 'insert' | 'delete') => void;
type TypingCallback = (typing: TypingIndicator) => void;
type PresenceCallback = (memberId: string, isOnline: boolean) => void;
type ConnectionCallback = (state: ConnectionState) => void;
type MemberUpdateCallback = (members: Member[]) => void;
type AttachmentCallback = (attachment: Attachment) => void;

interface ConversationListeners {
  messageCallbacks: Set<MessageCallback>;
  reactionCallbacks: Set<ReactionCallback>;
  typingCallbacks: Set<TypingCallback>;
  attachmentCallbacks: Set<AttachmentCallback>;
}

const listeners = new Map<string, ConversationListeners>();
const presenceListeners = new Set<PresenceCallback>();
const connectionListeners = new Set<ConnectionCallback>();
const memberUpdateListeners = new Set<MemberUpdateCallback>();
const onlineMemberSet = new Set<string>();

let currentConnectionState: ConnectionState = 'connected';
let globalPresenceChannel: RealtimeChannel | null = null;
let membersSubscriptionChannel: RealtimeChannel | null = null;

function notifyConnectionState(state: ConnectionState) {
  currentConnectionState = state;
  connectionListeners.forEach(cb => {
    try {
      cb(state);
    } catch (e) {
      console.error(e);
    }
  });
}

/**
 * Resolves full public CDN download URL for Supabase Storage attachments.
 * Prevents broken images on remote devices and across page refreshes.
 */
export function resolveAttachmentUrl(att: any, supabaseClientInstance?: any): string {
  if (att?.download_url && (att.download_url.startsWith('http://') || att.download_url.startsWith('https://') || att.download_url.startsWith('blob:') || att.download_url.startsWith('data:'))) {
    return att.download_url;
  }
  const client = supabaseClientInstance || getSupabase();
  if (att?.storage_path && client) {
    try {
      const { data } = client.storage.from('kith_attachments').getPublicUrl(att.storage_path);
      if (data?.publicUrl) return data.publicUrl;
    } catch {
      // fallback
    }
  }
  return att?.download_url || att?.storage_path || '';
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

// Multi-tab local message listener
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

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (isSupabaseConfigured() && !isLocalModeExplicitlyEnabled()) {
      notifyConnectionState('connecting');
      ChatEngine.reconcileState();
    } else {
      notifyConnectionState('connected');
    }
  });
  window.addEventListener('offline', () => notifyConnectionState('connection_failed'));
}

export class ChatEngine {
  /**
   * Initializes global Realtime subscriptions for Presence and Member directory updates.
   */
  static initGlobalRealtime(): void {
    const supabase = getSupabase();
    const currentMember = this.getCurrentMember();

    if (!supabase) {
      notifyConnectionState(isSupabaseConfigured() ? 'connecting' : 'local_only');
      return;
    }

    // Initialize cross-session presence tracking
    try {
      if (globalPresenceChannel) {
        supabase.removeChannel(globalPresenceChannel);
        globalPresenceChannel = null;
      }

      globalPresenceChannel = supabase.channel('kith_global_presence', {
        config: { presence: { key: currentMember?.id || 'anon' } }
      });

      globalPresenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = globalPresenceChannel?.presenceState() || {};
          onlineMemberSet.clear();
          Object.keys(state).forEach((key) => {
            if (key !== 'anon') {
              onlineMemberSet.add(key);
            }
          });
          if (currentMember?.id) {
            onlineMemberSet.add(currentMember.id);
          }
          // Notify listeners
          presenceListeners.forEach(cb => {
            onlineMemberSet.forEach(id => cb(id, true));
          });
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key && key !== 'anon') {
            onlineMemberSet.add(key);
            presenceListeners.forEach(cb => cb(key, true));
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key && key !== 'anon') {
            onlineMemberSet.delete(key);
            presenceListeners.forEach(cb => cb(key, false));
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            notifyConnectionState('connected');
            if (currentMember) {
              await globalPresenceChannel?.track({
                member_id: currentMember.id,
                display_name: currentMember.display_name,
                online_at: new Date().toISOString()
              });
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            notifyConnectionState('reconnecting');
          }
        });
    } catch (err) {
      console.warn('[Kith] Presence channel setup exception:', err);
    }

    // Subscribe to members table changes so new members appear live across all sessions
    try {
      if (membersSubscriptionChannel) {
        supabase.removeChannel(membersSubscriptionChannel);
        membersSubscriptionChannel = null;
      }

      membersSubscriptionChannel = supabase
        .channel('kith_members_directory')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'members' },
          async () => {
            const updated = await this.getMembers();
            memberUpdateListeners.forEach(cb => cb(updated));
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[Kith] Members subscription exception:', err);
    }
  }

  /**
   * Reconnects and reconciles data after network interruption.
   * Recovers presence and fresh messages from Supabase.
   */
  static async reconcileState(activeConversationId?: string): Promise<{ messages?: Message[] }> {
    this.initGlobalRealtime();
    const current = this.getCurrentMember();
    if (current) {
      await this.upsertMemberRecord(current);
    }
    if (activeConversationId) {
      const res = await this.getMessages(activeConversationId, { limit: 50 });
      return { messages: res.messages };
    }
    return {};
  }

  static clearAllData(): void {
    try {
      localStorage.removeItem(CURRENT_MEMBER_STORAGE_KEY);
      localStorage.removeItem(LOCAL_MESSAGES_KEY);
      localStorage.removeItem(LOCAL_MEMBERS_KEY);
      localStorage.removeItem(LOCAL_CONVERSATIONS_KEY);
      localStorage.removeItem(LOCAL_READ_STATES_KEY);
    } catch {
      // ignore
    }
  }

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
   * Resolves the canonical authenticated member profile from Supabase Auth & public.members.
   */
  static async fetchAuthenticatedMember(): Promise<Member | null> {
    const supabase = getSupabase();
    if (!supabase || isLocalModeExplicitlyEnabled()) {
      return this.getCurrentMember();
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return null;
      }

      const user = session.user;
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        // If user logged in with a real external provider (e.g. Google), sync real email if missing
        const realEmail = user.email && !isInternalEmail(user.email) ? user.email : (data.email && !isInternalEmail(data.email) ? data.email : undefined);
        const provider = user.app_metadata?.provider || data.auth_provider || 'email';

        if (realEmail && (!data.email || isInternalEmail(data.email))) {
          try {
            await supabase.from('members').update({ email: realEmail, auth_provider: provider }).eq('id', user.id);
          } catch {
            // ignore
          }
        }

        const member: Member = {
          ...data,
          email: realEmail,
          auth_provider: provider,
          is_online: true
        };
        localStorage.setItem(CURRENT_MEMBER_STORAGE_KEY, JSON.stringify(member));
        return member;
      }

      // If user exists in Auth but public.members record is pending sync (e.g. Brand New Google Sign-In)
      const meta = user.user_metadata || {};
      const provider = user.app_metadata?.provider || 'email';
      const isGoogle = provider === 'google';

      let assignedUsername = meta.username;
      if (!assignedUsername) {
        const candidate = deriveUsernameFromGoogle(user.email, meta.full_name || meta.name);
        // Check uniqueness in database
        try {
          const { data: existing } = await supabase
            .from('members')
            .select('id')
            .ilike('username', candidate)
            .maybeSingle();

          if (existing) {
            assignedUsername = `${candidate}_${Math.floor(100 + Math.random() * 900)}`;
          } else {
            assignedUsername = candidate;
          }
        } catch {
          assignedUsername = `${candidate}_${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      const realEmail = user.email && !isInternalEmail(user.email) ? user.email : undefined;
      const displayName = meta.display_name || meta.full_name || meta.name || assignedUsername;

      const newMember: Member = {
        id: user.id,
        display_name: displayName,
        username: assignedUsername,
        email: realEmail,
        auth_provider: isGoogle ? 'google' : 'email',
        avatar_color: '#8B7CF6',
        avatar_url: meta.avatar_url || meta.picture || undefined,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_online: true
      };

      await this.upsertMemberRecord(newMember);
      localStorage.setItem(CURRENT_MEMBER_STORAGE_KEY, JSON.stringify(newMember));
      return newMember;
    } catch (err) {
      console.warn('[Kith] Error fetching authenticated member:', err);
      return this.getCurrentMember();
    }
  }

  /**
   * Completely signs out of Supabase Auth, cleans up presence, and removes cached state.
   */
  static async signOut(): Promise<void> {
    const supabase = getSupabase();
    if (globalPresenceChannel && supabase) {
      try {
        await globalPresenceChannel.untrack();
        supabase.removeChannel(globalPresenceChannel);
        globalPresenceChannel = null;
      } catch {}
    }

    if (membersSubscriptionChannel && supabase) {
      try {
        supabase.removeChannel(membersSubscriptionChannel);
        membersSubscriptionChannel = null;
      } catch {}
    }

    listeners.forEach((conv) => {
      conv.messageCallbacks.clear();
      conv.reactionCallbacks.clear();
      conv.typingCallbacks.clear();
    });
    listeners.clear();
    onlineMemberSet.clear();

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    try {
      localStorage.removeItem(CURRENT_MEMBER_STORAGE_KEY);
    } catch {}
  }

  static async uploadAvatar(file: File): Promise<string> {
    const current = this.getCurrentMember();
    const validation = validateFileSize(file.size);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const safeName = sanitizeFilename(file.name);
    const fileId = crypto.randomUUID();
    const storagePath = `avatars/${current?.id || 'anon'}_${fileId}_${safeName}`;
    const supabase = getSupabase();

    if (supabase && !isLocalModeExplicitlyEnabled()) {
      try {
        const { data, error } = await supabase.storage
          .from('kith_attachments')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (!error && data) {
          const { data: urlData } = supabase.storage
            .from('kith_attachments')
            .getPublicUrl(storagePath);
          return urlData.publicUrl;
        }
      } catch (err) {
        console.warn('[Kith] Supabase avatar storage upload failed, using data URL fallback:', err);
      }
    }

    // Local data URL fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  static async setCurrentMember(
    displayName: string,
    existingId?: string,
    initialProfile?: Partial<Member>
  ): Promise<Member> {
    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new Error('Display name cannot be empty');
    }

    const current = this.getCurrentMember();
    const memberId = existingId || current?.id || crypto.randomUUID();
    const avatarColors = ['#8B7CF6', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#6366F1'];
    const avatarColor = initialProfile?.avatar_color || current?.avatar_color || avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const member: Member = {
      id: memberId,
      display_name: trimmed,
      username: initialProfile?.username || current?.username,
      email: initialProfile?.email || current?.email,
      auth_provider: initialProfile?.auth_provider || current?.auth_provider || 'email',
      avatar_color: avatarColor,
      avatar_url: initialProfile?.avatar_url || current?.avatar_url,
      last_seen_at: new Date().toISOString(),
      created_at: current?.created_at || new Date().toISOString(),
      is_online: true,
      ...initialProfile
    };

    localStorage.setItem(CURRENT_MEMBER_STORAGE_KEY, JSON.stringify(member));

    await this.upsertMemberRecord(member);

    broadcast('presence', { member_id: member.id, is_online: true });
    onlineMemberSet.add(member.id);

    this.initGlobalRealtime();

    return member;
  }

  static async deleteMember(memberId: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('conversation_members').delete().eq('member_id', memberId);
        await supabase.from('messages').delete().eq('sender_id', memberId);
        await supabase.from('message_reactions').delete().eq('member_id', memberId);
        await supabase.from('members').delete().eq('id', memberId);
      } catch (err) {
        console.warn('[Kith] Error deleting member in Supabase:', err);
      }
    }

    const localMembers = this.getLocalMembers().filter(m => m.id !== memberId);
    localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(localMembers));

    const updated = await this.getMembers();
    memberUpdateListeners.forEach(cb => cb(updated));
    broadcast('member_deleted', { memberId });
  }

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
   * Upserts member into Supabase (if configured) or local store.
   * Handles PostgREST errors explicitly.
   */
  private static async upsertMemberRecord(member: Member): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let { error: memberErr } = await supabase.from('members').upsert({
          id: member.id,
          display_name: member.display_name,
          username: member.username || null,
          email: member.email || null,
          auth_provider: member.auth_provider || 'email',
          nickname: member.nickname || null,
          avatar_url: member.avatar_url || null,
          avatar_color: member.avatar_color,
          status_text: member.status_text || null,
          hide_last_seen: Boolean(member.hide_last_seen),
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'id' });

        // If schema cache indicates missing column (PGRST204 / 42703), fallback to base schema
        if (memberErr && (memberErr.code === 'PGRST204' || memberErr.code === '42703' || memberErr.message?.toLowerCase().includes('column'))) {
          console.warn('[Kith] Database members table lacks extended profile columns. Using base schema columns.');
          const baseUpsert = await supabase.from('members').upsert({
            id: member.id,
            display_name: member.display_name,
            avatar_color: member.avatar_color,
            last_seen_at: new Date().toISOString()
          }, { onConflict: 'id' });
          memberErr = baseUpsert.error;
        }

        if (memberErr) {
          console.error('[Kith] Error upserting member to Supabase:', memberErr);
        }

        // Ensure default shared group conversation exists
        await supabase.from('conversations').upsert({
          id: DEFAULT_GROUP_ID,
          type: 'group',
          title: 'The Collective'
        }, { onConflict: 'id' });

        // Join conversation membership
        await supabase.from('conversation_members').upsert({
          conversation_id: DEFAULT_GROUP_ID,
          member_id: member.id
        }, { onConflict: 'conversation_id,member_id' });
      } catch (err) {
        console.error('[Kith] Supabase member upsert exception:', err);
      }
    }

    // Keep local cache up to date
    const members = this.getLocalMembers();
    const idx = members.findIndex(m => m.id === member.id);
    if (idx >= 0) {
      members[idx] = { ...members[idx], ...member, last_seen_at: new Date().toISOString() };
    } else {
      members.push(member);
    }
    localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(members));
  }

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
        } else if (error) {
          console.error('[Kith] Supabase getMembers error:', error);
        }
      } catch (err) {
        console.error('[Kith] Supabase getMembers exception:', err);
      }
    }

    // Local fallback
    const local = this.getLocalMembers();
    return local.map(m => ({
      ...m,
      is_online: m.id === current?.id || onlineMemberSet.has(m.id)
    }));
  }

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

  static async getConversations(memberId: string): Promise<Conversation[]> {
    const supabase = getSupabase();

    if (supabase) {
      try {
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
            // Exclude internal system or registry rooms
            if (c.title?.startsWith('__') || c.title?.toLowerCase().includes('registry')) {
              continue;
            }

            const memberIds = (c.conversation_members || []).map((cm: { member_id: string }) => cm.member_id);
            if (c.type === 'group' || memberIds.includes(memberId)) {
              // Fetch latest message
              const { data: lastMsg } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', c.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              let displayTitle = c.title;
              if (c.type === 'direct') {
                const otherMemberId = memberIds.find((id: string) => id !== memberId);
                if (otherMemberId) {
                  const { data: otherMember } = await supabase
                    .from('members')
                    .select('display_name')
                    .eq('id', otherMemberId)
                    .maybeSingle();
                  if (otherMember?.display_name) {
                    displayTitle = otherMember.display_name;
                  }
                }
              }

              list.push({
                id: c.id,
                type: c.type,
                title: displayTitle,
                created_at: c.created_at,
                updated_at: c.updated_at,
                participant_ids: memberIds,
                last_message: lastMsg || undefined,
                unread_count: 0
              });
            }
          }

          // Ensure default shared group 'The Collective' is always present for all users
          const hasDefault = list.some(c => c.id === DEFAULT_GROUP_ID);
          if (!hasDefault) {
            try {
              await supabase.from('conversations').upsert({
                id: DEFAULT_GROUP_ID,
                type: 'group',
                title: 'The Collective'
              }, { onConflict: 'id' });

              await supabase.from('conversation_members').upsert({
                conversation_id: DEFAULT_GROUP_ID,
                member_id: memberId
              }, { onConflict: 'conversation_id,member_id' });
            } catch {
              // ignore
            }

            list.unshift({
              id: DEFAULT_GROUP_ID,
              type: 'group',
              title: 'The Collective',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              participant_ids: [memberId],
              unread_count: 0
            });
          }

          return list;
        } else if (error) {
          console.error('[Kith] Supabase getConversations error:', error);
        }
      } catch (err) {
        console.error('[Kith] Supabase getConversations exception:', err);
      }
    }

    return this.getLocalConversations(memberId);
  }

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

  static async getOrCreateDirectConversation(targetMember: Member): Promise<Conversation> {
    const current = this.getCurrentMember();
    if (!current) throw new Error('Not logged in');

    const pairKey = getDirectConversationKey(current.id, targetMember.id);
    const supabase = getSupabase();

    if (supabase) {
      try {
        // Query conversation memberships joined with conversations where type is 'direct'
        const { data: convMembers } = await supabase
          .from('conversation_members')
          .select(`
            conversation_id,
            member_id,
            conversations!inner (
              id,
              type,
              title,
              created_at,
              updated_at
            )
          `)
          .in('member_id', [current.id, targetMember.id]);

        if (convMembers && convMembers.length > 0) {
          const directMap = new Map<string, { count: number; conv: any }>();
          for (const item of convMembers as any[]) {
            const c = item.conversations;
            if (c && c.type === 'direct' && c.id !== DEFAULT_GROUP_ID) {
              const existing = directMap.get(c.id);
              if (existing) {
                existing.count += 1;
              } else {
                directMap.set(c.id, { count: 1, conv: c });
              }
            }
          }

          for (const [, val] of directMap.entries()) {
            if (val.count >= 2) {
              return {
                id: val.conv.id,
                type: 'direct',
                title: targetMember.display_name,
                created_at: val.conv.created_at,
                updated_at: val.conv.updated_at,
                participant_ids: [current.id, targetMember.id],
                unread_count: 0
              };
            }
          }
        }

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
            participant_ids: [current.id, targetMember.id],
            unread_count: 0
          };
        }
      } catch (err) {
        console.error('[Kith] Supabase direct conversation exception:', err);
      }
    }

    const localConvs = this.getLocalConversations(current.id);
    const existing = localConvs.find(
      c => c.type === 'direct' &&
        c.id !== DEFAULT_GROUP_ID &&
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

        let { data, error } = await query;

        // If error is 42703 (undefined column in members join), fallback to base columns
        if (error && (error.code === '42703' || error.message?.includes('avatar_url') || error.message?.includes('column'))) {
          console.warn('[Kith] getMessages fallback: members table lacks avatar_url column. Querying base columns.');
          let fallbackQuery = supabase
            .from('messages')
            .select(`
              *,
              sender:sender_id (display_name, avatar_color),
              attachments (*),
              reactions:message_reactions (*)
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit + 1);

          if (options.before) {
            fallbackQuery = fallbackQuery.lt('created_at', options.before);
          }

          const fallbackRes = await fallbackQuery;
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

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
            attachments: (m.attachments || []).map((att: any) => ({
              ...att,
              download_url: resolveAttachmentUrl(att, supabase)
            })),
            reactions: m.reactions || [],
            status: 'sent'
          }));

          return { messages: mapped.reverse(), hasMore };
        } else if (error) {
          console.error('[Kith] Supabase getMessages error:', error);
          notifyConnectionState('reconnecting');
        }
      } catch (err) {
        console.error('[Kith] Supabase getMessages exception:', err);
        notifyConnectionState('reconnecting');
      }
    }

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
   * Sends a message with optimistic delivery and robust error handling.
   * If the Supabase write fails, updates message status to 'failed' rather than
   * silently faking delivery.
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
      is_forwarded: metadata?.is_forwarded || false,
      forwarded_from: metadata?.forwarded_from || undefined,
      created_at: now,
      attachments: attachments || [],
      reactions: [],
      status: 'pending'
    };

    // Save to local cache with pending status
    const local = this.getLocalMessages();
    local.push(optimisticMessage);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));

    this.touchConversation(conversationId);
    this.notifyMessageAction(optimisticMessage, 'insert');
    broadcast('message_insert', optimisticMessage);

    const supabase = getSupabase();
    if (supabase) {
      try {
        // Ensure sender member record exists in Supabase
        await this.upsertMemberRecord(current);

        let { error: insertErr } = await supabase.from('messages').insert({
          id: msgId,
          conversation_id: conversationId,
          sender_id: current.id,
          content: trimmed,
          message_type: optimisticMessage.message_type,
          reply_to_message_id: replyToId || null,
          is_forwarded: metadata?.is_forwarded || false,
          forwarded_from: metadata?.forwarded_from || null
        });

        if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703' || insertErr.message?.includes('forwarded') || insertErr.message?.includes('column'))) {
          console.warn('[Kith] messages table lacks forwarded columns. Inserting base columns.');
          const baseInsert = await supabase.from('messages').insert({
            id: msgId,
            conversation_id: conversationId,
            sender_id: current.id,
            content: trimmed,
            message_type: optimisticMessage.message_type,
            reply_to_message_id: replyToId || null
          });
          insertErr = baseInsert.error;
        }

        if (insertErr) {
          console.error('[Kith] Supabase message insert failed:', insertErr);
          optimisticMessage.status = 'failed';
          optimisticMessage.error = insertErr.message;
          this.updateLocalMessageStatus(msgId, 'failed', insertErr.message);
          this.notifyMessageAction(optimisticMessage, 'update');
          return optimisticMessage;
        }

        if (attachments && attachments.length > 0) {
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
          const { error: attErr } = await supabase.from('attachments').insert(records);
          if (attErr) {
            console.error('[Kith] Supabase attachments insert error:', attErr);
          }
        }

        // Update conversation timestamp in Supabase
        await supabase
          .from('conversations')
          .update({ updated_at: now })
          .eq('id', conversationId);

        // Confirmed delivered to cloud
        optimisticMessage.status = 'sent';
        this.updateLocalMessageStatus(msgId, 'sent');
        this.notifyMessageAction(optimisticMessage, 'update');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Kith] Supabase message send exception:', msg);
        optimisticMessage.status = 'failed';
        optimisticMessage.error = msg;
        this.updateLocalMessageStatus(msgId, 'failed', msg);
        this.notifyMessageAction(optimisticMessage, 'update');
      }
    } else {
      // In local mode, immediate delivery confirmation
      optimisticMessage.status = 'sent';
      this.updateLocalMessageStatus(msgId, 'sent');
      this.notifyMessageAction(optimisticMessage, 'update');
    }

    return optimisticMessage;
  }

  private static updateLocalMessageStatus(messageId: string, status: 'sent' | 'failed' | 'pending', errorMsg?: string): void {
    const local = this.getLocalMessages();
    const item = local.find(m => m.id === messageId);
    if (item) {
      item.status = status;
      if (errorMsg) item.error = errorMsg;
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(local));
    }
  }

  static async retryFailedMessage(message: Message): Promise<Message> {
    const supabase = getSupabase();
    if (!supabase) {
      return message;
    }

    const current = this.getCurrentMember();
    if (!current) return message;

    message.status = 'pending';
    message.error = undefined;
    this.updateLocalMessageStatus(message.id, 'pending');
    this.notifyMessageAction(message, 'update');

    try {
      await this.upsertMemberRecord(current);
      let { error } = await supabase.from('messages').insert({
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: current.id,
        content: message.content,
        message_type: message.message_type,
        reply_to_message_id: message.reply_to_message_id || null,
        is_forwarded: message.is_forwarded || false,
        forwarded_from: message.forwarded_from || null
      });

      if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('forwarded') || error.message?.includes('column'))) {
        const baseInsert = await supabase.from('messages').insert({
          id: message.id,
          conversation_id: message.conversation_id,
          sender_id: current.id,
          content: message.content,
          message_type: message.message_type,
          reply_to_message_id: message.reply_to_message_id || null
        });
        error = baseInsert.error;
      }

      if (error) {
        message.status = 'failed';
        message.error = error.message;
        this.updateLocalMessageStatus(message.id, 'failed', error.message);
        this.notifyMessageAction(message, 'update');
      } else {
        message.status = 'sent';
        this.updateLocalMessageStatus(message.id, 'sent');
        this.notifyMessageAction(message, 'update');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      message.status = 'failed';
      message.error = msg;
      this.updateLocalMessageStatus(message.id, 'failed', msg);
      this.notifyMessageAction(message, 'update');
    }

    return message;
  }

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
        console.error('[Kith] Supabase edit error:', err);
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
        console.error('[Kith] Supabase delete error:', err);
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

      if (supabase && !isLocalModeExplicitlyEnabled()) {
        try {
          await supabase
            .from('message_reactions')
            .delete()
            .match({ message_id: messageId, member_id: current.id, emoji });
        } catch (err) {
          console.error('[Kith] Supabase reaction remove error:', err);
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

      if (supabase && !isLocalModeExplicitlyEnabled()) {
        try {
          await this.upsertMemberRecord(current);
          const { error: rxErr } = await supabase.from('message_reactions').insert({
            id: reaction.id,
            message_id: messageId,
            member_id: current.id,
            emoji
          });
          if (rxErr) {
            console.error('[Kith] Supabase reaction insert error:', rxErr);
          }
        } catch (err) {
          console.error('[Kith] Supabase reaction insert exception:', err);
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

        if (error) {
          console.error('[Kith] Supabase storage upload returned error:', error);
          throw new Error(`Cloud upload failed: ${error.message}`);
        }

        if (data) {
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
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Kith] Supabase upload exception:', msg);
        throw new Error(`File upload failed: ${msg}`);
      }
    }

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
    const now = new Date().toISOString();
    const local = this.getLocalConversations('');
    const c = local.find(item => item.id === conversationId);
    if (c) {
      c.updated_at = now;
      localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(local));
    }
    const supabase = getSupabase();
    if (supabase) {
      supabase.from('conversations').update({ updated_at: now }).eq('id', conversationId).then(() => {}, () => {});
    }
  }

  /**
   * Subscribes to Realtime updates for a specific conversation.
   * Handles messages, reactions, typing, and attachment loading.
   */
  static subscribeToConversation(
    conversationId: string,
    callbacks: {
      onMessage: MessageCallback;
      onReaction: ReactionCallback;
      onTyping: TypingCallback;
      onAttachmentInsert?: (attachment: Attachment) => void;
    }
  ): () => void {
    if (!listeners.has(conversationId)) {
      listeners.set(conversationId, {
        messageCallbacks: new Set(),
        reactionCallbacks: new Set(),
        typingCallbacks: new Set(),
        attachmentCallbacks: new Set()
      });
    }

    const convListeners = listeners.get(conversationId)!;
    convListeners.messageCallbacks.add(callbacks.onMessage);
    convListeners.reactionCallbacks.add(callbacks.onReaction);
    convListeners.typingCallbacks.add(callbacks.onTyping);
    if (callbacks.onAttachmentInsert) {
      convListeners.attachmentCallbacks.add(callbacks.onAttachmentInsert);
    }

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
                let senderData: any = null;
                const { data: sData, error: sErr } = await activeClient
                  .from('members')
                  .select('display_name, avatar_color, avatar_url, nickname, status_text')
                  .eq('id', newRow.sender_id)
                  .maybeSingle();

                if (sErr && (sErr.code === '42703' || sErr.message?.includes('column'))) {
                  const { data: baseSData } = await activeClient
                    .from('members')
                    .select('display_name, avatar_color')
                    .eq('id', newRow.sender_id)
                    .maybeSingle();
                  senderData = baseSData;
                } else {
                  senderData = sData;
                }

                const [{ data: attachments }, { data: reactions }] = await Promise.all([
                  activeClient
                    .from('attachments')
                    .select('*')
                    .eq('message_id', newRow.id),
                  activeClient
                    .from('message_reactions')
                    .select('*')
                    .eq('message_id', newRow.id)
                ]);

                const mappedAttachments = (attachments || []).map((att: any) => ({
                  ...att,
                  download_url: resolveAttachmentUrl(att, activeClient)
                }));

                const msg: Message = {
                  id: newRow.id,
                  conversation_id: newRow.conversation_id,
                  sender_id: newRow.sender_id,
                  sender_name: senderData?.display_name || 'Friend',
                  sender_avatar_color: senderData?.avatar_color || '#8B7CF6',
                  sender_avatar_url: senderData?.avatar_url,
                  is_forwarded: newRow.is_forwarded,
                  forwarded_from: newRow.forwarded_from,
                  content: newRow.content,
                  message_type: newRow.message_type,
                  reply_to_message_id: newRow.reply_to_message_id,
                  created_at: newRow.created_at,
                  updated_at: newRow.updated_at,
                  deleted_at: newRow.deleted_at,
                  attachments: mappedAttachments,
                  reactions: reactions || [],
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
              event: 'INSERT',
              schema: 'public',
              table: 'attachments',
              filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
              const newAtt = payload.new as any;
              const mapped: Attachment = {
                id: newAtt.id,
                message_id: newAtt.message_id,
                conversation_id: newAtt.conversation_id,
                uploader_id: newAtt.uploader_id,
                original_filename: newAtt.original_filename,
                storage_path: newAtt.storage_path,
                mime_type: newAtt.mime_type,
                file_size: newAtt.file_size,
                created_at: newAtt.created_at,
                download_url: resolveAttachmentUrl(newAtt, activeClient)
              };
              callbacks.onAttachmentInsert?.(mapped);
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
        console.warn('[Kith] Supabase realtime subscription failed:', err);
      }
    }

    return () => {
      convListeners.messageCallbacks.delete(callbacks.onMessage);
      convListeners.reactionCallbacks.delete(callbacks.onReaction);
      convListeners.typingCallbacks.delete(callbacks.onTyping);
      if (callbacks.onAttachmentInsert) {
        convListeners.attachmentCallbacks.delete(callbacks.onAttachmentInsert);
      }

      if (
        convListeners.messageCallbacks.size === 0 &&
        convListeners.reactionCallbacks.size === 0 &&
        convListeners.typingCallbacks.size === 0 &&
        convListeners.attachmentCallbacks.size === 0
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

  static subscribeToMembers(callback: MemberUpdateCallback): () => void {
    memberUpdateListeners.add(callback);
    return () => {
      memberUpdateListeners.delete(callback);
    };
  }

  static getConnectionState(): ConnectionState {
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
