import React, { useState } from 'react';
import { Download, Share2, X, CheckCircle2, Sparkles, Copy, Check, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'icon';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If app is already installed in standalone mode, hide button
  if (isInstalled) {
    return null;
  }

  const handleDownloadClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const success = await install();
        if (success) {
          setShowModal(false);
        } else {
          setShowManualGuide(true);
        }
      } catch {
        setShowManualGuide(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Show explicit step-by-step manual install guide inside modal
      setShowManualGuide(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <>
      {/* Trigger Button */}
      {variant === 'full' ? (
        <button
          type="button"
          onClick={() => {
            setShowManualGuide(false);
            setShowModal(true);
          }}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#8B7CF6] hover:bg-[#7868E8] text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>Download App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowManualGuide(false);
            setShowModal(true);
          }}
          title="Download & Install Kith App"
          aria-label="Download & Install Kith App"
          className={`min-w-[30px] min-h-[30px] flex items-center justify-center p-1.5 bg-[#F0ECFF] hover:bg-[#E5DEFF] text-[#6D28D9] border border-[#DDD6FE] rounded-xl shadow-2xs transition cursor-pointer shrink-0 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-[#8B7CF6]" />
        </button>
      )}

      {/* Modal Download Banner Popup */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-[#FAF8F5] border border-[#EAE5E0] p-5 shadow-2xl space-y-4 relative animate-in zoom-in-95 duration-200">
            {/* Close Button in Corner */}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Close download popup"
              className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-[#827D8B] hover:text-[#24212B] hover:bg-[#EAE5E0] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header / Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0ECFF] border border-[#DDD6FE] flex items-center justify-center text-[#8B7CF6] shadow-xs shrink-0">
                <Sparkles className="w-5 h-5 fill-[#8B7CF6]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#24212B] tracking-tight">
                  Download KithChat App
                </h3>
                <p className="text-[11px] text-[#827D8B]">
                  Official Progressive Web Application
                </p>
              </div>
            </div>

            {/* Body Content */}
            {isIOS ? (
              <div className="space-y-2.5 text-xs text-[#24212B]">
                <p className="text-[#827D8B] leading-relaxed">
                  To install KithChat on your iPhone or iPad:
                </p>
                <div className="p-3 rounded-xl bg-white border border-[#EAE5E0] space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-[#8B7CF6] shrink-0" />
                    <span>1. Tap the <strong>Share</strong> button in Safari</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#8B7CF6] shrink-0" />
                    <span>2. Select <strong>Add to Home Screen</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>3. Open KithChat directly from home screen</span>
                  </div>
                </div>
              </div>
            ) : showManualGuide || !isInstallable ? (
              <div className="space-y-2.5 text-xs text-[#24212B]">
                <p className="text-[#827D8B] leading-relaxed">
                  Install KithChat directly from your browser menu:
                </p>
                <div className="p-3 rounded-xl bg-white border border-[#EAE5E0] space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-[#8B7CF6] shrink-0" />
                    <span>1. Open browser menu (<strong>⋮</strong> or <strong>⊕</strong> in address bar)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#8B7CF6] shrink-0" />
                    <span>2. Click <strong>Install KithChat</strong> or <strong>Add to Home screen</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>3. Enjoy full-screen native desktop or mobile app!</span>
                  </div>
                </div>

                {/* Copy App Link Action */}
                <div className="pt-1 flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F0ECFF]/60 border border-[#DDD6FE]">
                  <span className="text-[11px] text-[#6D28D9] font-medium truncate">
                    {window.location.href}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-2.5 py-1 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-[#827D8B] leading-relaxed">
                <p>
                  Get the full app experience with fast loading, offline messaging support, and instant access right from your home screen or desktop.
                </p>
                <ul className="space-y-1.5 text-[11px] text-[#24212B] font-medium pt-1">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CF6]" />
                    <span>No app store required</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CF6]" />
                    <span>Works on Android, iOS, Windows, Mac & Linux</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CF6]" />
                    <span>Instant push messaging & clean full-screen layout</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadClick}
                disabled={isInstalling}
                className="flex-1 py-2.5 px-4 bg-[#8B7CF6] hover:bg-[#7868E8] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isInstalling
                    ? 'Installing...'
                    : isIOS
                    ? 'Install Guidance'
                    : 'Download Now'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2.5 px-3 bg-white border border-[#EAE5E0] text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] text-xs font-medium rounded-xl transition cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


