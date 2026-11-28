import type { RefObject } from 'react';
import { AndroidSymbolBar } from './AndroidSymbolBar';
import { CodeEditor, CodeEditorHandle } from './CodeEditor';
import type { PythonFile } from '../types/ide';
import type { ThemeId } from '../services/themes';

interface CodeEditorSurfaceProps {
  file: PythonFile;
  editorRef: RefObject<CodeEditorHandle | null>;
  onChange: (value: string) => void;
  onRunShortcut: () => void;
  onCursorChange: (line: number, col: number) => void;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  theme: ThemeId;
  pyodideReady: boolean;
  transparentBg: boolean;
  showSymbolBar: boolean;
  onInsertSymbol: (text: string, cursorOffset?: number) => void;
  onMoveCursor: (delta: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function CodeEditorSurface({
  file,
  editorRef,
  onChange,
  onRunShortcut,
  onCursorChange,
  fontSize,
  tabSize,
  wordWrap,
  theme,
  pyodideReady,
  transparentBg,
  showSymbolBar,
  onInsertSymbol,
  onMoveCursor,
  onUndo,
  onRedo,
}: CodeEditorSurfaceProps) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-hidden">
        <CodeEditor
          key={file.id}
          ref={editorRef}
          value={file.content}
          filename={file.name}
          onChange={onChange}
          onRunShortcut={onRunShortcut}
          onCursorChange={onCursorChange}
          fontSize={fontSize}
          tabSize={tabSize}
          wordWrap={wordWrap}
          theme={theme}
          pyodideReady={pyodideReady}
          transparentBg={transparentBg}
        />
      </div>
      {showSymbolBar && (
        <AndroidSymbolBar
          tabSize={tabSize}
          onInsert={onInsertSymbol}
          onMoveCursor={onMoveCursor}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      )}
    </>
  );
}
