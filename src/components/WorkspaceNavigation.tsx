import { Code2, FolderOpen, Globe, Settings, Terminal as TerminalIcon } from 'lucide-react';

export type WorkspaceDestination = 'editor' | 'terminal' | 'files' | 'browser';

interface WorkspaceNavigationProps {
  variant: 'phone' | 'tablet';
  activeDestination: WorkspaceDestination;
  labels: Record<WorkspaceDestination, string>;
  onNavigate: (destination: WorkspaceDestination) => void;
  settingsLabel?: string;
  onOpenSettings?: () => void;
  ariaLabel?: string;
}

const DESTINATIONS = [
  { id: 'editor', Icon: Code2 },
  { id: 'terminal', Icon: TerminalIcon },
  { id: 'files', Icon: FolderOpen },
  { id: 'browser', Icon: Globe },
] as const;

/**
 * One navigation model, two deliberately different layouts.
 * Selection is communicated by an outline and accent foreground only;
 * idle destinations remain transparent and theme-muted.
 */
export function WorkspaceNavigation({
  variant,
  activeDestination,
  labels,
  onNavigate,
  settingsLabel,
  onOpenSettings,
  ariaLabel = '工作區',
}: WorkspaceNavigationProps) {
  const isPhone = variant === 'phone';

  return (
    <nav
      aria-label={ariaLabel}
      className={isPhone
        ? 'relative z-[60] grid grid-cols-4 shrink-0 min-h-[64px] pb-safe px-2'
        : 'w-[76px] shrink-0 flex flex-col items-center justify-between gap-3 py-3'}
    >
      {!isPhone && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <img src="/icon.svg" alt="DroidPy" className="w-8 h-8" referrerPolicy="no-referrer" />
          <span className="text-[9px] font-bold tracking-[0.16em] text-[var(--ide-text-muted)]">DPY</span>
        </div>
      )}

      <div className={isPhone
        ? 'grid grid-cols-4 items-center gap-1 w-full'
        : 'flex flex-col items-center gap-2 w-full px-2'}
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
              className={`min-w-0 flex flex-col items-center justify-center gap-1.5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ide-accent)] ${
                isPhone ? 'min-h-[56px] rounded-xl px-1' : 'w-full min-h-[64px] rounded-xl px-1'
              } ${
                active
                  ? 'border-[var(--ide-accent)]/75 text-[var(--ide-accent-text)]'
                  : 'border-transparent bg-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              }`}
            >
              <Icon className={isPhone ? 'w-[19px] h-[19px]' : 'w-5 h-5'} strokeWidth={active ? 2.3 : 1.8} />
              <span className="text-[10px] font-semibold leading-tight truncate max-w-full">{labels[id]}</span>
            </button>
          );
        })}
      </div>

      {!isPhone && settingsLabel && onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={settingsLabel}
          title={settingsLabel}
          className="w-full min-h-[56px] rounded-xl border border-transparent bg-transparent flex flex-col items-center justify-center gap-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ide-accent)]"
        >
          <Settings className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{settingsLabel}</span>
        </button>
      )}
    </nav>
  );
}
