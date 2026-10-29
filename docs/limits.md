# Limits, uninstalling, plans

## Known limits

- **macOS only, for now.** The extension installs on Linux only as the remote side of a window.
  Linux and Windows desktops are [planned](#plans).
- **Nothing shows while the screen is shared.** macOS hides notifications while the screen is
  mirrored, shared or recorded, unless *System Settings → Notifications → When mirroring or
  sharing the display* is on. The setup page links to it.
- **A remote machine reaches your Mac only through an open window.** With no VS Code window
  connected to it, a session there has nowhere to send a system notification.
- **Sessions in a plain terminal** have no tab to go to. They still notify.
- **The command that opens a session belongs to the Claude Code extension** and is not a public
  API. If a future release renames it, clicks fall back to a `vscode://` link, which works after
  VS Code asks once.
- **VS Code cannot take back a notification it has shown.** Inside VS Code a newer one does not
  replace the older, and old ones stay in the list until you clear them. Their button still
  opens the right session.
- **Context is shown as a size, not a percentage.** The transcript rarely says how large the
  model's window is.
- **"Running" is Claude Code's word.** Hooks alone miss too much (background agents, a session
  resumed after a restart, one killed mid-turn), so Claude Code's own record of its processes
  decides. Without it, a session silent for ten minutes leaves the list.

## Uninstalling

Uninstalling removes everything it added: the hooks, notifications still on screen, the copied
script, the notifying app, the session list, the pause, the debug log, the per-turn state and the
config file. The config file stays if the claude-notify plugin is installed, since it is the
plugin's too. VS Code runs this after the next restart.

Two things stay: your `claudeNotify.*` settings in VS Code, and *Notify for Claude Code* in
System Settings → Notifications with what you allowed, so a reinstall does not ask again.

## Plans

- **Linux desktop.** The notifier builds a `notify-send` notification, but it has not been run
  for real. Next: test on GNOME and KDE, make a click open the session.
- **Windows.** The notifier builds a toast through PowerShell, also never run. Next: test on
  Windows 10 and 11, a bridge for Windows, packages.
