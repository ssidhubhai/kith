import React, { useState } from 'react';
import {
  Search,
  Users,
  Edit2,
  Sparkles,
  MessageSquarePlus,
  Smile,
  User,
  Trash2
} from 'lucide-react';
import { Conversation, Member, BackendInfo } from '../types';
import { formatMessageTime } from '../utils/messageGrouping';
import { getCurrentBackendInfo, subscribeToBackendInfo } from '../lib/supabaseClient';
import { getMemberAvatarPalette } from '../utils/avatarUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (convId: string) => void;
  members: Member[];
  currentMember: Member;
  onStartDirectChat: (member: Member) => void;
  onDeleteMember?: (memberId: string) => void;
  onOpenSupabaseModal: () => void;
  onUpdateDisplayName: (newName: string) => void;
  onOpenProfileModal?: () => void;
  onOpenFriendProfile?: (member: Member) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  members,
  currentMember,
  onStartDirectChat,
  onDeleteMember,
  onOpenSupabaseModal,
  onOpenProfileModal,
  onOpenFriendProfile
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  const groupConversations = conversations.filter(c =>
    c.type === 'group' &&
    !c.title?.startsWith('__') &&
    !c.title?.toLowerCase().includes('registry')
  );
  const directConversations = conversations.filter(c => c.type === 'direct');

  const filteredGroups = groupConversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDirects = directConversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter out current user and deduplicate members
  const otherMembers = React.useMemo(() => {
    const currentTrimmedName = currentMember.display_name?.trim().toLowerCase() || '';
    const currentUsername = currentMember.username?.trim().toLowerCase() || '';

    const rawOtherMembers = members.filter(m => {
      if (m.id === currentMember.id) return false;
      const mName = m.display_name?.trim().toLowerCase() || '';
      if (currentTrimmedName && mName === currentTrimmedName) return false;
      const mUser = m.username?.trim().toLowerCase() || '';
      if (currentUsername && mUser && mUser === currentUsername) return false;
      return true;
    });

    const dedupeMap = new Map<string, Member>();
    for (const m of rawOtherMembers) {
      const key = m.username ? `@${m.username.toLowerCase()}` : m.display_name.trim().toLowerCase();
      if (!dedupeMap.has(key) && !dedupeMap.has(m.id)) {
        dedupeMap.set(key, m);
        dedupeMap.set(m.id, m);
      }
    }
    return Array.from(new Set(dedupeMap.values()));
  }, [members, currentMember]);

  // Memoized contacts calculation
  const unifiedContacts = React.useMemo(() => {
    const unified = otherMembers.map((member) => {
      const matchConv = directConversations.find(c =>
        c.participant_ids?.includes(member.id) ||
        c.title.toLowerCase() === member.display_name.toLowerCase() ||
        (member.username && c.title.toLowerCase().includes(member.username.toLowerCase()))
      );

      const lastMsg = matchConv?.last_message;
      const sortTime = lastMsg ? new Date(lastMsg.created_at).getTime() : 0;

      return {
        id: member.id,
        member,
        conversation: matchConv,
        lastMessage: lastMsg,
        unreadCount: matchConv?.unread_count || 0,
        sortTime
      };
    });

    for (const conv of directConversations) {
      const matchedMemberId = conv.participant_ids?.find(id => id !== currentMember.id);
      const existing = unified.some(u => u.conversation?.id === conv.id || (matchedMemberId && u.member.id === matchedMemberId));
      if (!existing) {
        const synthMember: Member = {
          id: matchedMemberId || conv.id,
          display_name: conv.title,
          avatar_color: '#0284C7',
          last_seen_at: conv.updated_at || new Date().toISOString(),
          created_at: conv.created_at || new Date().toISOString(),
          is_online: false
        };
        unified.push({
          id: synthMember.id,
          member: synthMember,
          conversation: conv,
          lastMessage: conv.last_message,
          unreadCount: conv.unread_count || 0,
          sortTime: conv.last_message ? new Date(conv.last_message.created_at).getTime() : 0
        });
      }
    }

    unified.sort((a, b) => {
      if (a.sortTime !== b.sortTime) return b.sortTime - a.sortTime;
      if (a.member.is_online !== b.member.is_online) return a.member.is_online ? -1 : 1;
      return a.member.display_name.localeCompare(b.member.display_name);
    });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return unified;

    return unified.filter(item => {
      const m = item.member;
      return (
        m.display_name.toLowerCase().includes(q) ||
        (m.username && m.username.toLowerCase().includes(q)) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (item.lastMessage?.content && item.lastMessage.content.toLowerCase().includes(q))
      );
    });
  }, [otherMembers, directConversations, currentMember.id, searchQuery]);

  const [backendInfo, setBackendInfo] = useState<BackendInfo>(getCurrentBackendInfo());

  React.useEffect(() => {
    const unsub = subscribeToBackendInfo((info) => setBackendInfo(info));
    return () => unsub();
  }, []);

  const currentPalette = getMemberAvatarPalette(currentMember.avatar_color || currentMember.id || currentMember.display_name);
  const onlineCount = members.filter(m => m.is_online).length;

  return (
    <aside
      aria-label="Sidebar navigation"
      className="w-full h-full bg-[#F4F0EA] flex flex-col shrink-0 select-none text-[#24212B] min-h-0"
    >
      {/* Top Header Bar */}
      <div className="p-3.5 sm:p-4 border-b border-[#EAE5E0] bg-[#FAF8F5] flex items-center justify-between safe-area-top">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6] shadow-2xs">
            <Sparkles className="w-4 h-4 fill-[#8B7CF6]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-[#24212B]">
                Kith
              </span>
              <span className="text-[10px] text-[#8B7CF6] bg-[#F0ECFF] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider">
                Circle
              </span>
            </div>
            <div className="text-[10px] text-[#827D8B]">
              {onlineCount} {onlineCount === 1 ? 'friend' : 'friends'} online
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton variant="compact" />

          {/* Connection status indicator - Unclickable */}
          <div
            className="flex items-center gap-1 text-[10px] text-[#827D8B] py-1 px-2 rounded-xl border border-[#EAE5E0] bg-white shadow-2xs select-none pointer-events-none shrink-0"
            title={backendInfo.status === 'connected' ? 'Connected to circle' : 'Connecting'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                backendInfo.status === 'connected'
                  ? 'bg-emerald-500 ring-2 ring-emerald-100'
                  : 'bg-rose-500 ring-2 ring-rose-100'
              }`}
            />
            <span className="text-[10px] font-semibold text-[#24212B]">
              {backendInfo.status === 'connected' ? 'Live' : 'Connecting'}
            </span>
          </div>
        </div>
      </div>

      {/* User Identity Card */}
      <div
        onClick={onOpenProfileModal}
        className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-[#EAE5E0] bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentMember.avatar_url ? (
              <img
                src={currentMember.avatar_url}
                alt={currentMember.display_name}
                className="w-8 h-8 rounded-xl object-cover border shadow-2xs shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center shrink-0 uppercase border shadow-2xs"
                style={{
                  backgroundColor: currentPalette.bg,
                  color: currentPalette.text,
                  borderColor: currentPalette.border
                }}
              >
                {currentMember.display_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#24212B] truncate">
                  {currentMember.display_name}
                </span>
                {(currentMember.username || currentMember.nickname) && (
                  <span className="text-[10px] text-[#827D8B] truncate font-mono">
                    @{currentMember.username || currentMember.nickname}
                  </span>
                )}
                <span className="text-[10px] text-[#827D8B] shrink-0">(You)</span>
              </div>

              {currentMember.status_text ? (
                <div className="text-[10px] text-[#8B7CF6] font-medium truncate flex items-center gap-1 mt-0.5">
                  <Smile className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{currentMember.status_text}</span>
                </div>
              ) : (
                <div className="text-[10px] text-[#827D8B] truncate">
                  Set status or avatar...
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfileModal?.();
            }}
            title="Edit your profile"
            aria-label="Edit your profile"
            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#827D8B] hover:text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Online Friends Quick Avatar Strip (if online friends exist) */}
      {otherMembers.some(m => m.is_online) && (
        <div className="px-3.5 py-2.5 border-b border-[#EAE5E0] bg-[#FAF8F5]/40 overflow-x-auto">
          <div className="flex items-center gap-3">
            {otherMembers.filter(m => m.is_online).map((member) => {
              const pal = getMemberAvatarPalette(member.avatar_color || member.id || member.display_name);
              return (
                <button
                  key={`quick-${member.id}`}
                  type="button"
                  onClick={() => onStartDirectChat(member)}
                  className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer focus:outline-none"
                  title={`Chat with ${member.display_name}${member.status_text ? ` (${member.status_text})` : ''}`}
                >
                  <div className="relative">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.display_name}
                        className="w-9 h-9 rounded-xl object-cover border shadow-2xs group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-xl text-xs font-semibold flex items-center justify-center uppercase border shadow-2xs group-hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: pal.bg,
                          color: pal.text,
                          borderColor: pal.border
                        }}
                      >
                        {member.display_name.charAt(0)}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </div>
                  <span className="text-[10px] text-[#827D8B] max-w-[48px] truncate text-center">
                    {member.display_name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-3 border-b border-[#EAE5E0] bg-[#FAF8F5]/30">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#827D8B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circle or friends..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-[#EAE5E0] rounded-xl text-[#24212B] placeholder-[#A39E98] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#EAE5E0]/60 min-h-0 safe-area-bottom">
        {/* Collective (Group) Chat Section */}
        <div className="py-2.5">
          <div className="px-4 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6D28D9] flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              The Collective Circle
            </span>
            <span className="text-[10px] bg-[#EDE9FE] text-[#6D28D9] px-2 py-0.5 rounded-full font-medium">
              Group Room
            </span>
          </div>
          {filteredGroups.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-all cursor-pointer min-h-[56px] ${
                  isActive
                    ? 'bg-[#F0ECFF] border-l-[3px] border-l-[#8B7CF6]'
                    : 'hover:bg-[#FAF8F5] active:bg-[#FAF8F5]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors mt-0.5 ${
                  isActive
                    ? 'bg-[#8B7CF6] text-white border-[#7868E8]'
                    : 'bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]'
                }`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-xs font-bold text-[#24212B] truncate">
                      {conv.title}
                    </span>
                    {conv.last_message && (
                      <span className="text-[10px] tabular-nums text-[#827D8B] shrink-0 ml-2">
                        {formatMessageTime(conv.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#827D8B] truncate">
                    {conv.last_message ? (
                      conv.last_message.deleted_at ? (
                        <span className="italic">Message deleted</span>
                      ) : (
                        <span>
                          {conv.last_message.sender_name ? `${conv.last_message.sender_name}: ` : ''}
                          {conv.last_message.content || 'Attached file'}
                        </span>
                      )
                    ) : (
                      'Shared circle room for everyone'
                    )}
                  </p>
                </div>
                {conv.unread_count && conv.unread_count > 0 ? (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#8B7CF6] text-white text-[10px] font-bold flex items-center justify-center shrink-0 self-center">
                    {conv.unread_count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Unified Direct Chats & Friends Section */}
        <div className="py-2.5">
          <div className="px-4 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#0369A1]">
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Chats & Friends
            </span>
            <span className="tabular-nums font-mono text-[10px] text-[#0369A1] bg-[#E0F2FE] px-2 py-0.5 rounded-full font-semibold">
              {unifiedContacts.length}
            </span>
          </div>

          {unifiedContacts.length > 0 ? (
            <div className="space-y-0.5 mt-1">
              {unifiedContacts.map((item) => {
                const member = item.member;
                const conv = item.conversation;
                const isActive = conv ? conv.id === activeConversationId : false;
                const pal = getMemberAvatarPalette(member.avatar_color || member.id || member.display_name);

                return (
                  <div
                    key={item.id}
                    onClick={() => onStartDirectChat(member)}
                    className={`w-full px-4 py-2.5 flex items-center justify-between transition-all cursor-pointer min-h-[56px] group ${
                      isActive
                        ? 'bg-[#E0F2FE]/60 border-l-[3px] border-l-[#0284C7]'
                        : 'hover:bg-[#FAF8F5] active:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.display_name}
                            className="w-9 h-9 rounded-xl object-cover border shadow-2xs"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-xl text-xs font-semibold flex items-center justify-center uppercase border shadow-2xs"
                            style={{
                              backgroundColor: pal.bg,
                              color: pal.text,
                              borderColor: pal.border
                            }}
                          >
                            {member.display_name.charAt(0)}
                          </div>
                        )}
                        {member.is_online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between mb-0.5">
                          <span className="text-xs font-semibold text-[#24212B] truncate flex items-center gap-1">
                            <span>{member.display_name}</span>
                            {member.nickname && (
                              <span className="text-[10px] font-normal text-[#827D8B] font-mono">
                                @{member.nickname}
                              </span>
                            )}
                          </span>
                          {item.lastMessage && (
                            <span className="text-[10px] tabular-nums text-[#827D8B] shrink-0 ml-1">
                              {formatMessageTime(item.lastMessage.created_at)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#827D8B] truncate">
                          {item.lastMessage ? (
                            item.lastMessage.deleted_at ? (
                              <span className="italic">Message deleted</span>
                            ) : (
                              item.lastMessage.content || 'Attached file'
                            )
                          ) : (
                            member.status_text || (member.is_online ? 'Active now — Tap to chat' : 'Offline — Tap to chat')
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {item.unreadCount && item.unreadCount > 0 ? (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#0284C7] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {item.unreadCount}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartDirectChat(member);
                          }}
                          title={`Message ${member.display_name}`}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#827D8B] group-hover:text-[#0284C7] hover:bg-[#E0F2FE] rounded-lg transition-colors cursor-pointer"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onDeleteMember && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMemberToDelete(member);
                          }}
                          title={`Remove ${member.display_name}`}
                          aria-label={`Remove ${member.display_name}`}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#827D8B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-[#827D8B]">
              No friends in circle yet. As friends sign up, they will appear here.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Contact Deletion */}
      {memberToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMemberToDelete(null)}
        >
          <div
            className="w-full max-w-xs bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#24212B]">
              Remove {memberToDelete.display_name}?
            </h3>
            <p className="text-xs text-[#827D8B] mt-1 leading-relaxed">
              This will remove this user and their messages from your circle.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="flex-1 py-2 px-3 text-xs font-medium text-[#827D8B] bg-white border border-[#EAE5E0] hover:bg-[#FAF8F5] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteMember) {
                    onDeleteMember(memberToDelete.id);
                  }
                  setMemberToDelete(null);
                }}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
