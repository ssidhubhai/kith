import React, { useState } from 'react';
import { X, Check, Copy, RefreshCw, Database, Trash2 } from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured
} from '../lib/supabaseClient';
import { ChatEngine } from '../lib/chatEngine';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'sql' | 'guide'>('credentials');

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const result = await testSupabaseConnection(url, anonKey);
    setTestResult(result);
    setIsTesting(false);

    if (result.success) {
      saveSupabaseConfig(url, anonKey);
      onConfigUpdated();
    }
  };

  const handleResetToLocal = () => {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setTestResult({ success: true, message: 'Switched to local multi-tab sync mode.' });
    onConfigUpdated();
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabaseModalTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#24212B]/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl bg-white border border-[#EAE5E0] rounded-2xl shadow-[0_12px_40px_rgba(36,33,43,0.12)] flex flex-col max-h-[90vh] overflow-hidden text-[#24212B]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE5E0] bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#F0ECFF] text-[#8B7CF6]">
              <Database className="w-4 h-4" />
            </div>
            <h2 id="supabaseModalTitle" className="text-base font-bold text-[#24212B]">
              Supabase Backend Setup
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center border-b border-[#EAE5E0] px-6 bg-[#FAF8F5]/60">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 text-xs font-semibold border-b-2 mr-6 transition-all cursor-pointer ${
              activeTab === 'credentials'
                ? 'border-[#8B7CF6] text-[#8B7CF6]'
                : 'border-transparent text-[#827D8B] hover:text-[#24212B]'
            }`}
          >
            Connection & Keys
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 text-xs font-semibold border-b-2 mr-6 transition-all cursor-pointer ${
              activeTab === 'sql'
                ? 'border-[#8B7CF6] text-[#8B7CF6]'
                : 'border-transparent text-[#827D8B] hover:text-[#24212B]'
            }`}
          >
            SQL Migration
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'border-[#8B7CF6] text-[#8B7CF6]'
                : 'border-transparent text-[#827D8B] hover:text-[#24212B]'
            }`}
          >
            Deployment Guide
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm bg-white">
          {activeTab === 'credentials' && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#827D8B]">Current Engine Status:</span>
                  <span className="text-xs font-semibold text-[#8B7CF6] bg-[#F0ECFF] px-2 py-0.5 rounded-full">
                    {isSupabaseConfigured() ? 'Connected to Cloud Supabase' : 'Local Multi-Tab Mesh'}
                  </span>
                </div>
                <p className="text-xs text-[#827D8B] leading-relaxed">
                  Enter your free Supabase project credentials. When connected, Kith stores and synchronizes all messages, attachments, and real-time events via your cloud PostgreSQL database.
                </p>
              </div>

              <form onSubmit={handleSaveAndTest} className="space-y-4">
                <div>
                  <label htmlFor="sbUrl" className="block text-xs font-semibold text-[#24212B] mb-1.5 uppercase tracking-wider">
                    Project URL
                  </label>
                  <input
                    id="sbUrl"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="w-full h-10 px-3.5 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl text-xs font-mono text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:bg-white focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="sbKey" className="block text-xs font-semibold text-[#24212B] mb-1.5 uppercase tracking-wider">
                    Anon / Public Key
                  </label>
                  <input
                    id="sbKey"
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-10 px-3.5 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl text-xs font-mono text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:bg-white focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
                  />
                  <span className="text-[11px] text-[#827D8B] mt-1 block">
                    Found in Supabase Dashboard → Settings → API.
                  </span>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed border ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-4 py-2 bg-[#8B7CF6] hover:bg-[#7C6AE6] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save & Test Connection</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToLocal}
                    className="px-4 py-2 bg-[#F4F0EA] hover:bg-[#EAE5E0] border border-[#EAE5E0] text-xs font-semibold text-[#24212B] rounded-xl transition-colors cursor-pointer"
                  >
                    Use Local Engine
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#24212B]">
                    PostgreSQL Migration Script
                  </h3>
                  <p className="text-xs text-[#827D8B]">
                    Run this in your Supabase SQL Editor to initialize all tables, RLS, and realtime channels.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 bg-[#8B7CF6] hover:bg-[#7C6AE6] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl p-3.5 text-xs font-mono text-[#24212B] overflow-x-auto max-h-[300px]">
                <pre>{`-- Tables created:
-- 1. members (id, display_name, avatar_color, last_seen_at)
-- 2. conversations (id, type ['group','direct'], title, created_at)
-- 3. conversation_members (conversation_id, member_id, joined_at)
-- 4. messages (id, conversation_id, sender_id, content, reply_to, created_at)
-- 5. attachments (id, original_filename, storage_path, mime_type, file_size)
-- 6. message_reactions (id, message_id, member_id, emoji)
-- Full SQL file is at /supabase-schema.sql`}</pre>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-[#24212B] leading-relaxed">
              <div className="border-b border-[#EAE5E0] pb-3">
                <h4 className="font-bold text-sm mb-1 text-[#24212B]">1. Storage Bucket</h4>
                <p className="text-[#827D8B]">
                  In your Supabase Dashboard, create a bucket named <code className="bg-[#F0ECFF] text-[#6D28D9] px-1.5 py-0.5 rounded font-mono">kith_attachments</code> with public read enabled and a 50MB file size limit.
                </p>
              </div>
              <div className="border-b border-[#EAE5E0] pb-3">
                <h4 className="font-bold text-sm mb-1 text-[#24212B]">2. Vercel Free-Tier Hosting</h4>
                <p className="text-[#827D8B]">
                  Deploy with 1-click on Vercel by importing your repository. Add your <code className="bg-[#F0ECFF] text-[#6D28D9] px-1.5 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-[#F0ECFF] text-[#6D28D9] px-1.5 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> environment variables.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-sm mb-1 text-[#24212B]">3. Free-Plan Headroom</h4>
                <p className="text-[#827D8B]">
                  For a circle of 3–4 friends, Supabase Free Tier covers all quotas (up to 2,000,000 messages/mo and 500MB database).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] border-t border-[#EAE5E0] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear all local messages and cached data to start fresh?')) {
                ChatEngine.clearAllData();
                window.location.reload();
              }
            }}
            className="text-xs text-[#827D8B] hover:text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset and clear all data</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#EAE5E0] rounded-xl text-xs font-semibold text-[#24212B] hover:bg-[#F4F0EA] transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
