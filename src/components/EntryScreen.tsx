import React, { useState } from 'react';
import { ArrowRight, Database, Check, RefreshCw, Copy, Trash2, Sparkles } from 'lucide-react';
import { Member } from '../types';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured
} from '../lib/supabaseClient';
import { ChatEngine } from '../lib/chatEngine';

interface EntryScreenProps {
  onEnter: (name: string, memberId?: string) => void;
  currentMember?: Member | null;
  onClearData?: () => void;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({ onEnter, currentMember, onClearData }) => {
  const [name, setName] = useState(currentMember?.display_name || '');
  const [error, setError] = useState<string | null>(null);

  const currentConfig = getSupabaseConfig();
  const [showConfig, setShowConfig] = useState(!isSupabaseConfigured());
  const [sbUrl, setSbUrl] = useState(currentConfig.url);
  const [sbKey, setSbKey] = useState(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [connectMessage, setConnectMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please choose a display name to enter.');
      return;
    }
    setError(null);
    onEnter(trimmed);
  };

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setConnectMessage(null);

    const res = await testSupabaseConnection(sbUrl, sbKey);
    setIsTesting(false);

    if (res.success) {
      saveSupabaseConfig(sbUrl, sbKey);
      setConnectMessage({ success: true, text: 'Supabase connected! Enter your name below to start chatting.' });
    } else {
      setConnectMessage({ success: false, text: res.message });
    }
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

  const handleResetData = () => {
    if (confirm('Clear all local data and reset the workspace?')) {
      ChatEngine.clearAllData();
      clearSupabaseConfig();
      setSbUrl('');
      setSbKey('');
      setName('');
      setConnectMessage({ success: true, text: 'Local data wiped. Ready for a clean start!' });
      onClearData?.();
    }
  };

  const isConnected = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-[440px] bg-white border border-[#EAE5E0] p-8 md:p-10 shadow-[0_4px_24px_rgba(36,33,43,0.04)] rounded-2xl space-y-6">
        {/* Brand Lockup */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6]">
              <Sparkles className="w-4 h-4 fill-[#8B7CF6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#24212B]">
                  Kith
                </h1>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#8B7CF6] bg-[#F0ECFF] px-2 py-0.5 rounded-full">
                  Private Circle
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#827D8B] leading-relaxed">
            A quiet, beautiful room for your closest friends. No algorithms, no noise.
          </p>
        </div>

        {/* Supabase Connection Panel */}
        <div className="p-4 bg-[#F4F0EA]/70 border border-[#EAE5E0] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#8B7CF6]" />
              <span className="text-xs font-semibold text-[#24212B]">
                Supabase Backend
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] font-medium text-[#8B7CF6] hover:text-[#7C6AE6] transition-colors cursor-pointer"
            >
              {showConfig ? 'Hide Config' : isConnected ? 'Connected (Edit)' : 'Configure Keys'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-400 ring-2 ring-amber-100'
              }`}
            />
            <span className="text-xs text-[#24212B] font-medium">
              {isConnected ? 'Connected to live Supabase project' : 'Local Multi-Tab Mesh active'}
            </span>
          </div>

          {showConfig && (
            <form onSubmit={handleConnectSupabase} className="mt-3 space-y-3 pt-2.5 border-t border-[#EAE5E0]">
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
                  className="w-full h-9 px-3 bg-white border border-[#EAE5E5] rounded-lg text-xs font-mono text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
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
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Connect Project</span>
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
          )}
        </div>

        {/* Display Name Entry */}
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

          <button
            type="submit"
            className="w-full h-11 bg-[#8B7CF6] hover:bg-[#7C6AE6] active:bg-[#6D59D6] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            <span>Enter the Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Bottom actions */}
        <div className="pt-3 border-t border-[#EAE5E0] flex items-center justify-between text-xs text-[#827D8B]">
          <span>Warm & minimal</span>
          <button
            type="button"
            onClick={handleResetData}
            title="Reset and clear all local storage"
            className="flex items-center gap-1 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Reset data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
