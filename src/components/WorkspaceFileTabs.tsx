import type { PythonFile } from '../types/ide';
import { Plus } from 'lucide-react';

interface WorkspaceFileTabsProps {
  files: PythonFile[];
  activeFileId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  createLabel: string;
  filesLabel: string;
  variant: 'phone' | 'tablet';
}

/** Shared file navigation and creation entry point with form-factor-specific presentation. */
export function WorkspaceFileTabs({ files, activeFileId, onSelect, onCreate, createLabel, filesLabel, variant }: WorkspaceFileTabsProps) {
  const isPhone = variant === 'phone';
  return (
    <div className={isPhone ? 'flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar' : 'flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0'} role="tablist" aria-label={filesLabel}>
      {files.map((file) => {
        const active = file.id === activeFileId;
        return (
          <button key={file.id} type="button" role="tab" aria-selected={active} onClick={() => onSelect(file.id)} title={file.name}
            className={isPhone
              ? `min-h-[36px] max-w-[180px] shrink-0 px-3 rounded-t-xl border-b-2 text-xs font-mono truncate transition-colors ${active ? 'border-[var(--ide-accent)] bg-[var(--ide-surface)] text-[var(--ide-accent-text)] font-semibold' : 'border-transparent text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]'}`
              : `min-h-[34px] px-2.5 rounded-lg font-mono text-xs transition-colors whitespace-nowrap shrink-0 ${active ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)] font-semibold border border-[var(--ide-accent)]/30' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'}`}>
            {file.name}
          </button>
        );
      })}
      <button type="button" onClick={onCreate} aria-label={createLabel} title={createLabel}
        className={isPhone ? 'min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center rounded-xl text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]' : 'min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)] shrink-0'}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
