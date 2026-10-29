import React from 'react';
import { X, MessageSquare, Clock, Smile, User } from 'lucide-react';
import { Member } from '../types';
import { getMemberAvatarPalette } from '../utils/avatarUtils';

interface FriendProfileCardProps {
  member: Member | null;
  onClose: () => void;
  onStartDirectChat?: (member: Member) => void;
  isCurrentUser?: boolean;
  onEditProfile?: () => void;
}

export const FriendProfileCard: React.FC<FriendProfileCardProps> = ({
  member,
  onClose,
  onStartDirectChat,
  isCurrentUser,
  onEditProfile
}) => {
  if (!member) return null;

  const pal = getMemberAvatarPalette(member.avatar_color || member.id || member.display_name);

  const formatLastSeen = (lastSeenAt: string) => {
    if (member.is_online) return 'Active now';
    if (member.hide_last_seen) return 'Offline';
    try {
      const date = new Date(lastSeenAt);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 2) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xs sm:max-w-sm bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl overflow-hidden p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close friend card"
            className="w-7 h-7 flex items-center justify-center text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center -mt-2">
          {/* Avatar with ring */}
          <div className="relative mb-3">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.display_name}
                className="w-20 h-20 rounded-3xl object-cover border-2 shadow-sm"
                style={{ borderColor: member.avatar_color || pal.border }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-3xl text-2xl font-bold flex items-center justify-center uppercase border-2 shadow-sm"
                style={{
                  backgroundColor: pal.bg,
                  color: pal.text,
                  borderColor: member.avatar_color || pal.border
                }}
              >
                {member.display_name.charAt(0)}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-white ${
                member.is_online ? 'bg-emerald-500' : 'bg-[#C4C0C9]'
              }`}
            />
          </div>

          <h3 id="friend-profile-title" className="text-base font-bold text-[#24212B]">
            {member.display_name}
          </h3>

          {member.nickname && (
            <p className="text-xs text-[#827D8B]">@{member.nickname}</p>
          )}

          {/* Status Message badge */}
          {member.status_text && (
            <div className="mt-2.5 px-3 py-1 bg-[#F0ECFF] border border-[#DDD6FE] text-[#6D28D9] rounded-full text-xs font-medium flex items-center gap-1.5 shadow-2xs">
              <Smile className="w-3.5 h-3.5 text-[#8B7CF6]" />
              <span className="truncate max-w-[200px]">{member.status_text}</span>
            </div>
          )}

          {/* Last Seen info */}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#827D8B]">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatLastSeen(member.last_seen_at)}</span>
          </div>

          {/* Action button */}
          <div className="mt-5 w-full">
            {isCurrentUser ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditProfile?.();
                }}
                className="w-full py-2.5 px-4 bg-white border border-[#EAE5E0] hover:border-[#8B7CF6] text-[#24212B] text-xs font-semibold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4 text-[#8B7CF6]" />
                <span>Edit Your Profile</span>
              </button>
            ) : (
              onStartDirectChat && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartDirectChat(member);
                  }}
                  className="w-full py-2.5 px-4 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send Direct Message</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
