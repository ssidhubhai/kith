/**
 * Core type definitions for Kith Messenger.
 */

export interface Member {
  id: string;
  display_name: string;
  username?: string;
  email?: string;
  auth_provider?: string;
  nickname?: string;
  avatar_url?: string;
  avatar_color: string;
  status_text?: string;
  hide_last_seen?: boolean;
  last_seen_at: string;
  created_at: string;
  is_online?: boolean;
}

export interface ConnectedAccount {
  provider: 'google' | 'email' | string;
  id: string;
  email?: string;
  created_at?: string;
}

export type AuthView = 'signin' | 'signup' | 'forgot_password' | 'set_username';


export type BackendStatus =
  | 'not_configured'
  | 'connecting'
  | 'connected'
  | 'missing_schema_or_permissions'
  | 'connection_failed'
  | 'reconnecting'
  | 'local_only';

export interface BackendInfo {
  status: BackendStatus;
  message?: string;
  source: 'env' | 'storage' | 'none';
  url?: string;
  missingTables?: string[];
  realtimeActive?: boolean;
  lastChecked?: string;
}

export type ConnectionState = BackendStatus;

export type ConversationType = 'group' | 'direct';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  created_at: string;
  updated_at: string;
  participant_ids?: string[];
  participants?: Member[];
  last_message?: Message;
  unread_count?: number;
}

export type MessageType = 'text' | 'file' | 'system';

export interface Attachment {
  id: string;
  message_id?: string;
  conversation_id: string;
  uploader_id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  download_url?: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  member_id: string;
  emoji: string;
  created_at: string;
}

export interface MessageReplyInfo {
  id: string;
  sender_name: string;
  content: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar_color?: string;
  sender_avatar_url?: string;
  content: string;
  message_type: MessageType;
  reply_to_message_id?: string | null;
  reply_to?: MessageReplyInfo | null;
  is_forwarded?: boolean;
  forwarded_from?: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  attachments?: Attachment[];
  reactions?: Reaction[];
  status?: 'pending' | 'sent' | 'failed';
  error?: string;
}

export interface TypingIndicator {
  member_id: string;
  display_name: string;
  conversation_id: string;
  timestamp: number;
}
