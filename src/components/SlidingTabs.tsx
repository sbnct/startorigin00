import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface SlidingTabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  ariaLabel?: string;
  title?: string;
}

interface SlidingTabsProps<T extends string = string> {
  items: readonly SlidingTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
  fullWidth?: boolean;
}

export function SlidingTabs<T extends string = string>({
  items,
  value,
  onChange,
  className = '',
  buttonClassName = '',
  fullWidth = false,
}: SlidingTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const activeBtn = buttonRefs.current[value];
    if (!container || !activeBtn) return;

    const left = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;
    setIndicator({ left, width, ready: width > 0 });
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateIndicator);
      return () => window.removeEventListener('resize', updateIndicator);
    }
    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(container);
    Object.values(buttonRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [updateIndicator, items]);

  return (
    <div
      ref={containerRef}
      className={`relative p-1 bg-[#F5F5F7] rounded-xl ${
        fullWidth ? 'grid' : 'inline-flex items-center overflow-x-auto max-w-full'
      } ${className}`}
      style={
        fullWidth
          ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {indicator.ready && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-0 rounded-lg bg-white shadow-xs pointer-events-none transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: `${indicator.width}px`,
            transform: `translate3d(${indicator.left}px, 0, 0)`,
          }}
        />
      )}

      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[item.id] = el;
            }}
            type="button"
            onClick={() => onChange(item.id)}
            aria-label={item.ariaLabel}
            title={item.title}
            className={`relative z-10 min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 whitespace-nowrap flex items-center justify-center gap-1.5 ${
              active ? 'text-[#0A0A0A]' : 'text-[#737373] hover:text-[#0A0A0A]'
            } ${buttonClassName}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
