import { Code2, FolderOpen, Globe, Terminal as TerminalIcon } from 'lucide-react';

export type WorkspaceDestination = 'editor' | 'terminal' | 'files' | 'browser';

interface WorkspaceNavigationRailProps {
  activeDestination: WorkspaceDestination;
  labels: Record<WorkspaceDestination, string>;
  onNavigate: (destination: WorkspaceDestination) => void;
}

const DESTINATIONS = [
  { id: 'editor', Icon: Code2 },
  { id: 'terminal', Icon: TerminalIcon },
  { id: 'files', Icon: FolderOpen },
  { id: 'browser', Icon: Globe },
] as const;

export function WorkspaceNavigationRail({
  activeDestination,
  labels,
  onNavigate,
}: WorkspaceNavigationRailProps) {
  return (
    <nav
      aria-label="工作區"
      className="w-[76px] shrink-0 flex flex-col items-center gap-2 py-3 border-r border-[var(--ide-border)] bg-[var(--md-surface-container-low)]"
    >
      {DESTINATIONS.map(({ id, Icon }) => {
        const active = activeDestination === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-label={labels[id]}
            aria-current={active ? 'page' : undefined}
            title={labels[id]}
            className={`w-14 min-h-[60px] rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-colors ${
              active
                ? 'bg-[var(--ide-accent-soft)] text-[var(--ide-accent-text)]'
                : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface-alt)] hover:text-[var(--ide-text)]'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold leading-tight">{labels[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
