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
          <button key={file.id} type="button" role="tab" aria-selected={active} aria-current={active ? 'page' : undefined} onClick={() => onSelect(file.id)} title={file.name}
            className={`dp-nav-item font-mono text-xs truncate transition-colors shrink-0 ${
              isPhone ? 'min-h-[40px] max-w-[180px] px-3 rounded-xl' : 'min-h-[34px] px-2.5 rounded-lg whitespace-nowrap'
            }`}>
            {file.name}
          </button>
        );
      })}
      <button type="button" onClick={onCreate} aria-label={createLabel} title={createLabel}
        className={isPhone ? 'dp-icon-button min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center rounded-xl' : 'dp-icon-button min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg shrink-0'}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
