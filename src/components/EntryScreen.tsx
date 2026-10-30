import React, { useState, useEffect } from 'react';
import { ArrowRight, Database, Check, RefreshCw, Copy, Trash2, Sparkles, AlertCircle, WifiOff } from 'lucide-react';
import { Member, BackendInfo } from '../types';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  verifySupabaseConnection,
  isSupabaseConfigured,
  setExplicitLocalMode,
  getCurrentBackendInfo,
  subscribeToBackendInfo,
  refreshBackendStatus
} from '../lib/supabaseClient';
import { ChatEngine } from '../lib/chatEngine';

import { AvatarSelector } from './AvatarSelector';

interface EntryScreenProps {
  onEnter: (name: string, memberId?: string, initialProfile?: Partial<Member>) => void;
  currentMember?: Member | null;
  onClearData?: () => void;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({ onEnter, currentMember, onClearData }) => {
  const [name, setName] = useState(currentMember?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentMember?.avatar_url || '');
  const [avatarColor, setAvatarColor] = useState(currentMember?.avatar_color || '#8B7CF6');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [backendInfo, setBackendInfo] = useState<BackendInfo>(getCurrentBackendInfo());
  const [showConfig, setShowConfig] = useState(false);
  const currentConfig = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(currentConfig.url);
  const [sbKey, setSbKey] = useState(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [connectMessage, setConnectMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    refreshBackendStatus();
    const unsub = subscribeToBackendInfo((info) => {
      setBackendInfo(info);
    });
    return () => unsub();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please choose a display name to enter.');
      return;
    }
    setError(null);
    onEnter(trimmed, currentMember?.id, {
      avatar_url: avatarUrl || undefined,
      avatar_color: avatarColor
    });
  };

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setConnectMessage(null);

    const res = await verifySupabaseConnection(sbUrl, sbKey);
    setIsTesting(false);

    if (res.success) {
      saveSupabaseConfig(sbUrl, sbKey);
      await refreshBackendStatus();
      setConnectMessage({
        success: true,
        text: 'Supabase verified and connected! Enter your name below to start chatting.'
      });
      setShowConfig(false);
    } else {
      setConnectMessage({ success: false, text: res.message });
    }
  };

  const handleUseLocalDemo = () => {
    setExplicitLocalMode(true);
    setShowConfig(false);
  };

  const handleCopySql = async () => {
    try {
      const response = await fetch('/supabase-schema.sql');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  const handleExecuteReset = () => {
    ChatEngine.clearAllData();
    clearSupabaseConfig();
    setSbUrl('');
    setSbKey('');
    setName('');
    setConnectMessage({ success: true, text: 'Local data wiped. Ready for a clean start!' });
    setConfirmingReset(false);
    refreshBackendStatus();
    onClearData?.();
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-[440px] bg-white border border-[#EAE5E0] p-8 md:p-10 shadow-[0_4px_24px_rgba(36,33,43,0.04)] rounded-2xl space-y-6 relative">
        {/* Brand Lockup */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6]">
                <Sparkles className="w-4 h-4 fill-[#8B7CF6]" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#24212B]">
                  Kith
                </h1>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#8B7CF6] bg-[#F0ECFF] px-2 py-0.5 rounded-full">
                  Private Circle
                </span>
              </div>
            </div>

            {/* Quick settings gear to configure backend if needed */}
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              title="Database Configuration"
              aria-label="Database Configuration"
              className="p-1.5 text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-lg transition-colors cursor-pointer"
            >
              <Database className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#827D8B] leading-relaxed">
            A quiet, beautiful room for your closest friends. No algorithms, no noise.
          </p>
        </div>

        {/* Backend Status Banner */}
        {isConfigured ? (
          <div className="p-3 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  backendInfo.status === 'connected'
                    ? 'bg-emerald-500 ring-2 ring-emerald-100'
                    : backendInfo.status === 'missing_schema_or_permissions'
                    ? 'bg-amber-400 ring-2 ring-amber-100'
                    : 'bg-rose-500 ring-2 ring-rose-100'
                }`}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#24212B] truncate">
                  {backendInfo.status === 'connected'
                    ? 'Shared Supabase Cloud Backend'
                    : backendInfo.status === 'missing_schema_or_permissions'
                    ? 'Database Schema Missing'
                    : 'Connecting to Database...'}
                </p>
                <p className="text-[10px] text-[#827D8B] truncate">
                  {backendInfo.source === 'env' ? 'Configured via Vercel env' : 'Configured via browser storage'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] font-medium text-[#8B7CF6] hover:text-[#7C6AE6] transition-colors cursor-pointer shrink-0 ml-2"
            >
              {showConfig ? 'Hide' : 'Inspect'}
            </button>
          </div>
        ) : (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2.5 text-[#92400E]">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-amber-900">Cloud Backend Not Configured</p>
                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  To chat across separate devices, set <code className="font-mono bg-white/70 px-1 py-0.2 rounded border border-amber-200 text-amber-950">VITE_SUPABASE_URL</code> in Vercel, or connect below.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
              <button
                type="button"
                onClick={() => setShowConfig(true)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Configure Supabase
              </button>
              <button
                type="button"
                onClick={handleUseLocalDemo}
                className="px-2.5 py-1 bg-white border border-amber-200 hover:bg-amber-100/50 text-amber-900 text-[11px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                Use Local Demo (Single device)
              </button>
            </div>
          </div>
        )}

        {/* Expandable Configuration & Migration Panel */}
        {showConfig && (
          <div className="p-4 bg-[#F4F0EA]/70 border border-[#EAE5E0] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#8B7CF6]" />
                <span className="text-xs font-semibold text-[#24212B]">
                  Supabase Project Credentials
                </span>
              </div>
            </div>

            <form onSubmit={handleConnectSupabase} className="space-y-3 pt-1">
              <div>
                <label htmlFor="entrySbUrl" className="block text-[11px] font-medium uppercase tracking-wider text-[#827D8B] mb-1">
                  Project URL
                </label>
                <input
                  id="entrySbUrl"
                  type="url"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full h-9 px-3 bg-white border border-[#EAE5E0] rounded-lg text-xs font-mono text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
                />
              </div>

              <div>
                <label htmlFor="entrySbKey" className="block text-[11px] font-medium uppercase tracking-wider text-[#827D8B] mb-1">
                  Anon / Public Key
                </label>
                <input
                  id="entrySbKey"
                  type="password"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full h-9 px-3 bg-white border border-[#EAE5E0] rounded-lg text-xs font-mono text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
                />
              </div>

              {connectMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs leading-normal border ${
                    connectMessage.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {connectMessage.text}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isTesting || !sbUrl || !sbKey}
                  className="px-3.5 py-1.5 bg-[#8B7CF6] hover:bg-[#7C6AE6] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-40"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Verify & Connect</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-white border border-[#EAE5E0] hover:bg-[#F4F0EA] text-[#24212B] text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[#827D8B]" />
                      <span>Copy Schema SQL</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Display Name Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayNameInput"
              className="block text-xs font-semibold text-[#24212B] mb-2 uppercase tracking-wider"
            >
              What should friends call you?
            </label>
            <input
              id="displayNameInput"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Maya, Jordan, Alex"
              maxLength={32}
              className="w-full h-11 px-3.5 bg-[#F4F0EA]/50 border border-[#EAE5E0] rounded-xl text-sm text-[#24212B] placeholder-[#A39E98] focus:outline-none focus:border-[#8B7CF6] focus:bg-white focus:ring-2 focus:ring-[#8B7CF6]/20 transition-all"
            />
            {error && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{error}</p>
            )}
          </div>

          {/* Avatar Setup Block */}
          <div className="pt-1 border-t border-[#EAE5E0]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#24212B]">
                Your Avatar <span className="text-[10px] text-[#827D8B] font-normal">(choose or upload)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="text-[11px] font-medium text-[#8B7CF6] hover:text-[#7C6AE6] cursor-pointer"
              >
                {showAvatarPicker ? 'Hide Options' : avatarUrl ? 'Change Avatar' : 'Custom Avatar'}
              </button>
            </div>

            {showAvatarPicker ? (
              <div className="mt-2">
                <AvatarSelector
                  currentAvatarUrl={avatarUrl}
                  displayName={name || 'Friend'}
                  avatarColor={avatarColor}
                  onAvatarChange={(newUrl) => setAvatarUrl(newUrl)}
                />
              </div>
            ) : avatarUrl ? (
              <div className="flex items-center gap-2.5 p-2 bg-[#F0ECFF]/60 border border-[#DDD6FE] rounded-xl">
                <img src={avatarUrl} alt="Selected avatar" className="w-8 h-8 rounded-lg object-cover" />
                <span className="text-xs text-[#6D28D9] font-medium flex-1 truncate">Avatar selected!</span>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-[10px] text-rose-600 font-medium cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[#827D8B]">
                A letter avatar will be generated, or tap <button type="button" onClick={() => setShowAvatarPicker(true)} className="text-[#8B7CF6] font-medium underline cursor-pointer">Custom Avatar</button> to upload from computer or pick from gallery.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-[#8B7CF6] hover:bg-[#7C6AE6] active:bg-[#6D59D6] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            <span>Enter the Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer */}
        <div className="pt-3 border-t border-[#EAE5E0] flex items-center justify-between text-xs text-[#827D8B]">
          <span className="flex items-center gap-1.5 text-[11px]">
            {isConfigured ? 'Shared Cloud Room' : 'Local Testing Mode'}
          </span>
          {confirmingReset ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-rose-600 font-medium">Reset all?</span>
              <button
                type="button"
                onClick={handleExecuteReset}
                className="text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded cursor-pointer transition-all"
              >
                Yes, Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="text-[11px] text-[#6B6575] hover:text-[#24212B] px-1.5 py-0.5 rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              title="Reset and clear all local storage"
              className="flex items-center gap-1 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
