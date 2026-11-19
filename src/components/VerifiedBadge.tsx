import React from 'react';
import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  username?: string | null;
  isVerified?: boolean | null;
  size?: 'sm' | 'md';
}

export function isUserVerified(
  username?: string | null,
  isVerified?: boolean | null
): boolean {
  return Boolean(isVerified) || (username || '').trim().toLowerCase() === 'subnocte';
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  username,
  isVerified,
  size = 'sm',
}) => {
  if (!isUserVerified(username, isVerified)) {
    return null;
  }

  const dim = size === 'md' ? 'w-5 h-5' : 'w-[18px] h-[18px]';

  return (
    <span
      title="Verified"
      aria-label="Verified"
      className="inline-flex items-center shrink-0"
    >
      <BadgeCheck className={`${dim} fill-[#007AFF] text-white`} strokeWidth={2.2} />
    </span>
  );
};
