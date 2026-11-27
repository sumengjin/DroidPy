# DroidPy Workspace Redesign Acceptance

## Non-negotiable direction

This is a replacement of the AI Studio-generated workspace information architecture, not a reskin of its existing page, toolbar, card, or pane arrangement. Do not treat moving old controls, changing colors, or shrinking borders as completion.

The editor, terminal, files, and settings must be reorganized around real development tasks. The usable content area takes priority over branding, decorative icons, duplicated labels, persistent chrome, and empty toolbar rows.

## Device-specific experiences

### Phone
- Treat each primary task as a focused, full-screen workspace.
- Keep navigation compact and predictable; do not make the editor share its limited height with persistent desktop-style panes.
- Keep the active file and essential editor actions close to the code, without repeating the same filename or page title in multiple bars.
- Terminal and file management should receive the full available content area when selected.

### Tablet
- Use a workbench model rather than a scaled phone layout or a permanently fixed two-column template.
- The editor is the primary work surface; terminal and files can be brought alongside it when the task benefits from comparison or execution.
- Workspace selection must have one clear control surface. Do not render duplicate destination selectors for the same pane.
- Pane sizing must be adaptable to available width/orientation; fixed 56/44-style proportions are not an acceptable final design.
- Avoid a permanent branding/sidebar column. Settings remain available without consuming a persistent navigation rail.

## Visual and interaction rules

- Selected navigation is communicated by foreground text/icon color, not a selection box or filled pill.
- Remove decorative separators and repeated section headers when hierarchy remains understandable without them.
- Compress status/action chrome; never reserve a full toolbar row for information that can be inline or contextual.
- Keep functional touch targets accessible even when surrounding visual chrome is minimal.
- Preserve keyboard focus visibility and accessible names.
- Do not remove working functionality merely to make a screenshot look cleaner.

## Browser scope freeze

The crawler browser is a specialized tool used by scraping scripts and web-session workflows, including inspecting pages and working with cookies/session state. It is explicitly out of scope for this UI rebuild.

Until the rest of the workspace redesign is complete:
- Do not change the crawler browser layout, navigation, WebView behavior, cookie handling, headers, user-agent, storage, or session persistence.
- Do not reset or migrate crawler session data as part of workspace UI changes.
- Keep its existing entry point and integration intact.
- Revisit browser presentation only as a separate, explicitly reviewed follow-up after the main workspace has been rebuilt.

## Completion gate

The redesign is not complete until:
1. The phone and tablet information architectures are demonstrably different and task-appropriate.
2. The old AI Studio page/pane hierarchy is no longer the organizing structure.
3. There are no duplicated navigation controls for the same destination.
4. Code, terminal output, and file content gain meaningful usable space.
5. Existing editor, Termux execution, package, storage, backup/restore, and crawler-browser behavior remain intact.
6. Frontend checks and Android ARM64 APK CI pass on the exact final commit.
7. The resulting APK is tested on a phone and a tablet before the PR is merged or a release is published.

A visually cleaner version of the old layout does not pass this gate.
