import React, { useState } from 'react';
import {
  Search,
  MessageSquare,
  Users,
  Database,
  UserCheck,
  Plus,
  Circle,
  Edit2,
  Check
} from 'lucide-react';
import { Conversation, Member } from '../types';
import { formatMessageTime } from '../utils/messageGrouping';
import { isSupabaseConfigured } from '../lib/supabaseClient';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (convId: string) => void;
  members: Member[];
  currentMember: Member;
  onStartDirectChat: (member: Member) => void;
  onOpenSupabaseModal: () => void;
  onUpdateDisplayName: (newName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  members,
  currentMember,
  onStartDirectChat,
  onOpenSupabaseModal,
  onUpdateDisplayName
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState(currentMember.display_name);

  const groupConversations = conversations.filter(c => c.type === 'group');
  const directConversations = conversations.filter(c => c.type === 'direct');

  // Filter conversations based on search
  const filteredGroups = groupConversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDirects = directConversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Other members in the group (excluding current user)
  const otherMembers = members.filter(m => m.id !== currentMember.id);
  const filteredOtherMembers = otherMembers.filter(m =>
    m.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isConnected = isSupabaseConfigured();

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNameValue.trim()) {
      onUpdateDisplayName(editingNameValue.trim());
      setIsEditingName(false);
    }
  };

  return (
    <aside
      aria-label="Sidebar navigation"
      className="w-full md:w-72 lg:w-80 h-full bg-[#FAFAFA] border-r border-[#E5E5E5] flex flex-col shrink-0 select-none"
    >
      {/* Top Brand Bar */}
      <div className="p-4 border-b border-[#E5E5E5] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-bold tracking-tight text-[#171717]">
            Kith
          </span>
          <span className="text-[11px] text-[#737373] tracking-wide uppercase font-medium">
            Messenger
          </span>
        </div>

        {/* Backend status indicator */}
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          title={isConnected ? 'Connected to Supabase PostgreSQL' : 'Local Multi-Tab Sync. Click to connect Supabase.'}
          className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#171717] transition-colors cursor-pointer py-1 px-2 border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-white"
        >
          <Database className="w-3 h-3 text-[#171717]" />
          <span className="text-[11px] font-medium hidden sm:inline">
            {isConnected ? 'Supabase' : 'Local Sync'}
          </span>
        </button>
      </div>

      {/* Current User Card / Quick Name Edit */}
      <div className="px-4 py-3 border-b border-[#E5E5E5] bg-white/50">
        {isEditingName ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={editingNameValue}
              onChange={(e) => setEditingNameValue(e.target.value)}
              className="flex-1 h-7 px-2 text-xs bg-white border border-[#171717] text-[#171717] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Save display name"
              className="p-1 bg-[#171717] text-white hover:bg-[#262626] transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 rounded-none bg-[#171717] text-white text-[11px] font-semibold flex items-center justify-center shrink-0 uppercase"
              >
                {currentMember.display_name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-[#171717] truncate">
                {currentMember.display_name}
              </span>
              <span className="text-[10px] text-[#737373]">(You)</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingNameValue(currentMember.display_name);
                setIsEditingName(true);
              }}
              title="Change display name"
              aria-label="Edit display name"
              className="p-1 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#E5E5E5] bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#737373]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#FAFAFA] border border-[#E5E5E5] text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F0F0F0]">
        {/* Group Chat Section */}
        <div className="py-2">
          <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wider text-[#737373]">
            Group
          </div>
          {filteredGroups.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white border-l-2 border-l-[#171717] shadow-xs'
                    : 'hover:bg-white/70'
                }`}
              >
                <div className="w-8 h-8 bg-[#171717] text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-xs font-semibold text-[#171717] truncate">
                      {conv.title}
                    </span>
                    {conv.last_message && (
                      <span className="text-[10px] tabular-nums text-[#737373] shrink-0 ml-2">
                        {formatMessageTime(conv.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#737373] truncate">
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
                      'No messages yet'
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Direct Conversations Section */}
        <div className="py-2">
          <div className="px-4 py-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[#737373]">
            <span>Direct Chats</span>
            <span className="tabular-nums font-mono text-[10px]">
              {directConversations.length}
            </span>
          </div>

          {filteredDirects.length > 0 ? (
            filteredDirects.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white border-l-2 border-l-[#171717] shadow-xs'
                      : 'hover:bg-white/70'
                  }`}
                >
                  <div className="w-8 h-8 bg-[#262626] text-white text-xs font-semibold flex items-center justify-center shrink-0 uppercase">
                    {conv.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-xs font-semibold text-[#171717] truncate">
                        {conv.title}
                      </span>
                      {conv.last_message && (
                        <span className="text-[10px] tabular-nums text-[#737373] shrink-0 ml-2">
                          {formatMessageTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#737373] truncate">
                      {conv.last_message ? (
                        conv.last_message.deleted_at ? (
                          <span className="italic">Message deleted</span>
                        ) : (
                          conv.last_message.content || 'Attached file'
                        )
                      ) : (
                        'Started a direct chat'
                      )}
                    </p>
                  </div>
                  {conv.unread_count && conv.unread_count > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-[#171717] shrink-0 self-center" />
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-xs text-[#737373]">
              No 1-on-1 chats yet. Click any friend below to start.
            </div>
          )}
        </div>

        {/* Discoverable Friends / People Panel */}
        <div className="py-2">
          <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wider text-[#737373]">
            Friends ({otherMembers.length})
          </div>

          <div className="space-y-0.5 mt-1">
            {filteredOtherMembers.map((member) => (
              <div
                key={member.id}
                className="px-4 py-2 flex items-center justify-between hover:bg-white transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <div className="w-7 h-7 bg-[#404040] text-white text-[11px] font-semibold flex items-center justify-center uppercase">
                      {member.display_name.charAt(0)}
                    </div>
                    {/* Real online presence dot */}
                    {member.is_online && (
                      <span
                        title="Online now"
                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs font-medium text-[#171717] truncate block">
                      {member.display_name}
                    </span>
                    <span className="text-[10px] text-[#737373] block">
                      {member.is_online ? 'Active now' : 'Seen recently'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartDirectChat(member)}
                  aria-label={`Start direct chat with ${member.display_name}`}
                  className="px-2 py-1 text-[11px] font-medium text-[#171717] bg-[#FAFAFA] hover:bg-[#E5E5E5] border border-[#E5E5E5] transition-colors cursor-pointer"
                >
                  Chat
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
