import React, { useState } from 'react';
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
  '👋', '✌️', '💪', '🎯', '🥑', '🌮', '🍷', '🌿'
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

  if (!isOpen) return null;

  const filteredEmojis = query.trim()
    ? COMMON_EMOJIS.filter(() => true) // All common emojis match or could be tagged
    : COMMON_EMOJIS;

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
      // Filter curated gifs by title
      const filtered = CURATED_GIFS.filter(g =>
        g.title.toLowerCase().includes(trimmed.toLowerCase())
      );
      setGifResults(filtered.length > 0 ? filtered : CURATED_GIFS);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Emoji and GIF picker"
      className="absolute bottom-16 right-4 sm:right-6 z-40 w-80 bg-white border border-[#E5E5E5] shadow-lg flex flex-col"
    >
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-[#E5E5E5] px-3 py-2 bg-[#FAFAFA]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('emoji')}
            className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'emoji'
                ? 'bg-white border border-[#E5E5E5] text-[#171717]'
                : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emoji</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('gif')}
            className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'gif'
                ? 'bg-white border border-[#E5E5E5] text-[#171717]'
                : 'text-[#737373] hover:text-[#171717]'
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
          className="p-1 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input for GIFs */}
      {tab === 'gif' && (
        <div className="p-2 border-b border-[#E5E5E5]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#737373]" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchGif(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-[#FAFAFA] border border-[#E5E5E5] text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717]"
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-3 max-h-60 overflow-y-auto">
        {tab === 'emoji' ? (
          <div className="grid grid-cols-8 gap-1.5">
            {filteredEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji);
                  onClose();
                }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {loading ? (
              <div className="col-span-2 py-8 text-center text-xs text-[#737373]">
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
                  className="group relative overflow-hidden bg-[#FAFAFA] border border-[#E5E5E5] hover:border-[#171717] transition-colors cursor-pointer"
                >
                  <img
                    src={gif.url}
                    alt={gif.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[10px] text-white truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {gif.title}
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-2 py-8 text-center text-xs text-[#737373]">
                No GIFs found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
