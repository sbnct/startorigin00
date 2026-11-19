import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'min-h-[38px] px-3 py-1.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap'
            : 'w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] flex items-center justify-center gap-2 transition-colors whitespace-nowrap'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'min-h-[38px] px-3 py-1.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap'
              : 'w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] flex items-center justify-center gap-2 transition-colors whitespace-nowrap'
          }
        >
          <Share className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white border border-black/[0.08] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#0A0A0A]">
                  Install StartOrigin
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-[#F5F5F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#525252] leading-relaxed">
                1. Tap the <strong className="text-[#0A0A0A]">Share</strong> icon in Safari.
                <br />
                2. Scroll down and tap{' '}
                <strong className="text-[#0A0A0A]">Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-[#0A0A0A] text-white text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
