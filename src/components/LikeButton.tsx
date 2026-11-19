import React from 'react';
import { Heart } from 'lucide-react';

interface LikeButtonProps {
  liked: boolean;
  count: number;
  busy?: boolean;
  compact?: boolean;
  onToggle: () => void;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  liked,
  count,
  busy = false,
  compact = false,
  onToggle,
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? `Unlike photo (${count} likes)` : `Like photo (${count} likes)`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium tabular-nums transition-all shrink-0 active:scale-95 disabled:opacity-60 ${
        compact ? 'min-h-[34px] px-2.5 py-1' : 'min-h-[38px] px-3 py-1.5'
      } ${
        liked
          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
          : 'bg-[#F5F5F7] text-[#0A0A0A] border-black/[0.08] hover:bg-black/[0.08]'
      }`}
    >
      <Heart
        className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${liked ? 'fill-current' : ''}`}
        strokeWidth={1.85}
      />
      <span>{count}</span>
    </button>
  );
};
