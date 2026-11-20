import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsRight } from 'lucide-react';

interface SwipeCaptchaProps {
  verified: boolean;
  onChange: (verified: boolean) => void;
  attention?: boolean;
}

const KNOB_SIZE = 40;
const TRACK_PADDING = 4;

export const SwipeCaptcha: React.FC<SwipeCaptchaProps> = ({
  verified,
  onChange,
  attention = false,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number>(0);

  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [offsetPx, setOffsetPx] = useState(0);

  const maxDrag = Math.max(0, trackWidth - KNOB_SIZE - TRACK_PADDING * 2);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const updateWidth = () => {
      setTrackWidth(el.getBoundingClientRect().width);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!verified) {
      setDragging(false);
      setOffsetPx(0);
    } else {
      setOffsetPx(maxDrag);
    }
  }, [verified, maxDrag]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (verified || maxDrag <= 0) return;
    e.preventDefault();
    startXRef.current = e.clientX - offsetPx;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || verified || maxDrag <= 0) return;
    const raw = e.clientX - startXRef.current;
    const clamped = Math.max(0, Math.min(maxDrag, raw));
    setOffsetPx(clamped);

    if (clamped >= maxDrag * 0.92) {
      setDragging(false);
      setOffsetPx(maxDrag);
      onChange(true);
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || verified) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);

    if (maxDrag > 0 && offsetPx >= maxDrag * 0.88) {
      setOffsetPx(maxDrag);
      onChange(true);
    } else {
      setOffsetPx(0);
    }
  };

  const progress = maxDrag > 0 ? offsetPx / maxDrag : verified ? 1 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#0A0A0A]">Robot verification</span>
        {verified && (
          <span className="text-[11px] font-medium text-[#0A0A0A]">Verified</span>
        )}
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Swipe from left to right to verify you are not a robot"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (verified) return;
          if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(true);
          }
        }}
        className={`relative h-12 w-full rounded-2xl border overflow-hidden select-none touch-none transition-colors ${
          verified
            ? 'bg-[#0A0A0A] border-[#0A0A0A]'
            : attention
            ? 'bg-red-50/60 border-red-400'
            : 'bg-[#F5F5F7] border-black/[0.08]'
        }`}
      >
        {/* Filled trail */}
        {!verified && (
          <div
            style={{
              width:
                offsetPx > 0
                  ? `${offsetPx + KNOB_SIZE / 2 + TRACK_PADDING}px`
                  : '0px',
            }}
            className={`absolute inset-y-0 left-0 bg-black/[0.07] pointer-events-none ${
              dragging ? '' : 'transition-all duration-200'
            }`}
          />
        )}

        {/* Right target anchor slot */}
        {!verified && (
          <div
            aria-hidden="true"
            style={{
              right: `${TRACK_PADDING}px`,
              width: `${KNOB_SIZE}px`,
              height: `${KNOB_SIZE}px`,
            }}
            className="absolute top-1/2 -translate-y-1/2 rounded-xl border border-dashed border-black/20 bg-white/50 flex items-center justify-center pointer-events-none"
          >
            <span className="w-2 h-2 rounded-full bg-black/25" />
          </div>
        )}

        {/* Center instruction / Verified text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
          {verified ? (
            <span className="text-xs font-medium text-white tracking-tight">
              Not a robot
            </span>
          ) : (
            <span
              style={{ opacity: Math.max(0, 1 - progress * 1.8) }}
              className="text-xs font-medium text-[#737373] truncate transition-opacity"
            >
              Swipe to verify
            </span>
          )}
        </div>

        {/* Draggable knob */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          style={{
            width: `${KNOB_SIZE}px`,
            height: `${KNOB_SIZE}px`,
            left: `${TRACK_PADDING}px`,
            transform: `translate3d(${verified ? maxDrag : offsetPx}px, -50%, 0)`,
          }}
          className={`absolute top-1/2 rounded-xl flex items-center justify-center shadow-xs ${
            dragging ? '' : 'transition-transform duration-200 ease-out'
          } ${
            verified
              ? 'bg-white text-[#0A0A0A] cursor-default'
              : 'bg-[#0A0A0A] text-white cursor-grab active:cursor-grabbing'
          }`}
        >
          {verified ? (
            <Check className="w-4 h-4" strokeWidth={2.25} />
          ) : (
            <ChevronsRight className="w-4 h-4" strokeWidth={2} />
          )}
        </div>
      </div>
    </div>
  );
};
