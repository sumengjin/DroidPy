import { Children, useRef, useState, type PointerEvent, type ReactNode, type KeyboardEvent } from 'react';

interface TabletSplitLayoutProps {
  split: boolean;
  orientation: 'horizontal' | 'vertical';
  children: ReactNode;
}

/**
 * A genuinely adjustable tablet workbench divider.
 * The editor/output balance is user-controlled instead of a fixed 56/44 ratio.
 */
export function TabletSplitLayout({ split, orientation, children }: TabletSplitLayoutProps) {
  const panes = Children.toArray(children).filter(Boolean);
  const containerRef = useRef<HTMLDivElement>(null);
  const [primaryPercent, setPrimaryPercent] = useState(58);
  const horizontal = orientation === 'horizontal';

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const raw = horizontal
      ? ((event.clientX - bounds.left) / bounds.width) * 100
      : ((event.clientY - bounds.top) / bounds.height) * 100;
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
    ? { gridTemplateColumns: `minmax(0, ${primaryPercent}fr) 10px minmax(0, ${100 - primaryPercent}fr)` }
    : { gridTemplateRows: `minmax(0, ${primaryPercent}fr) 10px minmax(0, ${100 - primaryPercent}fr)` };

  return (
    <div
      ref={containerRef}
      className={`flex-1 min-h-0 min-w-0 grid overflow-hidden ${horizontal ? 'grid-rows-1' : 'grid-cols-1'}`}
      style={gridStyle}
    >
      {panes[0]}
      <div
        role="separator"
        aria-label="調整編輯器與工作區面板大小"
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={Math.round(primaryPercent)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={handleKeyDown}
        className={`relative z-20 flex items-center justify-center touch-none outline-none backdrop-blur-[3px] focus-visible:bg-[var(--ide-accent-soft)] ${horizontal ? 'cursor-col-resize' : 'cursor-row-resize'}`}
      >
        <span
          aria-hidden="true"
          className={`rounded-full bg-[var(--ide-divider-glass)] shadow-[0_0_0_1px_var(--ide-divider-glow),0_0_10px_var(--ide-divider-glow)] ${horizontal ? 'w-[2px] h-12' : 'h-[2px] w-12'}`}
        />
      </div>
      {panes[1]}
    </div>
  );
}
