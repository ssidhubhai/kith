/**
 * Conversation helper utilities:
 * - Deterministic direct conversation pairing
 * - Search filtering
 */

/**
 * Creates a deterministic key for a 1-on-1 direct conversation between two members.
 * Sorts member IDs so order does not matter: direct:memberA_memberB
 */
export function getDirectConversationKey(memberIdA: string, memberIdB: string): string {
  const sorted = [memberIdA, memberIdB].sort();
  return `direct:${sorted[0]}_${sorted[1]}`;
}

/**
 * Filters messages by search query matching content or original filename of attachments.
 */
export function filterMessagesByQuery<
  T extends {
    content?: string;
    attachments?: Array<{ original_filename?: string }>;
  }
>(messages: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return messages;

  return messages.filter((msg) => {
    if (msg.content && msg.content.toLowerCase().includes(q)) {
      return true;
    }
    if (msg.attachments && msg.attachments.length > 0) {
      return msg.attachments.some(
        (att) => att.original_filename && att.original_filename.toLowerCase().includes(q)
      );
    }
    return false;
  });
}
