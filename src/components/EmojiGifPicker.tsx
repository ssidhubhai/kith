import React, { useState, useEffect } from 'react';
import { Search, X, Smile, Film } from 'lucide-react';

interface EmojiGifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, title: string) => void;
}

const COMMON_EMOJIS = [
  '❤️', '👍', '🔥', '😂', '🎉', '💡', '✨', '🙌',
  '👏', '👀', '🤝', '💯', '🚀', '😍', '🙏', '⚡',
  '☕', '🍕', '🍻', '🎈', '😎', '🤔', '🥳', '😭',
  '👋', '✌️', '💪', '🎯', '🥑', '🌮', '🍷', '🌿',
  '☀️', '🌙', '⭐', '🎈', '🎨', '📚', '💡', '🍿'
];

const CURATED_GIFS = [
  {
    title: 'Celebrate',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif'
  },
  {
    title: 'Cheers',
    url: 'https://media.giphy.com/media/Zw3oBUuIg23Ls18pU2/giphy.gif'
  },
  {
    title: 'Thumbs Up',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif'
  },
  {
    title: 'Mind Blown',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif'
  },
  {
    title: 'Typing Fast',
    url: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif'
  },
  {
    title: 'Agree',
    url: 'https://media.giphy.com/media/7SOdwNYU7TxK0/giphy.gif'
  }
];

export const EmojiGifPicker: React.FC<EmojiGifPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectGif
}) => {
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [gifResults, setGifResults] = useState(CURATED_GIFS);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearchGif = async (searchQuery: string) => {
    setQuery(searchQuery);
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setGifResults(CURATED_GIFS);
      return;
    }

    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (apiKey) {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
            trimmed
          )}&limit=12&rating=g`
        );
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setGifResults(
            json.data.map((item: any) => ({
              title: item.title || 'GIF',
              url: item.images?.fixed_height?.url || item.images?.original?.url
            }))
          );
        }
      } catch (err) {
        console.warn('GIF search error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      const filtered = CURATED_GIFS.filter(g =>
        g.title.toLowerCase().includes(trimmed.toLowerCase())
      );
      setGifResults(filtered.length > 0 ? filtered : CURATED_GIFS);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="sm:hidden fixed inset-0 z-40 bg-[#24212B]/40 backdrop-blur-xs"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Emoji and GIF picker"
        className="fixed sm:absolute bottom-0 sm:bottom-16 left-0 sm:left-auto right-0 sm:right-6 z-50 sm:z-40 w-full sm:w-80 bg-white border border-[#EAE5E0] rounded-t-2xl sm:rounded-2xl shadow-[0_12px_40px_rgba(36,33,43,0.16)] flex flex-col overflow-hidden max-h-[75vh] sm:max-h-96 safe-area-bottom"
      >
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-[#EAE5E0] px-4 py-2.5 bg-[#FAF8F5]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('emoji')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                tab === 'emoji'
                  ? 'bg-[#F0ECFF] text-[#6D28D9] shadow-2xs border border-[#DDD6FE]'
                  : 'text-[#827D8B] hover:text-[#24212B]'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Emoji</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('gif')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                tab === 'gif'
                  ? 'bg-[#F0ECFF] text-[#6D28D9] shadow-2xs border border-[#DDD6FE]'
                  : 'text-[#827D8B] hover:text-[#24212B]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>GIFs</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            className="p-1.5 text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input for GIFs */}
        {tab === 'gif' && (
          <div className="p-3 border-b border-[#EAE5E0] bg-[#FAF8F5]/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#827D8B]" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchGif(e.target.value)}
                placeholder="Search GIFs..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-[#EAE5E0] rounded-lg text-[#24212B] placeholder-[#A39E98] focus:outline-none focus:border-[#8B7CF6]"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-3.5 overflow-y-auto max-h-60 sm:max-h-64">
          {tab === 'emoji' ? (
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-2">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelectEmoji(emoji);
                    onClose();
                  }}
                  className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center text-xl sm:text-lg hover:bg-[#F0ECFF] rounded-lg transition-transform active:scale-115 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {loading ? (
                <div className="col-span-2 py-8 text-center text-xs text-[#827D8B]">
                  Searching GIFs...
                </div>
              ) : gifResults.length > 0 ? (
                gifResults.map((gif, idx) => (
                  <button
                    key={`${gif.url}-${idx}`}
                    type="button"
                    onClick={() => {
                      onSelectGif(gif.url, gif.title);
                      onClose();
                    }}
                    className="group relative overflow-hidden bg-[#FAF8F5] border border-[#EAE5E0] hover:border-[#8B7CF6] rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    <img
                      src={gif.url}
                      alt={gif.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-24 sm:h-28 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[10px] text-white truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {gif.title}
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-2 py-8 text-center text-xs text-[#827D8B]">
                  No GIFs found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
