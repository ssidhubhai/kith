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

