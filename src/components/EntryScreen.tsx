import React, { useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { Member } from '../types';
import { DEFAULT_FRIENDS } from '../lib/chatEngine';

interface EntryScreenProps {
  onEnter: (name: string, memberId?: string) => void;
  currentMember?: Member | null;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({ onEnter, currentMember }) => {
  const [name, setName] = useState(currentMember?.display_name || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a display name to continue.');
      return;
    }
    setError(null);
    onEnter(trimmed);
  };

  const handlePickFriend = (friend: typeof DEFAULT_FRIENDS[0]) => {
    setName(friend.display_name);
    setError(null);
    onEnter(friend.display_name, friend.id);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#171717] selection:text-white">
      <div className="w-full max-w-[420px] bg-white border border-[#E5E5E5] p-8 md:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Brand / Logo */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#171717]">
              Kith
            </h1>
            <span className="text-xs text-[#737373] tracking-wide uppercase font-medium">
              Private Group
            </span>
          </div>
          <p className="text-sm text-[#737373] leading-relaxed">
            Ultra-fast, minimal messaging for a small circle of friends. No passwords, no noise.
          </p>
        </div>

        {/* Name Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayNameInput"
              className="block text-xs font-medium text-[#171717] mb-2 uppercase tracking-wider"
            >
              Your Display Name
            </label>
            <input
              id="displayNameInput"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Alex, Maya, Elena"
              maxLength={32}
              className="w-full h-11 px-3.5 bg-[#FAFAFA] border border-[#E5E5E5] text-sm text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-[#171717] hover:bg-[#262626] active:bg-[#000000] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Enter Messenger</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Friend Presets */}
        <div className="mt-8 pt-6 border-t border-[#E5E5E5]">
          <div className="flex items-center gap-1.5 text-xs text-[#737373] mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>Or switch to a friend profile:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_FRIENDS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handlePickFriend(f)}
                className="px-3 py-2 text-left bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-xs font-medium text-[#171717] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>{f.display_name}</span>
                <span className="text-[10px] text-[#737373]">Join →</span>
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-[#A3A3A3] leading-normal">
            Stored locally in your browser. Fully private to your group.
          </p>
        </div>
      </div>
    </div>
  );
};
