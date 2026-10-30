import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BackendInfo, BackendStatus } from '../types';

const STORAGE_KEY = 'kith_supabase_config';
const LOCAL_MODE_FLAG = 'kith_use_local_mode';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'env' | 'storage' | 'none';
}
export interface ConnectionVerificationResult {
  success: boolean;
  status: BackendStatus;
  message: string;
  missingTables?: string[];
  realtimeSupported?: boolean;
  latencyMs?: number;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey: string | null = null;
let currentBackendInfo: BackendInfo = {
  status: 'connecting',
  source: 'none'
};

const backendInfoListeners = new Set<(info: BackendInfo) => void>();

function notifyBackendInfo(info: BackendInfo) {
  currentBackendInfo = { ...info, lastChecked: new Date().toISOString() };
  backendInfoListeners.forEach(cb => cb(currentBackendInfo));
}

function cleanUrl(url: string): string {
  let clean = url.trim().replace(/^["']|["']$/g, '');
  if (clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

function cleanKey(key: string): string {
  return key.trim().replace(/^["']|["']$/g, '');
}

/**
 * Returns current Supabase credentials.
 * Environment variables (build-time in Vercel/Vite) take top priority so all users
 * on a deployment share the exact same database without needing manual configuration.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta.env as Record<string, string | undefined> | undefined) : undefined;
  const procEnv = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined> | undefined) : undefined;

  const rawUrl =
    metaEnv?.VITE_SUPABASE_URL ||
    metaEnv?.NEXT_PUBLIC_SUPABASE_URL ||
    metaEnv?.SUPABASE_URL ||
    procEnv?.VITE_SUPABASE_URL ||
    procEnv?.NEXT_PUBLIC_SUPABASE_URL ||
    procEnv?.SUPABASE_URL ||
    '';

  const rawKey =
    metaEnv?.VITE_SUPABASE_ANON_KEY ||
    metaEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    metaEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    metaEnv?.SUPABASE_ANON_KEY ||
    metaEnv?.SUPABASE_PUBLISHABLE_KEY ||
    procEnv?.VITE_SUPABASE_ANON_KEY ||
    procEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    procEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    procEnv?.SUPABASE_ANON_KEY ||
    procEnv?.SUPABASE_PUBLISHABLE_KEY ||
    '';

  const envUrl = cleanUrl(rawUrl);
  const envKey = cleanKey(rawKey);

  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      source: 'env'
    };
  }

  // Fallback to runtime localStorage if no build-time environment variables exist
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return {
            url: cleanUrl(parsed.url),
            anonKey: cleanKey(parsed.anonKey),
            source: 'storage'
          };
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    url: '',
    anonKey: '',
    source: 'none'
  };
}

/**
 * Checks if Supabase credentials are syntactically present.
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(
    config.url &&
    config.url.startsWith('https://') &&
    config.anonKey &&
    config.anonKey.length > 20
  );
}

/**
 * Local mode is permanently disabled in favor of real end-to-end cloud persistence.
 */
export function isLocalModeExplicitlyEnabled(): boolean {
  return false;
}

export function setExplicitLocalMode(_enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_MODE_FLAG);
  }
}

export function isEnvConfigured(): boolean {
  const config = getSupabaseConfig();
  return config.source === 'env';
}

/**
 * Retrieves the initialized Supabase client singleton, or null if unconfigured.
 */
export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!isSupabaseConfigured()) {
    return null;
  }

  const configKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },

      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    });
    cachedConfigKey = configKey;
    return cachedClient;
  } catch (err) {
    console.error('[Kith] Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Saves Supabase credentials to localStorage and clears cache.
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
  localStorage.removeItem(LOCAL_MODE_FLAG);
  cachedClient = null;
  cachedConfigKey = null;
}

/**
 * Clears stored Supabase credentials.
 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  cachedClient = null;
  cachedConfigKey = null;
}

/**
 * Exhaustive diagnostic verification of the Supabase project:
 * 1. Validates URL & Anon key format.
 * 2. Connects and tests permissions across all 6 application tables:
 *    - conversations
 *    - members
 *    - conversation_members
 *    - messages
 *    - message_reactions
 *    - attachments
 * 3. Tests real-time channel subscription handshake.
 */
export async function verifySupabaseConnection(
  url?: string,
  anonKey?: string
): Promise<ConnectionVerificationResult> {
  const activeUrl = (url || getSupabaseConfig().url).trim();
  const activeKey = (anonKey || getSupabaseConfig().anonKey).trim();

  if (!activeUrl || !activeKey) {
    return {
      success: false,
      status: 'not_configured',
      message: 'Supabase URL and Public/Anon Key are required. Configure them in Vercel settings or below.'
    };
  }

  if (!activeUrl.startsWith('https://')) {
    return {
      success: false,
      status: 'connection_failed',
      message: 'Project URL must begin with https:// (e.g. https://xyz.supabase.co)'
    };
  }

  if (activeKey.length < 20) {
    return {
      success: false,
      status: 'connection_failed',
      message: 'Invalid public/anon key format. The anon key is a long JWT string.'
    };
  }

  const startTime = Date.now();
  let testClient: SupabaseClient;
  try {
    testClient = createClient(activeUrl, activeKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
        autoRefreshToken: false,
        storageKey: 'kith_verify_temp'
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: 'connection_failed',
      message: `Failed to initialize client: ${msg}`
    };
  }

  // Check required tables
  const requiredTables = [
    'conversations',
    'members',
    'conversation_members',
    'messages',
    'message_reactions',
    'attachments'
  ];

  const missingTables: string[] = [];
  let permissionError: string | null = null;
  let networkError: string | null = null;

  for (const table of requiredTables) {
    try {
      const selectCol = table === 'conversation_members' ? 'conversation_id' : 'id';
      const { error } = await testClient.from(table).select(selectCol).limit(1);
      if (error) {
        // Table missing error codes (42P01 in Postgres or message match)
        if (
          error.code === '42P01' ||
          error.code === 'PGRST116' ||
          error.message?.toLowerCase().includes('does not exist') ||
          error.message?.toLowerCase().includes('relation')
        ) {
          missingTables.push(table);
        } else if (
          error.code === '42501' ||
          error.message?.toLowerCase().includes('permission denied') ||
          error.message?.toLowerCase().includes('violates row-level security')
        ) {
          permissionError = `Permission denied on table "${table}". Please run the schema migration to enable anon access.`;
        } else if (error.message?.toLowerCase().includes('failed to fetch') || error.code === 'PGRST301') {
          networkError = `Network error or invalid credentials: ${error.message}`;
          break;
        } else {
          // Other potential missing column / table error
          missingTables.push(table);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      networkError = `Connection failed: ${msg}`;
      break;
    }
  }

  if (networkError) {
    return {
      success: false,
      status: 'connection_failed',
      message: networkError
    };
  }

  if (missingTables.length > 0) {
    return {
      success: false,
      status: 'missing_schema_or_permissions',
      missingTables,
      message: `Connected to Supabase, but missing required tables: ${missingTables.join(', ')}. Please run the SQL migration in your Supabase SQL Editor.`
    };
  }

  if (permissionError) {
    return {
      success: false,
      status: 'missing_schema_or_permissions',
      message: permissionError
    };
  }

  // Test Realtime capability
  let realtimeWorking = false;
  try {
    realtimeWorking = await new Promise<boolean>((resolve) => {
      const testChannel = testClient.channel(`kith_verify_${Date.now()}`);
      const timeout = setTimeout(() => {
        testClient.removeChannel(testChannel);
        resolve(false);
      }, 3500);

      testChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          testClient.removeChannel(testChannel);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          testClient.removeChannel(testChannel);
          resolve(false);
        }
      });
    });
  } catch {
    realtimeWorking = false;
  }

  const latency = Date.now() - startTime;

  return {
    success: true,
    status: 'connected',
    message: realtimeWorking
      ? `Successfully connected to shared Supabase database with Realtime active (${latency}ms latency).`
      : `Connected to Supabase database (${latency}ms latency). Realtime channel initializing.`,
    realtimeSupported: realtimeWorking,
    latencyMs: latency
  };
}

/**
 * Backward compatibility wrapper for existing callers.
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  const res = await verifySupabaseConnection(url, anonKey);
  return {
    success: res.success,
    message: res.message
  };
}

/**
 * Asynchronously checks and updates current backend status.
 */
export async function refreshBackendStatus(): Promise<BackendInfo> {
  const config = getSupabaseConfig();

  if (isLocalModeExplicitlyEnabled() && config.source !== 'env') {
    const info: BackendInfo = {
      status: 'local_only',
      source: 'none',
      message: 'Using local-only storage (Single-device mesh). Messages will not reach other devices.'
    };
    notifyBackendInfo(info);
    return info;
  }

  if (!isSupabaseConfigured()) {
    const info: BackendInfo = {
      status: 'not_configured',
      source: config.source,
      message: 'Supabase cloud backend is not configured. Messages are stored locally on this device only.'
    };
    notifyBackendInfo(info);
    return info;
  }

  notifyBackendInfo({
    status: 'connecting',
    source: config.source,
    url: config.url,
    message: 'Connecting to Supabase...'
  });

  const res = await verifySupabaseConnection(config.url, config.anonKey);
  const info: BackendInfo = {
    status: res.status,
    source: config.source,
    url: config.url,
    message: res.message,
    missingTables: res.missingTables,
    realtimeActive: res.realtimeSupported
  };
  notifyBackendInfo(info);
  return info;
}

export function getCurrentBackendInfo(): BackendInfo {
  return currentBackendInfo;
}

export function subscribeToBackendInfo(callback: (info: BackendInfo) => void): () => void {
  backendInfoListeners.add(callback);
  callback(currentBackendInfo);
  return () => {
    backendInfoListeners.delete(callback);
  };
}

// ==============================================================================
// AUTHENTICATION API METHODS
// ==============================================================================

/**
 * Checks if a given username is already taken in the public.members table.
 */
export async function checkUsernameAvailability(username: string): Promise<{ available: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { available: true };
  }

  const clean = username.trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id')
      .ilike('username', clean)
      .maybeSingle();

    if (error) {
      // If table or column doesn't exist yet, don't block
      return { available: true };
    }

    return { available: !data };
  } catch (err: unknown) {
    return { available: true };
  }
}

import { generateInternalEmail, isInternalEmail } from '../utils/authValidation';

/**
 * Resolves a username to the registered email address or internal alias for sign-in.
 */
export async function findEmailForUsername(username: string): Promise<string> {
  const supabase = getSupabase();
  const clean = username.trim().toLowerCase();
  const defaultInternalEmail = generateInternalEmail(clean);

  if (!supabase) return defaultInternalEmail;

  // Try RPC first (security definer)
  try {
    const { data, error } = await supabase.rpc('get_email_for_username', { p_username: clean });
    if (!error && data && typeof data === 'string' && data.trim()) {
      const email = data.trim();
      if (!isInternalEmail(email)) {
        return email;
      }
    }
  } catch {
    // fallback
  }

  // Check direct query on members table
  try {
    const { data, error } = await supabase
      .from('members')
      .select('email')
      .ilike('username', clean)
      .maybeSingle();

    if (!error && data?.email && !isInternalEmail(data.email)) {
      return String(data.email).trim();
    }
  } catch {
    // fallback to internal alias
  }

  return defaultInternalEmail;
}

/**
 * Registers a new permanent account with username, password, and optional display name/email.
 * No email is required; pure username+password creates a collision-free internal identity.
 */
export async function signUpWithAccount(params: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
}): Promise<{ success: boolean; user?: any; session?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected. Configure credentials first.' };
  }

  const cleanUsername = params.username.trim().toLowerCase();
  const cleanDisplayName = params.displayName?.trim() || cleanUsername;
  const cleanEmail = params.email?.trim().toLowerCase() || '';

  // Verify username uniqueness
  const availability = await checkUsernameAvailability(cleanUsername);
  if (!availability.available) {
    return { success: false, error: `Username "@${cleanUsername}" is already taken. Please choose another.` };
  }

  // If no email was given, generate internal alias
  const authEmail = cleanEmail || generateInternalEmail(cleanUsername);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: params.password,
      options: {
        data: {
          username: cleanUsername,
          display_name: cleanDisplayName,
          has_linked_email: Boolean(cleanEmail),
          avatar_color: '#8B7CF6'
        }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Registration failed. No user returned.' };
    }

    // Provision the public.members profile row right away
    try {
      await supabase.from('members').upsert({
        id: data.user.id,
        display_name: cleanDisplayName,
        username: cleanUsername,
        email: cleanEmail || null,
        avatar_color: '#8B7CF6',
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch {
      // ignore, auth trigger handles it on DB
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Signs in using either a username OR an email address, plus password.
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<{ success: boolean; user?: any; session?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  const clean = identifier.trim();
  let emailToUse = clean;

  // If identifier does not have '@', it's a username; resolve it
  if (!clean.includes('@')) {
    emailToUse = await findEmailForUsername(clean);
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password
    });

    if (error) {
      if (error.message?.toLowerCase().includes('email not confirmed')) {
        return {
          success: false,
          error: 'Email confirmation is enabled in your Supabase project. To enable instant username sign-in: Go to Supabase Dashboard -> Authentication -> Providers -> Email -> Turn OFF "Confirm email".'
        };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Links a real recovery email address to the current user account.
 */
export async function linkEmailToAccount(newEmail: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  const clean = newEmail.trim().toLowerCase();
  try {
    const { data, error } = await supabase.auth.updateUser({
      email: clean,
      data: { has_linked_email: true }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Also update public.members record
    if (data.user) {
      try {
        await supabase
          .from('members')
          .update({ email: clean })
          .eq('id', data.user.id);
      } catch {
        // ignore
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Initiates Google OAuth sign-in flow.
 */
export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Links a Google account to the currently authenticated account.
 */
export async function linkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  try {
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Unlinks a provider identity from the user account.
 */
export async function unlinkProviderAccount(identity: any): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  try {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Signs out the current user and clears session tokens.
 */
export async function signOutUser(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
  // Clear any stored member session
  localStorage.removeItem('kith_current_member');
}

/**
 * Sends a password reset email.
 */
export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/#reset-password`
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Updates password for currently logged-in user.
 */
export async function updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase cloud backend is not connected.' };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the active user from Supabase Auth.
 */
export async function getCurrentAuthUser(): Promise<any | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
  }
}

/**
 * Gets linked identities for the current user (e.g. google, email).
 */
export async function getAuthIdentities(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.identities || [];
  } catch {
    return [];
  }
}
