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

  const handleTouchSafe = (fn: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fn();
  };

  return (
    <div
      className="android-symbol-bar flex items-center gap-1.5 overflow-x-auto no-scrollbar px-2 py-1.5 bg-transparent select-none"
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

      <div className="h-5 w-px bg-[var(--ide-text-muted)]/25 shrink-0 mx-0.5" aria-hidden="true" />

      {symbols.map((sym) => (
        <button
          key={sym.label}
          type="button"
          onPointerDown={handleTouchSafe(() => onInsert(sym.insert, sym.offset ?? 0))}
          aria-label={sym.ariaLabel}
          className="min-h-[40px] min-w-[42px] px-2.5 shrink-0 flex items-center justify-center font-mono text-xs font-medium bg-transparent text-[var(--ide-text)] border-0 shadow-none rounded-none hover:text-[var(--ide-accent-text)] active:opacity-60 transition-opacity whitespace-nowrap"
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
};
