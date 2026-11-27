import React from 'react';
import { Undo2, Redo2, ChevronLeft, ChevronRight } from 'lucide-react';

interface AndroidSymbolBarProps {
  tabSize: number;
  onInsert: (text: string, cursorOffset?: number) => void;
  onMoveCursor: (delta: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface SymbolAction {
  label: string;
  insert: string;
  offset?: number;
  ariaLabel: string;
}

interface SwipeSelection {
  pointerId: number;
  selectedIndex: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  moved: boolean;
}

export const AndroidSymbolBar: React.FC<AndroidSymbolBarProps> = ({
  tabSize,
  onInsert,
  onMoveCursor,
  onUndo,
  onRedo,
}) => {
  const symbols: SymbolAction[] = [
    { label: 'Tab', insert: ' '.repeat(tabSize), ariaLabel: '插入縮排 Tab' },
    { label: '( )', insert: '()', offset: -1, ariaLabel: '插入圓括號' },
    { label: '[ ]', insert: '[]', offset: -1, ariaLabel: '插入方括號' },
    { label: '{ }', insert: '{}', offset: -1, ariaLabel: '插入大括號' },
    { label: ':', insert: ':', ariaLabel: '插入冒號' },
    { label: '=', insert: ' = ', ariaLabel: '插入等號' },
    { label: '" "', insert: '""', offset: -1, ariaLabel: '插入雙引號' },
    { label: "' '", insert: "''", offset: -1, ariaLabel: '插入單引號' },
    { label: '#', insert: '# ', ariaLabel: '插入註解符號' },
    { label: '_', insert: '_', ariaLabel: '插入底線' },
    { label: '.', insert: '.', ariaLabel: '插入點號' },
    { label: ',', insert: ', ', ariaLabel: '插入逗號' },
    { label: '+', insert: ' + ', ariaLabel: '插入加號' },
    { label: '-', insert: ' - ', ariaLabel: '插入減號' },
    { label: '*', insert: '*', ariaLabel: '插入星號' },
    { label: '/', insert: '/', ariaLabel: '插入斜線' },
    { label: '->', insert: ' -> ', ariaLabel: '插入型別箭頭' },
  ];

  const swipeRef = React.useRef<SwipeSelection | null>(null);
  const lastTouchAtRef = React.useRef(0);
  const [activeSymbolIndex, setActiveSymbolIndex] = React.useState<number | null>(null);

  const findSymbolAtX = (container: HTMLDivElement, clientX: number): number | null => {
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-symbol-index]'));
    if (!buttons.length) return null;
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const distance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = Number(button.dataset.symbolIndex);
      }
    }
    return nearestIndex !== null && Number.isInteger(nearestIndex) ? nearestIndex : null;
  };

  // Capture the gesture on the strip itself. Dragging scrolls the symbol row
  // with the finger, while hit-testing by button geometry still works if a
  // neighboring pane visually overlaps the strip.
  const handleStripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' || e.button !== 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-symbol-index]');
    if (!target) return;
    const index = Number(target.dataset.symbolIndex);
    if (!Number.isInteger(index) || index < 0 || index >= symbols.length) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lastTouchAtRef.current = Date.now();
    swipeRef.current = {
      pointerId: e.pointerId,
      selectedIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: e.currentTarget.scrollLeft,
      moved: false,
    };
    setActiveSymbolIndex(index);
  };

  const handleStripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== e.pointerId) return;
    e.preventDefault();
    const deltaX = e.clientX - swipe.startX;
    if (Math.abs(deltaX) > 6 || Math.abs(e.clientY - swipe.startY) > 6) swipe.moved = true;
    if (swipe.moved) {
      const maxScroll = Math.max(0, e.currentTarget.scrollWidth - e.currentTarget.clientWidth);
      e.currentTarget.scrollLeft = Math.max(0, Math.min(maxScroll, swipe.startScrollLeft - deltaX));
    }
    const nextIndex = findSymbolAtX(e.currentTarget, e.clientX);
    if (nextIndex !== null && nextIndex !== swipe.selectedIndex) {
      swipe.selectedIndex = nextIndex;
      setActiveSymbolIndex(nextIndex);
    }
  };

  const finishStripPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== e.pointerId) return;
    e.preventDefault();
    const selected = symbols[swipe.selectedIndex];
    swipeRef.current = null;
    setActiveSymbolIndex(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (selected) onInsert(selected.insert, selected.offset ?? 0);
  };

  const cancelStripPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeRef.current?.pointerId !== e.pointerId) return;
    swipeRef.current = null;
    setActiveSymbolIndex(null);
  };

  const handleSymbolClick = (index: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (Date.now() - lastTouchAtRef.current < 700) {
      e.preventDefault();
      return;
    }
    const selected = symbols[index];
    if (selected) onInsert(selected.insert, selected.offset ?? 0);
  };

  const handleTouchSafe = (fn: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fn();
  };

  return (
    <div
      onPointerDown={handleStripPointerDown}
      onPointerMove={handleStripPointerMove}
      onPointerUp={finishStripPointer}
      onPointerCancel={cancelStripPointer}
      onLostPointerCapture={cancelStripPointer}
      onContextMenu={(e) => e.preventDefault()}
      className="android-symbol-bar relative z-50 shrink-0 w-full self-stretch flex items-center gap-1.5 overflow-x-auto no-scrollbar px-2 py-1.5 bg-transparent select-none [touch-action:none] [-webkit-touch-callout:none] [-webkit-user-select:none]"
      role="toolbar"
      aria-label="Android 觸控符號列"
    >
      <button
        type="button"
        onPointerDown={handleTouchSafe(onUndo)}
        aria-label="復原"
        className="min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center bg-transparent text-[var(--ide-text)] border-0 shadow-none rounded-none active:opacity-60 transition-opacity"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onPointerDown={handleTouchSafe(onRedo)}
        aria-label="重做"
        className="min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center bg-transparent text-[var(--ide-text)] border-0 shadow-none rounded-none active:opacity-60 transition-opacity"
      >
        <Redo2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onPointerDown={handleTouchSafe(() => onMoveCursor(-1))}
        aria-label="游標左移"
        className="min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center bg-transparent text-[var(--ide-text)] border-0 shadow-none rounded-none active:opacity-60 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onPointerDown={handleTouchSafe(() => onMoveCursor(1))}
        aria-label="游標右移"
        className="min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center bg-transparent text-[var(--ide-text)] border-0 shadow-none rounded-none active:opacity-60 transition-opacity"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {symbols.map((sym, index) => (
        <button
          key={sym.label}
          type="button"
          data-symbol-index={index}
          data-swipe-active={activeSymbolIndex === index ? 'true' : 'false'}
          onClick={handleSymbolClick(index)}
          aria-label={sym.ariaLabel}
          className="min-h-[40px] min-w-[42px] px-2.5 shrink-0 flex items-center justify-center font-mono text-xs font-medium bg-transparent text-[var(--ide-text)] border-0 shadow-none rounded-none hover:text-[var(--ide-accent-text)] data-[swipe-active=true]:text-[var(--ide-accent-text)] active:opacity-60 transition-opacity whitespace-nowrap pointer-events-auto"
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
};
