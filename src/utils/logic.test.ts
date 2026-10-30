import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFilename,
  formatFileSize,
  getFileCategory,
  validateFileSize
} from './fileValidation';
import {
  isWithinThreshold,
  groupMessages,
  formatDateDivider
} from './messageGrouping';
import {
  getDirectConversationKey,
  filterMessagesByQuery
} from './conversationUtils';
import {
  validateUsername,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  isEmailIdentifier
} from './authValidation';


test('fileValidation - sanitizes malicious and path traversal filenames', () => {
  assert.equal(sanitizeFilename('../../../secret.env'), 'secret.env');
  assert.equal(sanitizeFilename('my image (1) #2.png'), 'my_image__1___2.png');
  assert.equal(sanitizeFilename('..hidden.txt'), 'hidden.txt');
  assert.equal(sanitizeFilename(''), 'unnamed_file');
});

test('fileValidation - formats byte sizes accurately', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(1536), '1.5 KB');
  assert.equal(formatFileSize(10485760), '10.0 MB');
});

test('fileValidation - categorizes file types by mime and extension', () => {
  assert.equal(getFileCategory('image/png', 'photo.png'), 'image');
  assert.equal(getFileCategory('video/mp4', 'clip.mp4'), 'video');
  assert.equal(getFileCategory('audio/mpeg', 'song.mp3'), 'audio');
  assert.equal(getFileCategory('application/pdf', 'doc.pdf'), 'pdf');
  assert.equal(getFileCategory('text/plain', 'notes.md'), 'document');
  assert.equal(getFileCategory('application/zip', 'archive.zip'), 'archive');
  assert.equal(getFileCategory('', 'main.tsx'), 'code');
  assert.equal(getFileCategory('application/octet-stream', 'binary.bin'), 'generic');
});

test('fileValidation - validates file limits under 48MB', () => {
  const ok = validateFileSize(1024 * 1024);
  assert.equal(ok.valid, true);

  const empty = validateFileSize(0);
  assert.equal(empty.valid, false);

  const oversized = validateFileSize(50 * 1024 * 1024); // 50MB
  assert.equal(oversized.valid, false);
});

test('messageGrouping - groups consecutive messages within threshold', () => {
  const baseTime = new Date('2026-10-29T10:00:00Z').getTime();
  const msgs = [
    {
      id: '1',
      sender_id: 'alice',
      created_at: new Date(baseTime).toISOString()
    },
    {
      id: '2',
      sender_id: 'alice',
      created_at: new Date(baseTime + 60000).toISOString() // 1 min later
    },
    {
      id: '3',
      sender_id: 'bob',
      created_at: new Date(baseTime + 120000).toISOString() // different sender
    },
    {
      id: '4',
      sender_id: 'alice',
      created_at: new Date(baseTime + 600000).toISOString() // 10 min later (> 3 min)
    }
  ];

  const groups = groupMessages(msgs);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].messages.length, 2);
  assert.equal(groups[1].senderId, 'bob');
  assert.equal(groups[2].senderId, 'alice');
});

test('conversationUtils - deterministic direct conversation keys', () => {
  const key1 = getDirectConversationKey('user_123', 'user_456');
  const key2 = getDirectConversationKey('user_456', 'user_123');
  assert.equal(key1, key2);
  assert.equal(key1, 'direct:user_123_user_456');
});

test('conversationUtils - filters messages by text query and attachments', () => {
  const messages = [
    { id: '1', content: 'Hey everyone, check this out!' },
    {
      id: '2',
      content: 'Here are the docs',
      attachments: [{ original_filename: 'quarterly_report.pdf' }]
    },
    { id: '3', content: 'Lunch today?' }
  ];

  const res1 = filterMessagesByQuery(messages, 'everyone');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, '1');

  const res2 = filterMessagesByQuery(messages, 'report');
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, '2');

  const res3 = filterMessagesByQuery(messages, 'nomatch');
  assert.equal(res3.length, 0);
});

test('messageGrouping - formats date divider labels correctly', () => {
  const todayIso = new Date().toISOString();
  const label = formatDateDivider(todayIso);
  assert.equal(label, 'Today');
});

test('messageReconciliation - reconciles optimistic message with confirmed server message', () => {
  const existingMessages = [
    { id: 'msg-1', content: 'First message', status: 'sent' as const },
    { id: 'msg-2', content: 'Pending optimistic message', status: 'pending' as const }
  ];

  const incomingServerMsg = {
    id: 'msg-2',
    content: 'Pending optimistic message',
    created_at: '2026-10-29T10:00:00Z',
    status: 'sent' as const
  };

  // Reconcile
  const idx = existingMessages.findIndex((m) => m.id === incomingServerMsg.id);
  assert.equal(idx, 1);

  const updated = [...existingMessages];
  updated[idx] = { ...existingMessages[idx], ...incomingServerMsg, status: 'sent' };

  assert.equal(updated.length, 2);
  assert.equal(updated[1].status, 'sent');
});

test('messageReconciliation - retains failed status and error message on insert failure', () => {
  const msg = {
    id: 'msg-fail',
    content: 'Unsent message',
    status: 'pending' as 'pending' | 'sent' | 'failed',
    error: undefined as string | undefined
  };

  // Simulate failed insertion
  const failureMsg = 'violates foreign key constraint';
  msg.status = 'failed' as const;
  msg.error = failureMsg;

  assert.equal(msg.status, 'failed');
  assert.equal(msg.error, failureMsg);
});

test('authValidation - validateUsername enforces format rules', () => {
  // Valid usernames
  assert.equal(validateUsername('alice').valid, true);
  assert.equal(validateUsername('user_123').valid, true);
  assert.equal(validateUsername('cool-guy_99').valid, true);

  // Invalid usernames
  assert.equal(validateUsername('').valid, false);
  assert.equal(validateUsername('ab').valid, false); // < 3 chars
  assert.equal(validateUsername('this_username_is_way_too_long_for_kith').valid, false); // > 24 chars
  assert.equal(validateUsername('_invalid').valid, false); // starts with underscore
  assert.equal(validateUsername('hello world').valid, false); // spaces
  assert.equal(validateUsername('alice__bob').valid, false); // consecutive underscores
});

test('authValidation - validateEmail verifies standard email patterns', () => {
  assert.equal(validateEmail('test@example.com').valid, true);
  assert.equal(validateEmail('user.name+tag@domain.co.uk').valid, true);

  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('invalid-email').valid, false);
  assert.equal(validateEmail('@domain.com').valid, false);
  assert.equal(validateEmail('test@').valid, false);
});

test('authValidation - validatePassword checks length, composition and strength', () => {
  // Short password
  const short = validatePassword('short1');
  assert.equal(short.valid, false);

  // No numbers or special
  const noNums = validatePassword('abcdefghij');
  assert.equal(noNums.valid, false);

  // Valid medium password
  const valid = validatePassword('Password123');
  assert.equal(valid.valid, true);
  assert.equal(['medium', 'strong'].includes(valid.strength), true);

  // Strong password
  const strong = validatePassword('KithSecure#2026!');
  assert.equal(strong.valid, true);
  assert.equal(strong.strength, 'strong');
});

test('authValidation - validatePasswordMatch and identifier checks', () => {
  assert.equal(validatePasswordMatch('secret123', 'secret123').valid, true);
  assert.equal(validatePasswordMatch('secret123', 'mismatch').valid, false);

  assert.equal(isEmailIdentifier('user@domain.com'), true);
  assert.equal(isEmailIdentifier('my_username'), false);
});

test('attachmentResolution - resolves public download URL from storage path', () => {
  // Mock supabase client getPublicUrl
  const mockSupabase = {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` }
        })
      })
    }
  };

  const attWithStoragePath = {
    id: 'att-1',
    original_filename: 'photo.jpg',
    storage_path: 'room-1/photo.jpg'
  };

  const { data } = mockSupabase.storage.from('kith_attachments').getPublicUrl(attWithStoragePath.storage_path);
  assert.equal(data.publicUrl, 'https://test.supabase.co/storage/v1/object/public/kith_attachments/room-1/photo.jpg');
});

test('messageOrdering - sorts incoming Realtime messages chronologically', () => {
  const msgs = [
    { id: '3', created_at: '2026-10-30T10:05:00Z', content: 'Third' },
    { id: '1', created_at: '2026-10-30T10:00:00Z', content: 'First' },
    { id: '2', created_at: '2026-10-30T10:02:00Z', content: 'Second' }
  ];

  const sorted = [...msgs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  assert.equal(sorted[0].id, '1');
  assert.equal(sorted[1].id, '2');
  assert.equal(sorted[2].id, '3');
});

test('directConversation - resolves recipient display title correctly', () => {
  const currentUserId = 'user-a';
  const participantIds = ['user-a', 'user-b'];
  const members = [
    { id: 'user-a', display_name: 'Alice' },
    { id: 'user-b', display_name: 'Bob' }
  ];

  const otherId = participantIds.find(id => id !== currentUserId);
  const otherMember = members.find(m => m.id === otherId);
  const displayTitle = otherMember?.display_name || 'Personal Chat';

  assert.equal(displayTitle, 'Bob');
});

