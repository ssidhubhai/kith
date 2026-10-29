import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Shield,
  Palette,
  Sparkles,
  Smile,
  LogOut,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  KeyRound,
  Link2,
  Unlink
} from 'lucide-react';
import { Member } from '../types';
import { getMemberAvatarPalette } from '../utils/avatarUtils';
import {
  getCurrentAuthUser,
  getAuthIdentities,
  linkGoogleAccount,
  unlinkProviderAccount,
  updateUserPassword
} from '../lib/supabaseClient';
import { validatePassword, validatePasswordMatch } from '../utils/authValidation';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMember: Member;
  onSaveProfile: (updates: Partial<Member>) => Promise<void>;
  onSignOut: () => Promise<void>;
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

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentMember,
  onSaveProfile,
  onSignOut
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile Form state
  const [displayName, setDisplayName] = useState(currentMember.display_name || '');
  const [nickname, setNickname] = useState(currentMember.nickname || '');
  const [statusText, setStatusText] = useState(currentMember.status_text || '');
  const [avatarColor, setAvatarColor] = useState(currentMember.avatar_color || '#8B7CF6');
  const [avatarUrl, setAvatarUrl] = useState(currentMember.avatar_url || '');
  const [hideLastSeen, setHideLastSeen] = useState(!!currentMember.hide_last_seen);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Security & Connected Accounts state
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [identities, setIdentities] = useState<any[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [confirmingUnlinkId, setConfirmingUnlinkId] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentMember.display_name || '');
      setNickname(currentMember.nickname || '');
      setStatusText(currentMember.status_text || '');
      setAvatarColor(currentMember.avatar_color || '#8B7CF6');
      setAvatarUrl(currentMember.avatar_url || '');
      setHideLastSeen(!!currentMember.hide_last_seen);
      setPasswordMessage(null);
      setOauthError(null);

      // Load auth identities
      getCurrentAuthUser().then(user => {
        setAuthUser(user);
        if (user?.identities) {
          setIdentities(user.identities);
        } else {
          getAuthIdentities().then(ids => setIdentities(ids));
        }
      });
    }
  }, [isOpen, currentMember]);

  const currentPalette = getMemberAvatarPalette(avatarColor);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSavingProfile(true);
    try {
      await onSaveProfile({
        display_name: displayName.trim(),
        nickname: nickname.trim() || undefined,
        status_text: statusText.trim() || undefined,
        avatar_color: avatarColor,
        avatar_url: avatarUrl.trim() || undefined,
        hide_last_seen: hideLastSeen
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    const pVal = validatePassword(newPassword);
    if (!pVal.valid) {
      setPasswordMessage({ success: false, text: pVal.error || 'Invalid password' });
      return;
    }

    const mVal = validatePasswordMatch(newPassword, confirmNewPassword);
    if (!mVal.valid) {
      setPasswordMessage({ success: false, text: mVal.error || 'Passwords do not match' });
      return;
    }

    setPasswordLoading(true);
    const res = await updateUserPassword(newPassword);
    setPasswordLoading(false);

    if (res.success) {
      setPasswordMessage({ success: true, text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      setPasswordMessage({ success: false, text: res.error || 'Failed to update password.' });
    }
  };

  const handleLinkGoogle = async () => {
    setOauthLoading(true);
    setOauthError(null);
    const res = await linkGoogleAccount();
    if (!res.success) {
      setOauthLoading(false);
      setOauthError(res.error || 'Could not link Google account.');
    }
  };

  const handleUnlinkGoogle = async (identity: any) => {
    if (identities.length <= 1) {
      setOauthError('You must have at least one authentication method active to prevent account lockout.');
      return;
    }

    setOauthLoading(true);
    setOauthError(null);
    setConfirmingUnlinkId(null);
    const res = await unlinkProviderAccount(identity);
    setOauthLoading(false);

    if (res.success) {
      setIdentities(prev => prev.filter(i => i.id !== identity.id));
    } else {
      setOauthError(res.error || 'Failed to unlink Google account.');
    }
  };

  const googleIdentity = identities.find(i => i.provider === 'google');
  const emailIdentity = identities.find(i => i.provider === 'email');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE5E0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6] shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="account-modal-title" className="text-base font-bold text-[#24212B]">
                Account & Settings
              </h2>
              <p className="text-xs text-[#827D8B]">Manage your profile and permanent credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#827D8B] hover:text-[#24212B] hover:bg-[#F5F2EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 bg-white border-b border-[#EAE5E0] flex gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 relative transition-colors ${
              activeTab === 'profile' ? 'text-[#8B7CF6]' : 'text-[#827D8B] hover:text-[#24212B]'
            }`}
          >
            Profile & Presence
            {activeTab === 'profile' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B7CF6] rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 relative transition-colors ${
              activeTab === 'security' ? 'text-[#8B7CF6]' : 'text-[#827D8B] hover:text-[#24212B]'
            }`}
          >
            Account Security & Google
            {activeTab === 'security' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B7CF6] rounded-full" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Live Avatar Preview */}
              <div className="flex items-center gap-4 p-4 bg-white border border-[#EAE5E0] rounded-2xl shadow-2xs">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold border transition-all shrink-0"
                  style={{
                    backgroundColor: currentPalette.bg,
                    borderColor: currentPalette.border,
                    color: currentPalette.text
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover rounded-2xl"
                      onError={() => setAvatarUrl('')}
                    />
                  ) : (
                    displayName.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#24212B] truncate">{displayName || 'Anonymous'}</span>
                    {currentMember.username && (
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-[#F5F2EB] text-[#827D8B] rounded-md">
                        @{currentMember.username}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#827D8B] mt-0.5 truncate">
                    {statusText || 'No status set'}
                  </p>
                </div>
              </div>

              {/* Display Name & Nickname */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#4A4553] mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#EAE5E0] focus:border-[#8B7CF6] rounded-xl text-sm text-[#24212B] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A4553] mb-1.5">
                    Nickname <span className="text-[#A39EAA] font-normal">(friend circle)</span>
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Jordy"
                    className="w-full px-3 py-2 bg-white border border-[#EAE5E0] focus:border-[#8B7CF6] rounded-xl text-sm text-[#24212B] outline-none"
                  />
                </div>
              </div>

              {/* Status Text & Presets */}
              <div>
                <label className="block text-xs font-medium text-[#4A4553] mb-1.5">Status Message</label>
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="What's happening?"
                  maxLength={60}
                  className="w-full px-3 py-2 bg-white border border-[#EAE5E0] focus:border-[#8B7CF6] rounded-xl text-sm text-[#24212B] outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_STATUSES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStatusText(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        statusText === preset
                          ? 'bg-[#F0ECFF] text-[#6D28D9] border-[#DDD6FE]'
                          : 'bg-white text-[#6B6575] border-[#EAE5E0] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Palette Picker */}
              <div>
                <label className="block text-xs font-medium text-[#4A4553] mb-1.5">Avatar Color Theme</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {AVATAR_PALETTES.map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setAvatarColor(p.color)}
                      className="group flex flex-col items-center gap-1 focus:outline-none"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          avatarColor === p.color
                            ? 'ring-2 ring-[#8B7CF6] ring-offset-2 scale-105'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.bg, border: `1px solid ${p.border}` }}
                      >
                        {avatarColor === p.color && <Check className="w-4 h-4" style={{ color: p.text }} />}
                      </div>
                      <span className="text-[10px] text-[#827D8B] truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Image URL */}
              <div>
                <label className="block text-xs font-medium text-[#4A4553] mb-1.5">Custom Avatar URL (Optional)</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 bg-white border border-[#EAE5E0] focus:border-[#8B7CF6] rounded-xl text-sm text-[#24212B] outline-none"
                />
              </div>

              {/* Privacy: Hide Last Seen */}
              <label className="flex items-center gap-3 p-3 bg-white border border-[#EAE5E0] rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideLastSeen}
                  onChange={(e) => setHideLastSeen(e.target.checked)}
                  className="w-4 h-4 text-[#8B7CF6] rounded border-[#EAE5E0] focus:ring-[#8B7CF6]"
                />
                <div className="flex-1 text-xs">
                  <div className="font-medium text-[#24212B]">Hide Last Seen Status</div>
                  <div className="text-[#827D8B]">Friends won't see your last active timestamp</div>
                </div>
              </label>

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-between">
                {profileSuccess && (
                  <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Profile updated!
                  </span>
                )}
                {!profileSuccess && <div />}

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-[#8B7CF6] hover:bg-[#7C6BF5] text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2"
                >
                  {isSavingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Save Profile</span>}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY & CONNECTED ACCOUNTS */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {oauthError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{oauthError}</span>
                </div>
              )}

              {/* Permanent Account Identity */}
              <div className="p-4 bg-white border border-[#EAE5E0] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#24212B] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#8B7CF6]" />
                    Permanent Identity
                  </h3>
                  <span className="text-[11px] font-mono text-[#827D8B] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#EAE5E0]">
                    Supabase Auth
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#A39EAA] block text-[10px] uppercase font-mono">Username</span>
                    <span className="font-semibold text-[#24212B]">
                      {currentMember.username ? `@${currentMember.username}` : 'Not assigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#A39EAA] block text-[10px] uppercase font-mono">Account Email</span>
                    <span className="font-semibold text-[#24212B]">
                      {currentMember.email || authUser?.email || 'None on record'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[#A39EAA] block text-[10px] uppercase font-mono">User ID</span>
                    <span className="font-mono text-[11px] text-[#6B6575] break-all">{currentMember.id}</span>
                  </div>
                </div>
              </div>

              {/* Connected Accounts: Google */}
              <div className="p-4 bg-white border border-[#EAE5E0] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#24212B]">Connected Accounts</h3>
                    <p className="text-[11px] text-[#827D8B]">Sign in with linked external providers</p>
                  </div>
                </div>

                {/* Google Provider Card */}
                <div className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#EAE5E0] flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#24212B]">Google</span>
                        {googleIdentity ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Connected
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#827D8B] bg-white border border-[#EAE5E0] px-2 py-0.5 rounded-full font-medium">
                            Not Linked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#827D8B]">
                        {googleIdentity?.identity_data?.email ||
                          (googleIdentity ? 'Linked to account' : 'Link to enable 1-click Google sign in')}
                      </p>
                    </div>
                  </div>

                  {googleIdentity ? (
                    confirmingUnlinkId === googleIdentity.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-rose-700 font-medium">Unlink Google?</span>
                        <button
                          type="button"
                          disabled={oauthLoading}
                          onClick={() => handleUnlinkGoogle(googleIdentity)}
                          className="text-xs text-white bg-rose-600 hover:bg-rose-700 font-medium px-2.5 py-1 rounded-lg transition-all"
                        >
                          Yes, Unlink
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingUnlinkId(null)}
                          className="text-xs text-[#6B6575] hover:text-[#24212B] px-2 py-1 bg-white border border-[#EAE5E0] rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={oauthLoading}
                        onClick={() => setConfirmingUnlinkId(googleIdentity.id)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={oauthLoading}
                      onClick={handleLinkGoogle}
                      className="text-xs text-[#24212B] hover:text-[#8B7CF6] font-medium px-3.5 py-1.5 bg-white border border-[#EAE5E0] hover:border-[#8B7CF6] rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <Link2 className="w-3.5 h-3.5 text-[#8B7CF6]" />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Change Password */}
              <form onSubmit={handleUpdatePassword} className="p-4 bg-white border border-[#EAE5E0] rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#24212B] flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#8B7CF6]" />
                    Change Password
                  </h3>
                </div>

                {passwordMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      passwordMessage.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {passwordMessage.success ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span>{passwordMessage.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#4A4553] mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 chars"
                        className="w-full px-3 pr-9 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#A39EAA] hover:text-[#4A4553]"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A4553] mb-1">Confirm New Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#EAE5E0] focus:border-[#8B7CF6] focus:bg-white rounded-xl text-sm text-[#24212B] outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={passwordLoading || !newPassword}
                    className="px-4 py-2 bg-[#24212B] hover:bg-[#383344] disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                  >
                    {passwordLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Sign Out Card */}
              <div className="p-4 bg-rose-50/50 border border-rose-200/60 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-900">Sign Out</h4>
                  <p className="text-[11px] text-rose-700/80">
                    Sign out of this browser. Your messages and account remain safe in the cloud.
                  </p>
                </div>
                {confirmingSignOut ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onSignOut();
                        onClose();
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Confirm Sign Out</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingSignOut(false)}
                      className="px-3 py-1.5 bg-white hover:bg-[#FAF8F5] text-[#4A4553] border border-[#EAE5E0] text-xs font-medium rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingSignOut(true)}
                    className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
