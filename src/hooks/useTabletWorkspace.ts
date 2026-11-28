import { useCallback, useState } from 'react';
import type { TabletPaneTab } from '../types/ide';

export type TabletWorkspaceDestination = 'editor' | TabletPaneTab;

export function useTabletWorkspace() {
  const [split, setSplit] = useState(true);
  const [activePane, setActivePane] = useState<TabletWorkspaceDestination>('terminal');

  const navigate = useCallback((destination: TabletWorkspaceDestination) => {
    setActivePane(destination);
    setSplit(false);
  }, []);

  const focusOutput = useCallback((pane: 'terminal' | 'browser' = 'terminal') => {
    setActivePane(pane);
    setSplit(true);
  }, []);

  const toggleSplit = useCallback(() => {
    setSplit((current) => {
      if (current) {
        setActivePane('editor');
        return false;
      }
      setActivePane((pane) => pane === 'editor' ? 'terminal' : pane);
      return true;
    });
  }, []);

  return {
    split,
    activePane,
    setActivePane,
    setSplit,
    navigate,
    focusOutput,
    toggleSplit,
  };
}
