import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xs bg-[#FAF8F5] rounded-3xl border border-[#EAE5E0] shadow-2xl overflow-hidden p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel delete"
            className="w-7 h-7 flex items-center justify-center text-[#827D8B] hover:text-[#24212B] hover:bg-[#F4F0EA] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 id="confirm-delete-title" className="text-sm font-bold text-[#24212B]">
          Delete message?
        </h3>
        <p className="text-xs text-[#827D8B] mt-1 leading-relaxed">
          This message will be permanently removed for everyone in this circle.
        </p>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 text-xs font-medium text-[#827D8B] bg-white border border-[#EAE5E0] hover:bg-[#FAF8F5] rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
