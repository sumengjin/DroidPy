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

  const getSymbolIndexAtPoint = (x: number, y: number): number | null => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-symbol-index]');
    if (!target) return null;
    const index = Number(target.dataset.symbolIndex);
    return Number.isInteger(index) && index >= 0 && index < symbols.length ? index : null;
  };

  // Delegate the complete gesture to the strip so Android WebView cannot
  // interrupt it when the finger leaves the starting button.
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const index = getSymbolIndexAtPoint(touch.clientX, touch.clientY);
    if (index === null) return;
    e.preventDefault();
    lastTouchAtRef.current = Date.now();
    swipeRef.current = { selectedIndex: index, startX: touch.clientX, startY: touch.clientY, moved: false };
    setActiveSymbolIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    const touch = e.changedTouches[0];
    if (!swipe || !touch) return;
    e.preventDefault();
    if (Math.abs(touch.clientX - swipe.startX) > 6 || Math.abs(touch.clientY - swipe.startY) > 6) swipe.moved = true;
    const nextIndex = getSymbolIndexAtPoint(touch.clientX, touch.clientY);
    if (nextIndex !== null && nextIndex !== swipe.selectedIndex) {
      swipe.selectedIndex = nextIndex;
      setActiveSymbolIndex(nextIndex);
    }
  };

  const finishTouchGesture = (e: React.TouchEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe) return;
    e.preventDefault();
    const selected = symbols[swipe.selectedIndex];
    swipeRef.current = null;
    setActiveSymbolIndex(null);
    if (selected) onInsert(selected.insert, selected.offset ?? 0);
  };

  const cancelTouchGesture = () => {
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
    if (e.pointerType !== 'touch') fn();
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishTouchGesture}
      onTouchCancel={cancelTouchGesture}
      onContextMenu={(e) => e.preventDefault()}
      className="android-symbol-bar w-full self-stretch flex items-center gap-1.5 overflow-x-auto no-scrollbar px-2 py-1.5 bg-transparent select-none [touch-action:pan-y] [-webkit-touch-callout:none] [-webkit-user-select:none]"
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
