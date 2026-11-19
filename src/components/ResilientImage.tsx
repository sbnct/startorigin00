import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = '',
  onClick,
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed || !src) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center bg-[#F5F5F7] text-[#737373] select-none ${containerClassName}`}
      >
        <ImageIcon className="w-6 h-6 mb-2 opacity-50" strokeWidth={1.5} />
        <span className="text-xs font-medium px-3 text-center truncate max-w-full">
          {alt || 'Photo unavailable'}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#F5F5F7] ${containerClassName}`}
    >
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className} transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
