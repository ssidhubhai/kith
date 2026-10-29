/**
 * Utilities for grouping chat messages, calculating timestamps,
 * and separating conversations by day.
 */

export interface MessageWithSender {
  id: string;
  sender_id: string;
  created_at: string;
}

export interface MessageGroup<T extends MessageWithSender> {
  senderId: string;
  dateKey: string; // e.g. "2026-10-29"
  messages: T[];
}

/**
 * Checks if two timestamps are within a threshold (default 3 minutes = 180000ms).
 */
export function isWithinThreshold(
  timeA: string | number | Date,
  timeB: string | number | Date,
  thresholdMs: number = 3 * 60 * 1000
): boolean {
  const tA = new Date(timeA).getTime();
  const tB = new Date(timeB).getTime();
  return Math.abs(tB - tA) <= thresholdMs;
}

/**
 * Formats a timestamp into a clean, minimal time string (e.g. "10:42 AM").
 */
export function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Returns a human-friendly date header string (e.g. "Today", "Yesterday", "Monday, Oct 27").
 */
export function formatDateDivider(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
    });
  } catch {
    return '';
  }
}

/**
 * Groups consecutive messages by the same sender that occurred within a 3-minute window
 * on the same calendar date.
 */
export function groupMessages<T extends MessageWithSender>(
  messages: T[],
  thresholdMs: number = 3 * 60 * 1000
): MessageGroup<T>[] {
  if (!messages || messages.length === 0) return [];

  const groups: MessageGroup<T>[] = [];
  let currentGroup: MessageGroup<T> | null = null;

  for (const message of messages) {
    const msgDate = new Date(message.created_at);
    const dateKey = !isNaN(msgDate.getTime())
      ? `${msgDate.getFullYear()}-${String(msgDate.getMonth() + 1).padStart(2, '0')}-${String(msgDate.getDate()).padStart(2, '0')}`
      : 'unknown';

    if (
      currentGroup &&
      currentGroup.senderId === message.sender_id &&
      currentGroup.dateKey === dateKey &&
      currentGroup.messages.length > 0 &&
      isWithinThreshold(
        currentGroup.messages[currentGroup.messages.length - 1].created_at,
        message.created_at,
        thresholdMs
      )
    ) {
      currentGroup.messages.push(message);
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        senderId: message.sender_id,
        dateKey,
        messages: [message]
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
