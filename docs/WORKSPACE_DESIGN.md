# DroidPy Workspace Design

This document defines the product-level UI direction for the workspace rebuild. It is intentionally independent of the former AI Studio / Material card layout.

## Product structure

- The app opens into the Python editor workspace, not a feature dashboard.
- Everyday destinations are Editor, Terminal, Files, and Browser.
- Settings is a separate full-screen workspace. Termux runtime, package management, Android storage, and preferences are direct categories, not nested folder trees.
- Package management exposes native Termux packages and the Pyodide sandbox directly.
- Phone and tablet share destination and operation models, but do not share a forced layout.

## Form factors

- Phone: bottom destination navigation, contextual top bar, one primary work surface at a time, touch-sized execution actions.
- Tablet: persistent side navigation, file tabs in the top bar, optional editor plus secondary workspace split.
- Android Back unwinds the active tool, category, and workspace in order; it must not discard the user's editor state.

## Visual language

- Remove decorative panel frames and stacked cards when spacing or a thin divider communicates the grouping.
- Unselected navigation is transparent and theme-muted.
- Selected navigation uses the current theme accent for its outline and foreground.
- Disabled controls are visibly weaker than unselected controls; keyboard focus remains explicit.
- Use `--ide-*` theme variables only. Theme choice controls backgrounds, text, muted contrast, and accent behavior.
- `.dp-nav-item` is the shared selected-state primitive for navigation, tabs, and toggles.
- `.dp-icon-button` is the transparent icon-only action primitive.
- `.dp-workspace-row` is the flat, divider-based action row.
- `.dp-panel` and `.dp-panel-tonal` are surface-free layout groupings; `.dp-callout` is reserved for meaningful status or warning content.
- `.dp-sheet` is reserved for genuine overlays, not ordinary content sections.

## Shared behavior

- `WorkspaceHeader` composes file navigation, split-view control, and execution actions for both form factors.
- `WorkspaceExecutionControls` is the single Run / Pause / Resume / Stop presentation and state mapping.
- Python execution, Termux operations, package installation, file persistence, browser behavior, backup and restore remain domain services; UI work must not duplicate or weaken them.

## Regression expectations

- Preserve all 14 themes and derive interaction contrast from their theme tokens.
- Preserve editor contents, file identity, original Android shared-storage paths, and save-before-run behavior.
- Preserve native Termux and Pyodide package routes and operation locks.
- Test both phone and tablet layout paths, Android Back behavior, and all execution states.
- A successful web build or APK compile does not replace physical-device validation.
