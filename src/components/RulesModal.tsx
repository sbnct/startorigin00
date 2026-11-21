import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  requireAcknowledge?: boolean;
  onAcknowledge?: () => void;
}

const RULES = [
  'Respect other users. Harassment, hate speech, threats, and discrimination are prohibited.',
  'Do not upload pornographic, sexually explicit, or otherwise inappropriate content.',
  'Respect privacy. Do not publish personal information or private photographs of others without permission.',
  'Only upload photographs and content that you own or have permission to share.',
  'Do not spam, manipulate likes or followers, impersonate others, or abuse the platform.',
];

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  requireAcknowledge = false,
  onAcknowledge,
}) => {
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
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="StartOrigin — Rules"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">
            StartOrigin — Rules
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="min-h-[38px] min-w-[38px] -mt-1 -mr-1 rounded-full hover:bg-[#F5F5F7] flex items-center justify-center text-[#0A0A0A] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="space-y-3 text-xs sm:text-sm text-[#404040] leading-relaxed list-decimal pl-5">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>

        <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-black/[0.08] space-y-2 text-xs sm:text-sm text-[#0A0A0A] leading-relaxed">
          <p className="font-semibold">
            Ignorance of these rules does not exempt users from responsibility for violating them.
          </p>
          <p className="text-[#525252]">
            StartOrigin reserves the right to remove content and suspend or permanently ban accounts that violate these rules.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          {requireAcknowledge ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onAcknowledge?.()}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors"
              >
                I Agree &amp; Upload
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
