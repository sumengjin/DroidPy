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
        ? 'relative z-[60] grid grid-cols-4 shrink-0 min-h-[64px] pb-safe px-2'
        : 'w-14 shrink-0 flex flex-col items-center justify-start py-2'}
    >
      <div className={isPhone
        ? 'grid grid-cols-4 items-center gap-1 w-full'
        : 'flex flex-col items-center gap-1 w-full px-1'}
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
              className={`dp-nav-item min-w-0 flex flex-col items-center justify-center gap-1 ${
                isPhone ? 'min-h-[48px] px-1' : 'w-full min-h-[52px] px-1'
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
          className="dp-nav-item w-full min-h-[48px] flex flex-col items-center justify-center gap-1"
        >
          <Settings className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{settingsLabel}</span>
        </button>
      )}
    </nav>
  );
}
