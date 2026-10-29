import React, { useState, useEffect } from 'react';
import { X, Check, Copy, RefreshCw, Database, Trash2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  verifySupabaseConnection,
  isSupabaseConfigured,
  setExplicitLocalMode,
  refreshBackendStatus,
  getCurrentBackendInfo,
  subscribeToBackendInfo,
  ConnectionVerificationResult
} from '../lib/supabaseClient';
import { BackendInfo } from '../types';
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
  const [diagnosticResult, setDiagnosticResult] = useState<ConnectionVerificationResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'sql' | 'guide'>('credentials');
  const [backendInfo, setBackendInfo] = useState<BackendInfo>(getCurrentBackendInfo());
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const info = getCurrentBackendInfo();
      setBackendInfo(info);
      const conf = getSupabaseConfig();
      setUrl(conf.url);
      setAnonKey(conf.anonKey);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeToBackendInfo((info) => setBackendInfo(info));
    return () => unsub();
  }, []);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setDiagnosticResult(null);

    const result = await verifySupabaseConnection(url, anonKey);
    setDiagnosticResult(result);
    setIsTesting(false);

    if (result.success) {
      saveSupabaseConfig(url, anonKey);
      await refreshBackendStatus();
      onConfigUpdated();
    }
  };

  const handleResetToLocal = () => {
    setExplicitLocalMode(true);
    setUrl('');
    setAnonKey('');
    setDiagnosticResult({
      success: true,
      status: 'local_only',
      message: 'Switched to local single-device testing mode.'
    });
    refreshBackendStatus();
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

  const handleExecuteWipe = () => {
    ChatEngine.clearAllData();
    clearSupabaseConfig();
    refreshBackendStatus();
    onConfigUpdated();
    setConfirmingWipe(false);
    onClose();
  };

  if (!isOpen) return null;

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
            <div>
              <h2 id="supabaseModalTitle" className="text-base font-bold text-[#24212B]">
                Supabase Backend Configuration
              </h2>
              <p className="text-[11px] text-[#827D8B]">
                Shared PostgreSQL database & Realtime messaging
              </p>
            </div>
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
            Connection & Diagnostics
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
            Vercel Deployment Guide
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm bg-white">
          {activeTab === 'credentials' && (
            <div className="space-y-5">
              {/* Current Status Card */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#827D8B]">Active Backend State:</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                      backendInfo.status === 'connected'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : backendInfo.status === 'missing_schema_or_permissions'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : backendInfo.status === 'local_only'
                        ? 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        backendInfo.status === 'connected'
                          ? 'bg-emerald-500'
                          : backendInfo.status === 'missing_schema_or_permissions'
                          ? 'bg-amber-500'
                          : backendInfo.status === 'local_only'
                          ? 'bg-neutral-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    {backendInfo.status === 'connected'
                      ? 'Connected to Live Supabase'
                      : backendInfo.status === 'missing_schema_or_permissions'
                      ? 'Missing Schema or RLS Permissions'
                      : backendInfo.status === 'local_only'
                      ? 'Local-Only Demo Mode (Single-device)'
                      : backendInfo.status === 'connecting'
                      ? 'Connecting...'
                      : 'Not Configured'}
                  </span>
                </div>
                {backendInfo.message && (
                  <p className="text-xs text-[#827D8B] leading-relaxed">
                    {backendInfo.message}
                  </p>
                )}
                {backendInfo.source === 'env' && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    ✓ Sourced automatically from Vercel environment variables (Shared across all users)
                  </p>
                )}
              </div>

              {/* Form */}
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
                  <p className="text-[11px] text-[#827D8B] mt-1">
                    Found in Supabase Dashboard → Settings → API → Project URL.
                  </p>
                </div>

                <div>
                  <label htmlFor="sbAnonKey" className="block text-xs font-semibold text-[#24212B] mb-1.5 uppercase tracking-wider">
                    Anon / Public Key
                  </label>
                  <input
                    id="sbAnonKey"
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-10 px-3.5 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl text-xs font-mono text-[#24212B] focus:outline-none focus:border-[#8B7CF6] focus:bg-white focus:ring-1 focus:ring-[#8B7CF6]/30 transition-all"
                  />
                  <p className="text-[11px] text-[#827D8B] mt-1">
                    Public anon key only. Never provide your private <code className="font-mono text-rose-600">service_role</code> key.
                  </p>
                </div>

                {/* Diagnostic Feedback */}
                {diagnosticResult && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-1.5 text-xs ${
                      diagnosticResult.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : diagnosticResult.status === 'missing_schema_or_permissions'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {diagnosticResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Connection Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>Verification Issue</span>
                        </>
                      )}
                    </div>
                    <p className="leading-relaxed">{diagnosticResult.message}</p>
                    {diagnosticResult.missingTables && diagnosticResult.missingTables.length > 0 && (
                      <div className="pt-1 text-[11px]">
                        <span className="font-semibold">Missing Tables: </span>
                        {diagnosticResult.missingTables.join(', ')}
                        <p className="mt-1 font-medium text-amber-900">
                          Switch to the "SQL Migration" tab above, click "Copy Schema SQL", and run it in your Supabase SQL Editor.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isTesting || !url || !anonKey}
                    className="px-4 py-2 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-40"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Running Diagnostics...</span>
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
                    className="px-3.5 py-2 bg-[#FAF8F5] border border-[#EAE5E0] hover:bg-[#F4F0EA] text-[#24212B] text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Use Local Demo (Single-device only)
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#FAF8F5] border border-[#EAE5E0] rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#24212B]">Idempotent Database Schema</h4>
                  <p className="text-[11px] text-[#827D8B]">
                    Creates all 6 tables, Realtime publications, indexes, and storage bucket.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Schema SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-xs text-[#827D8B] space-y-2">
                <p className="font-semibold text-[#24212B]">How to run in Supabase:</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#24212B]/80 leading-relaxed">
                  <li>Log into your Supabase Dashboard (<code className="font-mono bg-[#FAF8F5] px-1 py-0.5 rounded border border-[#EAE5E0]">supabase.com</code>).</li>
                  <li>Click on your project and open the <strong>SQL Editor</strong> from the left sidebar.</li>
                  <li>Click <strong>New query</strong>, paste the copied SQL script, and click <strong>Run</strong>.</li>
                  <li>Confirm that all tables (<code className="font-mono">members</code>, <code className="font-mono">conversations</code>, <code className="font-mono">messages</code>, <code className="font-mono">attachments</code>, <code className="font-mono">message_reactions</code>) appear with green checkmarks.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-[#24212B]/90 leading-relaxed">
              <div className="p-3 bg-[#F0ECFF] border border-[#DDD6FE] rounded-xl text-[#5B48D9]">
                <h4 className="font-semibold mb-1">Permanent Cross-User Production Setup on Vercel</h4>
                <p className="text-[11px] leading-relaxed">
                  To ensure all friends automatically connect to the same cloud backend without typing URLs or keys into their browsers, configure these environment variables in your Vercel Project Settings.
                </p>
              </div>

              <div className="space-y-3">
                <p className="font-semibold text-xs text-[#24212B]">Required Vercel Environment Variables:</p>
                <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EAE5E0] font-mono text-[11px] space-y-2">
                  <div>
                    <span className="text-[#8B7CF6] font-semibold">VITE_SUPABASE_URL</span>=https://your-project-id.supabase.co
                  </div>
                  <div>
                    <span className="text-[#8B7CF6] font-semibold">VITE_SUPABASE_ANON_KEY</span>=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                  </div>
                </div>

                <p className="font-semibold text-xs text-[#24212B]">Critical Vercel Deployment Step:</p>
                <p className="text-xs text-[#827D8B]">
                  Because Vite inlines <code className="font-mono text-[#24212B]">VITE_*</code> environment variables at build time, you <strong>MUST trigger a new deployment</strong> in Vercel after adding these variables:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-[#827D8B]">
                  <li>In Vercel, go to <strong>Project Settings → Environment Variables</strong>.</li>
                  <li>Add <code className="font-mono text-[#24212B]">VITE_SUPABASE_URL</code> and <code className="font-mono text-[#24212B]">VITE_SUPABASE_ANON_KEY</code> for Production and Preview.</li>
                  <li>Go to the <strong>Deployments</strong> tab, click the three dots on the latest deployment, and select <strong>Redeploy</strong> (ensure "Use existing Build Cache" is unchecked).</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#EAE5E0] bg-[#FAF8F5] flex items-center justify-between">
          {confirmingWipe ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-medium">Wipe all data and disconnect?</span>
              <button
                type="button"
                onClick={handleExecuteWipe}
                className="text-xs text-white bg-rose-600 hover:bg-rose-700 font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                Yes, Wipe All
              </button>
              <button
                type="button"
                onClick={() => setConfirmingWipe(false)}
                className="text-xs text-[#6B6575] hover:text-[#24212B] px-2 py-1 bg-white border border-[#EAE5E0] rounded-lg cursor-pointer transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingWipe(true)}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset and clear all data</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#EAE5E0] hover:bg-[#F4F0EA] text-[#24212B] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
