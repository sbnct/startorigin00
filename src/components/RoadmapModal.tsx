import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const APP_VERSION = 'v1.02';

interface RoadmapRelease {
  version: string;
  date: string;
  latest?: boolean;
  items: string[];
}

const RELEASES: RoadmapRelease[] = [
  {
    version: 'v1.02',
    date: '25 Nov 2026',
    latest: true,
    items: [
      'Added new privacy setting for photos and collections',
      "Added following control in 'Edit Profile'",
      'Minor improvements',
    ],
  },
  {
    version: 'v1.01',
    date: '22 Nov 2026',
    items: [
      'Landing page improved',
      'Added new privacy option in Gallery',
      'Following restriction: control who follows you',
      'Achievements added',
    ],
  },
  {
    version: 'v1.0',
    date: '19 Nov 2026',
    items: ['App released!'],
  },
];

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoadmapModal: React.FC<RoadmapModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="StartOrigin Roadmap"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#0A0A0A]">
              Roadmap
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Release history from latest to oldest
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close roadmap"
            className="min-h-[38px] min-w-[38px] rounded-full hover:bg-[#F5F5F7] flex items-center justify-center text-[#0A0A0A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-0.5">
          {RELEASES.map((release) => (
            <section
              key={release.version}
              className="p-4 rounded-2xl border border-black/[0.08] bg-[#FAFAFA] space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0A0A0A] tabular-nums">
                    {release.version}
                  </span>
                  {release.latest && (
                    <span className="text-[11px] font-medium text-[#525252]">
                      Latest
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#737373] tabular-nums">
                  {release.date}
                </span>
              </div>

              <ul className="space-y-1.5 text-xs sm:text-sm text-[#404040]">
                {release.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0A0A0A] shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
