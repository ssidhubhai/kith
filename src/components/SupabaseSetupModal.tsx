import React, { useState } from 'react';
import { X, Check, Copy, ExternalLink, RefreshCw, Database } from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured
} from '../lib/supabaseClient';

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
      // Fallback
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabaseModalTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl bg-white border border-[#E5E5E5] shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#171717]" />
            <h2 id="supabaseModalTitle" className="text-base font-semibold text-[#171717]">
              Supabase Backend & Database Setup
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center border-b border-[#E5E5E5] px-6">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 text-xs font-medium border-b-2 mr-6 transition-colors cursor-pointer ${
              activeTab === 'credentials'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            Connection & Keys
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 text-xs font-medium border-b-2 mr-6 transition-colors cursor-pointer ${
              activeTab === 'sql'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            SQL Migration
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'guide'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:text-[#171717]'
            }`}
          >
            Deployment Guide
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {activeTab === 'credentials' && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#737373]">Current Status:</span>
                  <span className="text-xs font-medium text-[#171717]">
                    {isSupabaseConfigured() ? 'Connected to Cloud Supabase' : 'Local Multi-Tab Sync Active'}
                  </span>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">
                  Enter your free Supabase project credentials below. If blank, Kith runs in multi-tab local sync mode with instant message exchange across tabs.
                </p>
              </div>

              <form onSubmit={handleSaveAndTest} className="space-y-4">
                <div>
                  <label htmlFor="sbUrl" className="block text-xs font-medium text-[#171717] mb-1.5 uppercase tracking-wider">
                    Project URL
                  </label>
                  <input
                    id="sbUrl"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="w-full h-10 px-3 bg-[#FAFAFA] border border-[#E5E5E5] text-xs font-mono text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="sbKey" className="block text-xs font-medium text-[#171717] mb-1.5 uppercase tracking-wider">
                    Anon / Public Key
                  </label>
                  <input
                    id="sbKey"
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-10 px-3 bg-[#FAFAFA] border border-[#E5E5E5] text-xs font-mono text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                  />
                  <span className="text-[11px] text-[#737373] mt-1 block">
                    Found in Supabase Dashboard → Settings → API. Never enter your service-role key.
                  </span>
                </div>

                {testResult && (
                  <div
                    className={`p-3 text-xs leading-relaxed border ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-4 py-2 bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
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
                    className="px-4 py-2 bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-xs font-medium text-[#171717] transition-colors cursor-pointer"
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#171717]">
                    PostgreSQL Migration Script
                  </h3>
                  <p className="text-xs text-[#737373]">
                    Run this in Supabase SQL Editor to create tables, indexes, RLS, and realtime publications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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

              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 text-xs font-mono text-[#171717] overflow-x-auto max-h-[300px]">
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
            <div className="space-y-4 text-xs text-[#171717] leading-relaxed">
              <div className="border-b border-[#E5E5E5] pb-3">
                <h4 className="font-semibold text-sm mb-1">1. Storage Bucket</h4>
                <p className="text-[#737373]">
                  In your Supabase Dashboard, create a bucket named <code className="bg-[#F5F5F5] px-1 py-0.5">kith_attachments</code> with public read enabled and a 50MB file size limit.
                </p>
              </div>
              <div className="border-b border-[#E5E5E5] pb-3">
                <h4 className="font-semibold text-sm mb-1">2. Vercel Free-Tier Hosting</h4>
                <p className="text-[#737373]">
                  Deploy with 1-click on Vercel by importing your repository. Add your <code className="bg-[#F5F5F5] px-1 py-0.5">VITE_SUPABASE_URL</code> and <code className="bg-[#F5F5F5] px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> environment variables in Vercel project settings.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">3. Zero-Cost Maintenance</h4>
                <p className="text-[#737373]">
                  For a group of 3–4 friends, Supabase Free Tier covers all storage and real-time quotas (up to 2,000,000 messages/mo and 500MB database).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAFAFA] border-t border-[#E5E5E5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#E5E5E5] text-xs font-medium text-[#171717] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
