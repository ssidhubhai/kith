import React, { useState } from 'react';
import { X, CornerUpRight, Search, Users, MessageSquare } from 'lucide-react';
import { Conversation, Message } from '../types';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  conversations: Conversation[];
  onForward: (targetConvId: string) => Promise<void>;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  message,
  conversations,
  onForward
}) => {
  const [search, setSearch] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);

  if (!isOpen || !message) return null;

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedConvId) return;
    setIsForwarding(true);
    try {
      await onForward(selectedConvId);
      onClose();
    } catch (err) {
      console.error('Failed to forward message:', err);
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-sm bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EAE5E0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <CornerUpRight className="w-4 h-4 text-[#8B7CF6]" />
            <h3 id="forward-modal-title" className="text-sm font-bold text-[#24212B]">
              Forward Message
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close forward modal"
            className="w-7 h-7 flex items-center justify-center text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3.5 mx-4 mt-3 bg-white border border-[#EAE5E0] rounded-2xl">
          <div className="text-[10px] font-semibold text-[#8B7CF6] uppercase tracking-wider">
            {message.sender_name || 'Friend'}
          </div>
          <p className="text-xs text-[#24212B] line-clamp-2 mt-0.5">
            {message.content || (message.attachments?.length ? '📎 Attachment' : '')}
          </p>
        </div>

        {/* Search destination */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#827D8B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-[#EAE5E0] rounded-xl text-[#24212B] focus:outline-none focus:border-[#8B7CF6]"
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 min-h-[140px]">
          {filtered.map((conv) => {
            const isSelected = selectedConvId === conv.id;
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedConvId(conv.id)}
                className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F0ECFF] border border-[#8B7CF6] text-[#24212B]'
                    : 'bg-white border border-[#EAE5E0] hover:bg-[#FAF8F5]'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  conv.type === 'group' ? 'bg-[#EDE9FE] text-[#8B7CF6]' : 'bg-[#E0F2FE] text-[#0284C7]'
                }`}>
                  {conv.type === 'group' ? <Users className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#24212B] truncate">{conv.title}</div>
                  <div className="text-[10px] text-[#827D8B] truncate">
                    {conv.type === 'group' ? 'Circle Group' : 'Direct Message'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EAE5E0] bg-white flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-[#827D8B] hover:text-[#24212B] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedConvId || isForwarding}
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-semibold bg-[#8B7CF6] text-white hover:bg-[#7868E8] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <CornerUpRight className="w-3.5 h-3.5" />
            <span>{isForwarding ? 'Forwarding...' : 'Forward'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
