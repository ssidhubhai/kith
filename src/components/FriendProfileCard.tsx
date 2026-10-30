import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Clock,
  Smile,
  User,
  Copy,
  Check,
  Calendar,
  Mail,
  Maximize2,
  ShieldCheck,
  Share2
} from 'lucide-react';
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);

  if (!member) return null;

  const pal = getMemberAvatarPalette(member.avatar_color || member.id || member.display_name);

  const usernameToDisplay = member.username || member.nickname || '';

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const formatJoinedDate = (createdAt?: string) => {
    if (!createdAt) return 'Recent member';
    try {
      const date = new Date(createdAt);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return 'Recent member';
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-profile-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm sm:max-w-md bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="relative h-24 sm:h-28 bg-gradient-to-r from-[#EDE9FE] via-[#F3E8FF] to-[#FAE8FF] p-4 flex items-start justify-between shrink-0">
            <span className="px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-xs text-[11px] font-semibold text-[#6D28D9] border border-white/60 shadow-2xs">
              {isCurrentUser ? 'Your Profile' : 'Contact Card'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile details"
              className="w-8 h-8 flex items-center justify-center text-[#827D8B] hover:text-[#24212B] bg-white/80 hover:bg-white rounded-full transition-all shadow-2xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="px-5 sm:px-6 pb-6 pt-0 overflow-y-auto space-y-5 -mt-12">
            {/* Avatar & Online Badge */}
            <div className="flex flex-col items-center text-center">
              <div className="relative group cursor-pointer" onClick={() => setIsPhotoExpanded(true)}>
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.display_name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-[#FAF8F5] shadow-md group-hover:opacity-95 transition-opacity"
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl text-3xl font-bold flex items-center justify-center uppercase border-4 border-[#FAF8F5] shadow-md group-hover:opacity-95 transition-opacity"
                    style={{
                      backgroundColor: pal.bg,
                      color: pal.text,
                    }}
                  >
                    {member.display_name.charAt(0)}
                  </div>
                )}

                {/* Expand image overlay hint */}
                <div className="absolute inset-0 rounded-3xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5 drop-shadow-md" />
                </div>

                {/* Online Indicator Dot */}
                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full ring-4 ring-[#FAF8F5] ${
                    member.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-[#C4C0C9]'
                  }`}
                  title={member.is_online ? 'Online' : 'Offline'}
                />
              </div>

              {/* Name & Title */}
              <h3 id="friend-profile-title" className="mt-3 text-lg sm:text-xl font-bold text-[#24212B]">
                {member.display_name}
              </h3>

              {usernameToDisplay && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-mono text-[#8B7CF6] font-semibold">
                    @{usernameToDisplay}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`@${usernameToDisplay}`, 'username')}
                    className="p-1 text-[#827D8B] hover:text-[#8B7CF6] transition-colors rounded cursor-pointer"
                    title="Copy username"
                  >
                    {copiedField === 'username' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Last seen / Status */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[#827D8B]">
                <Clock className="w-3.5 h-3.5 text-[#8B7CF6]" />
                <span>{formatLastSeen(member.last_seen_at)}</span>
              </div>
            </div>

            {/* About / Bio Status Section */}
            <div className="bg-white rounded-2xl p-4 border border-[#EAE5E0] shadow-2xs space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#827D8B] flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-[#8B7CF6]" />
                <span>About / Bio</span>
              </div>
              <p className="text-xs font-medium text-[#24212B] leading-relaxed italic">
                {member.status_text ? `"${member.status_text}"` : 'No bio status added yet.'}
              </p>
            </div>

            {/* WhatsApp-Style Information Details Grid */}
            <div className="bg-white rounded-2xl border border-[#EAE5E0] shadow-2xs divide-y divide-[#EAE5E0]/60">
              {/* Username row */}
              {usernameToDisplay && (
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#F0ECFF] text-[#8B7CF6] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-[#827D8B] uppercase tracking-wider font-semibold">Username</div>
                      <div className="text-xs font-mono font-medium text-[#24212B]">@{usernameToDisplay}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(`@${usernameToDisplay}`, 'username_row')}
                    className="px-2.5 py-1 text-xs font-medium text-[#8B7CF6] hover:bg-[#F0ECFF] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'username_row' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Email row (if present) */}
              {member.email && (
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-[#827D8B] uppercase tracking-wider font-semibold">Email</div>
                      <div className="text-xs font-medium text-[#24212B] truncate max-w-[180px]">{member.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(member.email!, 'email')}
                    className="p-1.5 text-[#827D8B] hover:text-[#0284C7] rounded-lg transition-colors cursor-pointer"
                    title="Copy email"
                  >
                    {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {/* Joined Date row */}
              <div className="p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#827D8B] uppercase tracking-wider font-semibold">Member Since</div>
                  <div className="text-xs font-medium text-[#24212B]">{formatJoinedDate(member.created_at)}</div>
                </div>
              </div>

              {/* Auth Provider Security Badge */}
              <div className="p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#827D8B] uppercase tracking-wider font-semibold">Verified Account</div>
                  <div className="text-xs font-medium text-[#24212B] capitalize">
                    {member.auth_provider ? `${member.auth_provider} Authenticated` : 'Registered Kith Circle Member'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="space-y-2 pt-1">
              {isCurrentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditProfile?.();
                  }}
                  className="w-full py-2.5 px-4 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Edit Profile & Avatar</span>
                </button>
              ) : (
                <>
                  {onStartDirectChat && (
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
                  )}

                  {usernameToDisplay && (
                    <button
                      type="button"
                      onClick={() => handleCopy(`https://kithchat.vercel.app/?user=${encodeURIComponent(usernameToDisplay)}`, 'share')}
                      className="w-full py-2 px-4 bg-white border border-[#EAE5E0] hover:bg-[#FAF8F5] text-[#24212B] text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#827D8B]" />
                      <span>{copiedField === 'share' ? 'Profile Link Copied!' : 'Share Profile Link'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Avatar Lightbox Modal */}
      {isPhotoExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsPhotoExpanded(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
            <button
              type="button"
              onClick={() => setIsPhotoExpanded(false)}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            className="relative max-w-lg max-h-[80vh] flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.display_name}
                className="max-w-full max-h-[75vh] rounded-3xl object-contain shadow-2xl border-2 border-white/20"
              />
            ) : (
              <div
                className="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl text-7xl font-bold flex items-center justify-center uppercase shadow-2xl border-4 border-white/20"
                style={{
                  backgroundColor: pal.bg,
                  color: pal.text,
                }}
              >
                {member.display_name.charAt(0)}
              </div>
            )}

            <div className="mt-4 text-center text-white space-y-1">
              <h4 className="text-lg font-bold">{member.display_name}</h4>
              {usernameToDisplay && (
                <p className="text-xs text-purple-300 font-mono">@{usernameToDisplay}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
