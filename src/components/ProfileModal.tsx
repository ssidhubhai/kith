import React, { useState } from 'react';
import { X, Check, EyeOff, Smile, Palette, Sparkles, User, Image as ImageIcon } from 'lucide-react';
import { Member } from '../types';
import { getMemberAvatarPalette } from '../utils/avatarUtils';
import { AvatarSelector } from './AvatarSelector';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMember: Member;
  onSaveProfile: (updates: Partial<Member>) => Promise<void>;
}

const PRESET_STATUSES = [
  '✨ Available',
  '⚡ In the zone',
  '☕ Coffee break',
  '🌿 In nature',
  '🎧 Listening',
  '🌙 Away'
];

const AVATAR_PALETTES = [
  { name: 'Lavender', color: '#8B7CF6', bg: '#F0ECFF', text: '#6D28D9', border: '#DDD6FE' },
  { name: 'Sage', color: '#10B981', bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { name: 'Rose', color: '#F43F5E', bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { name: 'Butter', color: '#F59E0B', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  { name: 'Sky', color: '#0EA5E9', bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  { name: 'Peach', color: '#F97316', bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  { name: 'Orchid', color: '#A855F7', bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
  { name: 'Mint', color: '#14B8A6', bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentMember,
  onSaveProfile
}) => {
  const [displayName, setDisplayName] = useState(currentMember.display_name || '');
  const [nickname, setNickname] = useState(currentMember.nickname || '');
  const [statusText, setStatusText] = useState(currentMember.status_text || '');
  const [avatarColor, setAvatarColor] = useState(currentMember.avatar_color || '#8B7CF6');
  const [avatarUrl, setAvatarUrl] = useState(currentMember.avatar_url || '');
  const [hideLastSeen, setHideLastSeen] = useState(!!currentMember.hide_last_seen);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentPalette = getMemberAvatarPalette(avatarColor);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSaving(true);
    try {
      await onSaveProfile({
        display_name: displayName.trim(),
        nickname: nickname.trim() || undefined,
        status_text: statusText.trim() || undefined,
        avatar_color: avatarColor,
        avatar_url: avatarUrl.trim() || undefined,
        hide_last_seen: hideLastSeen
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EAE5E0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="profile-modal-title" className="text-sm font-bold text-[#24212B]">
                Your Profile & Identity
              </h2>
              <p className="text-[11px] text-[#827D8B]">How your friends see you in Kith</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile editor"
            className="w-8 h-8 flex items-center justify-center text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 p-3.5 bg-white rounded-2xl border border-[#EAE5E0]">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 shadow-xs"
                  style={{ borderColor: avatarColor }}
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl text-xl font-bold flex items-center justify-center uppercase border-2 shadow-xs transition-colors"
                  style={{
                    backgroundColor: currentPalette.bg,
                    color: currentPalette.text,
                    borderColor: avatarColor
                  }}
                >
                  {displayName ? displayName.charAt(0) : '?'}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#24212B] truncate">
                {displayName || 'Your Name'}
                {nickname && <span className="text-xs text-[#827D8B] font-normal ml-1.5">({nickname})</span>}
              </div>
              <div className="text-xs text-[#8B7CF6] font-medium truncate mt-0.5">
                {statusText || 'No status set'}
              </div>
              <div className="text-[10px] text-[#827D8B] mt-1">
                {hideLastSeen ? 'Last seen: Hidden' : 'Last seen: Visible to friends'}
              </div>
            </div>
          </div>

          {/* Display Name & Nickname */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#24212B] mb-1">
                Display Name <span className="text-[#8B7CF6]">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-3 text-[#827D8B]" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Maya"
                  className="w-full h-9 pl-8.5 pr-3 text-xs bg-white border border-[#EAE5E0] rounded-xl text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24212B] mb-1">
                Nickname <span className="text-[10px] text-[#827D8B] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. May"
                className="w-full h-9 px-3 text-xs bg-white border border-[#EAE5E0] rounded-xl text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30"
              />
            </div>
          </div>

          {/* Status Message */}
          <div>
            <label className="block text-xs font-semibold text-[#24212B] mb-1">
              Status Message
            </label>
            <div className="relative mb-2">
              <Smile className="w-3.5 h-3.5 absolute left-3 top-3 text-[#827D8B]" />
              <input
                type="text"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="What are you up to?"
                className="w-full h-9 pl-8.5 pr-3 text-xs bg-white border border-[#EAE5E0] rounded-xl text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30"
              />
            </div>

            {/* Quick Status Chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_STATUSES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStatusText(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    statusText === preset
                      ? 'bg-[#F0ECFF] border-[#8B7CF6] text-[#6D28D9] font-medium'
                      : 'bg-white border-[#EAE5E0] text-[#827D8B] hover:text-[#24212B] hover:border-[#8B7CF6]/30'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Palette */}
          <div>
            <label className="block text-xs font-semibold text-[#24212B] mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#8B7CF6]" />
              <span>Accent Color</span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_PALETTES.map((pal) => (
                <button
                  key={pal.name}
                  type="button"
                  onClick={() => setAvatarColor(pal.color)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
                    avatarColor === pal.color
                      ? 'ring-2 ring-[#8B7CF6] border-transparent scale-105'
                      : 'border-[#EAE5E0] hover:border-[#8B7CF6]/40'
                  }`}
                  style={{ backgroundColor: pal.bg }}
                  title={pal.name}
                >
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: pal.color }}
                  />
                  <span className="text-[9px] font-medium truncate" style={{ color: pal.text }}>
                    {pal.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Avatar Selector (Computer Upload & Gallery Presets) */}
          <div>
            <label className="block text-xs font-semibold text-[#24212B] mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8B7CF6]" />
              <span>Profile Avatar</span>
            </label>
            <AvatarSelector
              currentAvatarUrl={avatarUrl}
              displayName={displayName}
              avatarColor={avatarColor}
              onAvatarChange={(newUrl) => setAvatarUrl(newUrl)}
            />
          </div>

          {/* Privacy Toggle: Hide Last Seen */}
          <div className="pt-2 border-t border-[#EAE5E0]">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#EAE5E0] cursor-pointer hover:bg-[#FAF8F5] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F4F0EA] flex items-center justify-center text-[#827D8B]">
                  <EyeOff className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#24212B]">Hide Last-Seen Time</div>
                  <div className="text-[10px] text-[#827D8B]">Friends will only see you as active when online</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hideLastSeen}
                onChange={(e) => setHideLastSeen(e.target.checked)}
                className="w-4 h-4 accent-[#8B7CF6] rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#827D8B] hover:text-[#24212B] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !displayName.trim()}
              className="px-4 py-2 text-xs font-semibold bg-[#8B7CF6] text-white hover:bg-[#7868E8] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
