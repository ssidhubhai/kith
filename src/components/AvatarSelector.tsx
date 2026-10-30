import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Check, Trash2, Loader2 } from 'lucide-react';
import { ChatEngine } from '../lib/chatEngine';
import { getMemberAvatarPalette } from '../utils/avatarUtils';

export interface AvatarPreset {
  id: string;
  name: string;
  url: string;
}

// Crisp, bespoke SVG avatar presets in warm editorial tones
export const GALLERY_AVATARS: AvatarPreset[] = [
  {
    id: 'fox',
    name: 'Fox',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23FFF1EE"/><circle cx="50" cy="50" r="32" fill="%23F97316"/><polygon points="30,28 40,50 20,50" fill="%23EA580C"/><polygon points="70,28 60,50 80,50" fill="%23EA580C"/><ellipse cx="50" cy="62" rx="16" ry="12" fill="%23FFFFFF"/><ellipse cx="42" cy="48" rx="4" ry="4" fill="%2324212B"/><ellipse cx="58" cy="48" rx="4" ry="4" fill="%2324212B"/><ellipse cx="50" cy="58" rx="4" ry="3" fill="%2324212B"/></svg>`
  },
  {
    id: 'owl',
    name: 'Owl',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23F0ECFF"/><circle cx="50" cy="52" r="32" fill="%238B7CF6"/><ellipse cx="38" cy="46" rx="11" ry="11" fill="%23FFFFFF"/><ellipse cx="62" cy="46" rx="11" ry="11" fill="%23FFFFFF"/><circle cx="38" cy="46" r="5" fill="%2324212B"/><circle cx="62" cy="46" r="5" fill="%2324212B"/><polygon points="50,52 46,62 54,62" fill="%23F59E0B"/><polygon points="28,26 38,40 22,40" fill="%237C3AED"/><polygon points="72,26 62,40 78,40" fill="%237C3AED"/></svg>`
  },
  {
    id: 'botanical',
    name: 'Botanical',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23ECFDF5"/><circle cx="50" cy="50" r="32" fill="%2310B981"/><path d="M50 24 C50 24 35 40 38 65 C40 65 48 56 50 45 C52 56 60 65 62 65 C65 40 50 24 50 24 Z" fill="%23FFFFFF"/><line x1="50" y1="30" x2="50" y2="76" stroke="%23047857" stroke-width="3" stroke-linecap="round"/></svg>`
  },
  {
    id: 'espresso',
    name: 'Coffee',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23FEF3C7"/><rect x="26" y="38" width="48" height="34" rx="8" fill="%2392400E"/><path d="M74 44 C82 44 86 50 86 56 C86 62 82 66 74 66" fill="none" stroke="%2392400E" stroke-width="4" stroke-linecap="round"/><ellipse cx="50" cy="38" rx="24" ry="7" fill="%23F59E0B"/><ellipse cx="50" cy="38" rx="20" ry="5" fill="%2378350F"/><path d="M42 22 Q46 26 42 30" fill="none" stroke="%23D97706" stroke-width="2" stroke-linecap="round"/><path d="M50 20 Q54 24 50 28" fill="none" stroke="%23D97706" stroke-width="2" stroke-linecap="round"/><path d="M58 22 Q62 26 58 30" fill="none" stroke="%23D97706" stroke-width="2" stroke-linecap="round"/></svg>`
  },
  {
    id: 'maker',
    name: 'Artist',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23FAF5FF"/><circle cx="50" cy="50" r="32" fill="%23C084FC"/><ellipse cx="50" cy="50" rx="26" ry="20" fill="%23FAF8F5"/><circle cx="38" cy="44" r="4" fill="%23F43F5E"/><circle cx="50" cy="40" r="4" fill="%23F59E0B"/><circle cx="62" cy="44" r="4" fill="%230EA5E9"/><circle cx="44" cy="56" r="4" fill="%2310B981"/><circle cx="58" cy="56" r="5" fill="%23EAE5E0"/></svg>`
  },
  {
    id: 'blossom',
    name: 'Blossom',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23FFF1F2"/><circle cx="50" cy="50" r="32" fill="%23FB7185"/><circle cx="50" cy="36" r="12" fill="%23FFE4E6"/><circle cx="64" cy="46" r="12" fill="%23FFE4E6"/><circle cx="59" cy="62" r="12" fill="%23FFE4E6"/><circle cx="41" cy="62" r="12" fill="%23FFE4E6"/><circle cx="36" cy="46" r="12" fill="%23FFE4E6"/><circle cx="50" cy="50" r="8" fill="%23F43F5E"/></svg>`
  },
  {
    id: 'cat',
    name: 'Cat',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23F4F0EA"/><circle cx="50" cy="54" r="30" fill="%23475569"/><polygon points="28,32 38,50 20,50" fill="%23334155"/><polygon points="72,32 62,50 80,50" fill="%23334155"/><ellipse cx="40" cy="52" rx="4" ry="5" fill="%2334D399"/><ellipse cx="60" cy="52" rx="4" ry="5" fill="%2334D399"/><circle cx="40" cy="52" r="2" fill="%230F172A"/><circle cx="60" cy="52" r="2" fill="%230F172A"/><polygon points="50,60 46,65 54,65" fill="%23FDA4AF"/></svg>`
  },
  {
    id: 'orbit',
    name: 'Comet',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="30" fill="%23F0F9FF"/><circle cx="50" cy="50" r="32" fill="%230284C7"/><circle cx="50" cy="50" r="18" fill="%2338BDF8"/><ellipse cx="50" cy="50" rx="30" ry="8" fill="none" stroke="%23BAE6FD" stroke-width="3" transform="rotate(-30 50 50)"/><circle cx="68" cy="38" r="4" fill="%23FDE047"/></svg>`
  }
];

interface AvatarSelectorProps {
  currentAvatarUrl?: string;
  displayName: string;
  avatarColor: string;
  onAvatarChange: (url: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  currentAvatarUrl,
  displayName,
  avatarColor,
  onAvatarChange
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pal = getMemberAvatarPalette(avatarColor);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, WebP, GIF)');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const url = await ChatEngine.uploadAvatar(file);
      onAvatarChange(url);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    onAvatarChange('');
  };

  return (
    <div className="space-y-3.5">
      {/* Current Preview Card */}
      <div className="flex items-center gap-3.5 p-3.5 bg-white rounded-2xl border border-[#EAE5E0] shadow-2xs">
        <div className="relative shrink-0">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={displayName || 'Avatar preview'}
              className="w-16 h-16 rounded-2xl object-cover border-2 shadow-xs transition-all"
              style={{ borderColor: avatarColor }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl text-xl font-bold flex items-center justify-center uppercase border-2 shadow-xs transition-colors"
              style={{
                backgroundColor: pal.bg,
                color: pal.text,
                borderColor: avatarColor
              }}
            >
              {displayName ? displayName.charAt(0) : '?'}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#24212B]">
            {currentAvatarUrl ? 'Custom Photo / Preset Active' : 'Letter Initial Avatar'}
          </div>
          <p className="text-[11px] text-[#827D8B] mt-0.5 leading-snug">
            {currentAvatarUrl
              ? 'Visible to everyone in The Collective and Direct Chats.'
              : 'Pick a photo from your computer or choose a curated avatar.'}
          </p>
          {currentAvatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="mt-1.5 text-[11px] font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Use letter avatar instead</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Upload vs Curated Gallery */}
      <div className="flex rounded-xl bg-[#F4F0EA] p-1 gap-1 border border-[#EAE5E0]">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-white text-[#24212B] shadow-2xs'
              : 'text-[#827D8B] hover:text-[#24212B]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload from Computer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gallery')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'gallery'
              ? 'bg-white text-[#24212B] shadow-2xs'
              : 'text-[#827D8B] hover:text-[#24212B]'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Choose from Gallery</span>
        </button>
      </div>

      {/* Tab 1: Upload from Computer/Device */}
      {activeTab === 'upload' && (
        <div className="p-4 bg-white rounded-2xl border border-dashed border-[#DDD6FE] hover:border-[#8B7CF6] transition-colors text-center space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="avatar-computer-upload-input"
          />

          <div className="w-10 h-10 rounded-xl bg-[#F0ECFF] text-[#8B7CF6] flex items-center justify-center mx-auto shadow-2xs">
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          </div>

          <div>
            <label
              htmlFor="avatar-computer-upload-input"
              className="inline-block px-4 py-2 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
            >
              {isUploading ? 'Uploading Image...' : 'Browse Computer / Gallery'}
            </label>
            <p className="text-[10px] text-[#827D8B] mt-1.5">
              Supports JPG, PNG, WebP, GIF up to 50MB
            </p>
          </div>

          {uploadError && (
            <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
          )}
        </div>
      )}

      {/* Tab 2: Curated Gallery Presets */}
      {activeTab === 'gallery' && (
        <div className="p-3 bg-white rounded-2xl border border-[#EAE5E0] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#827D8B] px-1">
            <span>Curated Friend Avatars</span>
            <span className="text-[10px] text-[#8B7CF6] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> One-tap select
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
            {GALLERY_AVATARS.map((preset) => {
              const isSelected = currentAvatarUrl === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onAvatarChange(preset.url)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-[#8B7CF6] bg-[#F0ECFF] ring-2 ring-[#8B7CF6]/40 scale-105'
                      : 'border-[#EAE5E0] hover:border-[#8B7CF6]/40 hover:bg-[#FAF8F5]'
                  }`}
                  title={`Select ${preset.name}`}
                >
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-10 h-10 rounded-xl object-cover shadow-2xs group-hover:scale-105 transition-transform"
                  />
                  <span className="text-[10px] font-medium text-[#24212B] truncate">
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
