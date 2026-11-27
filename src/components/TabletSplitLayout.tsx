import { Children, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

interface TabletSplitLayoutProps {
  split: boolean;
  orientation: 'horizontal' | 'vertical';
  children: ReactNode;
}

interface ContainerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A genuinely adjustable tablet workbench divider.
 * The visible divider is a transparent 1 mm line spanning the full viewport;
 * its wider invisible hit target keeps touch and mouse dragging practical.
 */
export function TabletSplitLayout({ split, orientation, children }: TabletSplitLayoutProps) {
  const panes = Children.toArray(children).filter(Boolean);
  const containerRef = useRef<HTMLDivElement>(null);
  const [primaryPercent, setPrimaryPercent] = useState(58);
  const [bounds, setBounds] = useState<ContainerBounds>({ left: 0, top: 0, width: 0, height: 0 });
  const horizontal = orientation === 'horizontal';
  const dividerThicknessPx = 96 / 25.4;

  useLayoutEffect(() => {
    if (!split) return;
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [split, orientation]);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const usableLength = (horizontal ? rect.width : rect.height) - dividerThicknessPx;
    if (usableLength <= 0) return;
    const pointerOffset = horizontal ? event.clientX - rect.left : event.clientY - rect.top;
    const raw = ((pointerOffset - dividerThicknessPx / 2) / usableLength) * 100;
    setPrimaryPercent(Math.min(75, Math.max(25, raw)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const negative = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const positive = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== negative && event.key !== positive) return;
    event.preventDefault();
    setPrimaryPercent((value) => Math.min(75, Math.max(25, value + (event.key === positive ? 5 : -5))));
  };

  if (!split || panes.length < 2) {
    return <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">{panes}</div>;
  }

  const gridStyle = horizontal
    ? { gridTemplateColumns: `minmax(0, ${primaryPercent}fr) 1mm minmax(0, ${100 - primaryPercent}fr)` }
    : { gridTemplateRows: `minmax(0, ${primaryPercent}fr) 1mm minmax(0, ${100 - primaryPercent}fr)` };

  const dividerCenter = horizontal
    ? bounds.left + Math.max(0, bounds.width - dividerThicknessPx) * primaryPercent / 100 + dividerThicknessPx / 2
    : bounds.top + Math.max(0, bounds.height - dividerThicknessPx) * primaryPercent / 100 + dividerThicknessPx / 2;

  const fullViewportDivider = createPortal(
    <div
      role="separator"
      aria-label="調整編輯器與工作區面板大小"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-valuemin={25}
      aria-valuemax={75}
      aria-valuenow={Math.round(primaryPercent)}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={handleKeyDown}
      className={`fixed z-[80] flex items-center justify-center touch-none outline-none select-none ${horizontal ? 'cursor-col-resize' : 'cursor-row-resize'}`}
      style={horizontal
        ? { top: 0, bottom: 0, left: dividerCenter - 14, width: 28, touchAction: 'none' }
        : { left: 0, right: 0, top: dividerCenter - 14, height: 28, touchAction: 'none' }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none block shrink-0"
        style={horizontal ? { width: '1mm', height: '100%' } : { width: '100%', height: '1mm' }}
      />
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={containerRef}
        className={`tablet-split-layout relative flex-1 min-h-0 min-w-0 grid overflow-hidden ${horizontal ? 'grid-rows-1' : 'grid-cols-1'}`}
        style={gridStyle}
      >
        {panes[0]}
        <div aria-hidden="true" className="min-w-0 min-h-0 pointer-events-none" />
        {panes[1]}
      </div>
      {fullViewportDivider}
    </>
  );
}
