import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { CinemaPhoto } from '../types';
import { ModalPortal } from './ModalPortal';

interface CinemaModalProps {
  items: CinemaPhoto[];
  initialIndex: number;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export const CinemaModal: React.FC<CinemaModalProps> = ({
  items,
  initialIndex,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const panStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(
    null
  );
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    setActiveIndex(
      Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)))
    );
  }, [items, initialIndex]);

  const photo = items[activeIndex] || null;
  const hasMultiple = items.length > 1;
  const hasPrev = hasMultiple && activeIndex > 0;
  const hasNext = hasMultiple && activeIndex < items.length - 1;

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setSwipeX(0);
  }, []);

  useEffect(() => {
    resetView();
  }, [photo?.id, resetView]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    setActiveIndex((idx) => Math.max(0, idx - 1));
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    setActiveIndex((idx) => Math.min(items.length - 1, idx + 1));
  }, [hasNext, items.length]);

  const zoomBy = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, Number((prev + delta).toFixed(2)))
      );
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
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === '+' || e.key === '=') zoomBy(0.5);
      if (e.key === '-') zoomBy(-0.5);
      if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onClose, goPrev, goNext, zoomBy, resetView]);

  if (!photo) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    zoomBy(delta);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);

    if (scale > 1) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        origX: offset.x,
        origY: offset.y,
      };
      swipeStartRef.current = null;
    } else if (hasMultiple) {
      swipeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
      panStartRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    if (scale > 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setOffset({
        x: panStartRef.current.origX + dx,
        y: panStartRef.current.origY + dy,
      });
      return;
    }

    if (scale <= 1 && hasMultiple && swipeStartRef.current) {
      const dx = e.clientX - swipeStartRef.current.x;
      // Gentle resistance at edges
      if ((dx > 0 && !hasPrev) || (dx < 0 && !hasNext)) {
        setSwipeX(dx * 0.28);
      } else {
        setSwipeX(dx);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    panStartRef.current = null;

    if (scale <= 1 && hasMultiple && swipeStartRef.current) {
      const elapsed = Date.now() - swipeStartRef.current.time;
      const velocity = Math.abs(swipeX) / Math.max(1, elapsed);
      const passedThreshold = Math.abs(swipeX) > 56 || (velocity > 0.35 && Math.abs(swipeX) > 20);

      if (passedThreshold) {
        if (swipeX < 0 && hasNext) {
          goNext();
        } else if (swipeX > 0 && hasPrev) {
          goPrev();
        }
      }
      setSwipeX(0);
    }

    swipeStartRef.current = null;
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      resetView();
    } else {
      setScale(2);
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-2xl flex flex-col justify-between select-none animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Cinema view for ${photo.title}`}
    >
      {/* Top Cinema Bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-medium text-white truncate">
              {photo.title}
            </h2>
            {hasMultiple && (
              <span className="text-xs text-white/60 tabular-nums shrink-0">
                {activeIndex + 1} / {items.length}
              </span>
            )}
          </div>
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

      {/* Main Zoomable & Swipeable Stage */}
      <div
        className={`relative flex-1 flex items-center justify-center overflow-hidden px-4 touch-none ${
          scale > 1
            ? isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : hasMultiple
            ? 'cursor-grab'
            : 'cursor-zoom-in'
        }`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Previous photo"
            className="hidden sm:flex absolute left-5 z-20 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/12 hover:bg-white/25 text-white backdrop-blur-md transition-colors"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.85} />
          </button>
        )}

        <img
          src={photo.image_url}
          alt={photo.title}
          referrerPolicy="no-referrer"
          draggable={false}
          style={{
            transform:
              scale > 1
                ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
                : `translate3d(${swipeX}px, 0, 0) scale(1)`,
            transition: isDragging
              ? 'none'
              : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="max-h-[76vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        />

        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Next photo"
            className="hidden sm:flex absolute right-5 z-20 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/12 hover:bg-white/25 text-white backdrop-blur-md transition-colors"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.85} />
          </button>
        )}
      </div>

      {/* Bottom Zoom & Collection Step Controls */}
      <div className="flex flex-col items-center gap-2.5 px-4 py-5 z-10 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 text-white">
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={!hasPrev}
                aria-label="Previous photo"
                className="sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!hasNext}
                aria-label="Next photo"
                className="sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="sm:hidden w-px h-5 bg-white/15 mx-1" />
            </>
          )}

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
    </ModalPortal>
  );
};
