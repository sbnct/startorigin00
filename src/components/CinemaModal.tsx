import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { CinemaPhoto } from '../types';

interface CinemaModalProps {
  photo: CinemaPhoto | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export const CinemaModal: React.FC<CinemaModalProps> = ({ photo, onClose }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
  }, [photo?.id, resetView]);

  const zoomBy = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((prev + delta).toFixed(2))));
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') zoomBy(0.5);
      if (e.key === '-') zoomBy(-0.5);
      if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onClose, zoomBy, resetView]);

  if (!photo) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    zoomBy(delta);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.origX + dx,
      y: dragStartRef.current.origY + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      resetView();
    } else {
      setScale(2);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-2xl flex flex-col justify-between select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Cinema view for ${photo.title}`}
    >
      {/* Top Cinema Bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
        <div className="min-w-0 pr-4">
          <h2 className="text-sm sm:text-base font-medium text-white truncate">
            {photo.title}
          </h2>
          {photo.subtitle && (
            <p className="text-xs text-white/60 truncate mt-0.5">{photo.subtitle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close cinema view"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Main Zoomable Stage */}
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden px-4 ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
        }`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={photo.image_url}
          alt={photo.title}
          referrerPolicy="no-referrer"
          draggable={false}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transition: isDragging
              ? 'none'
              : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="max-h-[76vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Bottom Zoom Controls */}
      <div className="flex items-center justify-center px-4 py-5 z-10 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 text-white">
          <button
            type="button"
            onClick={() => zoomBy(-0.5)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-35 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="px-3 text-xs font-medium tabular-nums min-w-[54px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={() => zoomBy(0.5)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-35 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/15 mx-1" />

          <button
            type="button"
            onClick={resetView}
            disabled={scale === 1 && offset.x === 0 && offset.y === 0}
            aria-label="Reset zoom"
            className="min-h-[40px] px-3 flex items-center gap-1.5 rounded-xl text-xs font-medium hover:bg-white/15 disabled:opacity-35 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
