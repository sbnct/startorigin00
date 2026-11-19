import React from 'react';

interface MentionTextProps {
  text: string;
  onMentionClick: (username: string) => void;
  className?: string;
}

export const MentionText: React.FC<MentionTextProps> = ({
  text,
  onMentionClick,
  className = '',
}) => {
  const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (/^@[a-zA-Z0-9_.-]+$/.test(part)) {
          const username = part.slice(1);
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMentionClick(username);
              }}
              className="font-semibold text-[#0A0A0A] underline decoration-black/25 underline-offset-2 hover:decoration-[#0A0A0A] transition-colors inline"
            >
              {part}
            </button>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
};
