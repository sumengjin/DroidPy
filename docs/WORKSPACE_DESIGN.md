# DroidPy Workspace Architecture

This is the product contract for the rebuilt DroidPy interface. The former AI Studio screen composition is not a foundation to preserve: its page hierarchy, card-first grouping, repeated headers, and panel framing are retired. New work must be designed around the tasks people perform in a mobile Python environment.

## Product model

DroidPy opens directly into the editor. The four primary workspaces are Editor, Terminal, Files, and Browser. Settings is a separate full-screen work area and is not a dashboard or a nested folder tree.

The editor, terminal, file system, and browser are first-class work surfaces. They must retain their state while users move between destinations. Navigation changes the active work surface; it must not remount or reset the Python runtime, editor buffer, terminal session, browser session, or linked storage state.

## Phone experience

- Treat the phone as a focused, single-work-surface tool. The active destination occupies the available viewport.
- Keep the bottom destination dock compact and persistent; do not add a second row of duplicate destination labels or repeat the active filename in multiple bars.
- The top strip is for essential global actions only: Settings and execution controls. The editor filename belongs in the file tab strip, not repeated in the title bar.
- Prefer contextual actions and direct manipulation over permanent toolbars. The code editor and terminal output receive the majority of the screen.
- Respect Android keyboard and system-bar insets. Interactive controls remain touch accessible without forcing decorative padding.

## Tablet experience

- Do not use a phone layout enlarged to tablet dimensions.
- Use a compact horizontal workspace switcher below the file/execution header; do not reserve a permanent branded left rail.
- The workbench below it is the primary canvas. In focused mode, the selected workspace uses the full canvas. In split mode, the editor and the selected secondary workspace share the canvas.
- Split proportions are flexible layout weights, not fixed percentages. Give the editor slightly more space in landscape while preserving usable terminal/file/browser width; use balanced vertical weights in portrait.
- The editor and secondary workspace are independent surfaces without decorative divider rails, card frames, or duplicated titles.

## Interaction and visual rules

- Selected navigation and tabs are indicated by foreground text/icon color only. No selected outline, pill, filled tile, or surrounding selection box.
- Remove decorative brand marks, redundant labels, unnecessary separator lines, and empty toolbars.
- Do not spend vertical space on repeated status labels. Keep essential run, stop, pause, copy, clear, and log actions compact and close to the content they control.
- Use the active `--ide-*` theme tokens for readable foregrounds and focus states. Keyboard focus remains visible for accessibility; it is not a persistent selection frame.
- Cards and sheets are reserved for true overlays or meaningful grouped settings, never ordinary editor/terminal/file/browser content.

## Runtime and data invariants

- Keep editor buffers, file identity, original Android shared-storage paths, and save-before-run behavior intact.
- Preserve native Termux and Pyodide execution routes, package source policies, operation locks, stdin sessions, and process cleanup protections.
- Preserve browser cookies, headers, user agent, and session state when switching destinations.
- Android Back unwinds nested tool/settings navigation and the phone destination history without discarding workspace state.

## Acceptance criteria

A redesign is not complete if the result can be described as the old AI Studio layout with different colors, smaller buttons, or rearranged panels. The phone and tablet must have visibly different information architecture and content-first work surfaces.

Regression validation covers all 14 themes, phone/tablet navigation, split/focus modes, Android Back, editor persistence, terminal execution states, browser session state, and shared-storage save/open/run behavior. CI and APK compilation are necessary but do not replace physical-device testing.
