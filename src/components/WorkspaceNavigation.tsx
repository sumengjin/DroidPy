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
 * Selection is communicated by accent text color only;
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
        ? 'relative z-[60] flex w-full shrink-0 min-h-[68px] pb-safe px-1'
        : 'w-full h-11 shrink-0 flex items-center justify-between gap-3 px-3'}
    >
      <div className={isPhone
        ? 'grid grid-cols-4 items-stretch gap-1 w-full min-w-0'
        : 'flex items-center gap-3 min-w-0'}
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
              className={`dp-nav-item min-w-0 flex items-center justify-center gap-1.5 ${
                isPhone ? 'w-full flex-col min-h-[56px] px-1' : 'flex-row min-h-[36px] px-2'
              }`}
            >
              <Icon className={isPhone ? 'w-5 h-5' : 'w-4 h-4'} strokeWidth={active ? 2.3 : 1.8} />
              <span className={isPhone ? 'text-[11px] font-semibold leading-tight whitespace-nowrap' : 'text-xs font-medium whitespace-nowrap'}>{labels[id]}</span>
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
          className="dp-nav-item shrink-0 min-h-[36px] px-2 flex items-center justify-center gap-1.5"
        >
          <Settings className="w-4 h-4" strokeWidth={1.8} />
          <span className="text-xs font-medium">{settingsLabel}</span>
        </button>
      )}
    </nav>
  );
}
