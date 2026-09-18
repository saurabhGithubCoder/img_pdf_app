import React, { useEffect } from 'react';
import { Monitor, Smartphone, X as CloseIcon } from 'lucide-react';

export default function MobileNotSupportedModal({ onClose }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          aria-label="Close"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {/* Icon row: phone (crossed out) → desktop */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center relative">
            <Smartphone className="w-5 h-5 text-slate-400" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-0.5 bg-rose-500 rotate-45 rounded-full" />
            </div>
          </div>

          <span className="text-slate-300 text-lg font-light">→</span>

          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Title + body */}
        <div className="text-center space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            Open on a larger screen
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Edit PDF requires precise mouse input and a bigger canvas.
            Please switch to a <span className="font-semibold text-slate-700">PC or laptop</span> to use this tool.
          </p>
        </div>

        {/* Got it button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}