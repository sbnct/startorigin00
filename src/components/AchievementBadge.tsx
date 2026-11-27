import React from 'react';
import {
  Aperture,
  Bookmark,
  Camera,
  Check,
  Crown,
  Folder,
  Heart,
  Layers,
  Lock,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';
import { AchievementIconKey, AchievementStatus } from '../lib/achievements';
import { ModalPortal } from './ModalPortal';

function renderIconSymbol(icon: AchievementIconKey, className: string) {
  switch (icon) {
    case 'camera':
      return <Camera className={className} strokeWidth={2.1} />;
    case 'aperture':
      return <Aperture className={className} strokeWidth={2.1} />;
    case 'crown':
      return <Crown className={className} strokeWidth={2.1} />;
    case 'folder':
      return <Folder className={className} strokeWidth={2.1} />;
    case 'layers':
      return <Layers className={className} strokeWidth={2.1} />;
    case 'users':
      return <Users className={className} strokeWidth={2.1} />;
    case 'star':
      return <Star className={className} strokeWidth={2.1} />;
    case 'heart':
      return <Heart className={className} strokeWidth={2.1} />;
    case 'bookmark':
      return <Bookmark className={className} strokeWidth={2.1} />;
    case 'shield':
      return <ShieldCheck className={className} strokeWidth={2.1} />;
  }
}

interface AchievementBadgeIconProps {
  status: AchievementStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const AchievementBadgeIcon: React.FC<AchievementBadgeIconProps> = ({
  status,
  size = 'sm',
}) => {
  const { definition, unlocked } = status;

  const boxSize =
    size === 'xs'
      ? 'w-5 h-5 rounded-md'
      : size === 'sm'
      ? 'w-6 h-6 rounded-lg'
      : size === 'md'
      ? 'w-11 h-11 rounded-2xl'
      : 'w-14 h-14 rounded-2xl';

  const iconSize =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
      ? 'w-3.5 h-3.5'
      : size === 'md'
      ? 'w-5 h-5'
      : 'w-7 h-7';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 transition-transform ${boxSize}`}
      style={
        unlocked
          ? {
              backgroundColor: definition.bgHex,
              color: definition.accentHex,
              boxShadow: `inset 0 0 0 1px ${definition.accentHex}33`,
            }
          : {
              backgroundColor: '#F5F5F7',
              color: '#A3A3A3',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
            }
      }
    >
      {renderIconSymbol(definition.icon, iconSize)}
    </span>
  );
};

interface AchievementDetailModalProps {
  status: AchievementStatus | null;
  onClose: () => void;
}

export const AchievementDetailModal: React.FC<AchievementDetailModalProps> = ({
  status,
  onClose,
}) => {
  if (!status) return null;

  const { definition, unlocked, progressPct, progressText } = status;

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${definition.name} achievement details`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-5 shadow-2xl animate-modal-pop"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <AchievementBadgeIcon status={status} size="lg" />
            <h2 className="text-base font-semibold text-[#0A0A0A] truncate min-w-0">
              {definition.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close achievement details"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] text-[#0A0A0A] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
          {definition.flavor}
        </p>

        <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-black/[0.06] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#0A0A0A]">How to unlock</span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                unlocked ? 'text-[#059669]' : 'text-[#737373]'
              }`}
            >
              {unlocked ? (
                <>
                  <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                  <span>Unlocked</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Locked</span>
                </>
              )}
            </span>
          </div>

          <p className="text-xs text-[#0A0A0A] font-medium">{definition.howToGet}</p>

          <div className="space-y-1.5 pt-1">
            <div className="h-2 w-full rounded-full bg-black/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: unlocked ? definition.accentHex : '#0A0A0A',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#737373] tabular-nums">
              <span>{progressText}</span>
              <span>{progressPct}%</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-black/85 text-white text-xs font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
    </ModalPortal>
  );
};
