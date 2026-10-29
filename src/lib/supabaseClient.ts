import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'kith_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfig: SupabaseConfig | null = null;

/**
 * Returns current Supabase credentials from localStorage or Vite environment variables.
 */
export function getSupabaseConfig(): SupabaseConfig {
  // Check localStorage first
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Fallback to Vite environment variables
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  return {
    url: envUrl,
    anonKey: envKey
  };
}

/**
 * Checks if valid Supabase configuration is present.
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(
    config.url &&
    config.url.startsWith('https://') &&
    config.url.includes('.supabase.co') &&
    config.anonKey &&
    config.anonKey.length > 20
  );
}

/**
 * Retrieves the initialized Supabase client singleton, or null if not configured.
 */
export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (
    cachedClient &&
    cachedConfig &&
    cachedConfig.url === config.url &&
    cachedConfig.anonKey === config.anonKey
  ) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    });
    cachedConfig = { ...config };
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Saves Supabase credentials to localStorage and clears client cache.
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
  cachedClient = null;
  cachedConfig = null;
}

/**
 * Clears stored Supabase credentials.
 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  cachedClient = null;
  cachedConfig = null;
}

/**
 * Tests connection to a Supabase project by attempting a light query against members or server ping.
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      return { success: false, message: 'URL must start with https:// and end with .supabase.co' };
    }
    if (!anonKey || anonKey.length < 20) {
      return { success: false, message: 'Invalid anon key format' };
    }

    const testClient = createClient(url, anonKey, {
      auth: { persistSession: false }
    });

    // Query members or conversations
    const { error } = await testClient.from('conversations').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "public.conversations" does not exist')) {
        return {
          success: false,
          message: 'Connected to Supabase, but tables are missing. Please run the SQL migration in the SQL Editor.'
        };
      }
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Successfully connected to Supabase PostgreSQL database!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Connection failed: ${msg}` };
  }
}
