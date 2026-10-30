import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-medium shadow-lg animate-in slide-in-from-bottom-2 duration-200">
      <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
      <span>Offline Mode — Viewing cached messages</span>
    </div>
  );
};
