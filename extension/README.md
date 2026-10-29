# Notify for Claude Code

A system notification when a Claude Code session finishes or needs you. A click opens that
session in the window where it lives. Works in local windows and over Remote-SSH or in Dev
Containers.

![macOS notifications: one session done, another waiting for permission](media/readme/notification.png)

## What it does

- **Notifies** when a session finishes (*Done · 12 min — Fixed the flaky test…*), stops with
  an error, or asks for a permission or an answer. Turns shorter than 45 seconds stay quiet:
  you were watching them.
- **Takes you back.** A click brings the session's window to the front with the session open,
  in its tab or in the Claude sidebar.
- **Shows every session** in the status bar: how many are running and how many are waiting,
  across all windows. Click it for the list and pick one to go there.

![The status bar: two sessions running; then one waiting for you](media/readme/statusbar.png)

The same notification also appears inside the VS Code window that holds the session.
Notifications can be paused for a while, all of them or only the ones inside VS Code.

## Install

Search for **Notify for Claude Code** in the Extensions view, or:

```sh
code --install-extension rayz.claude-session-notify
```

Also on [Open VSX](https://open-vsx.org/extension/rayz/claude-session-notify).

You need macOS 13 or later and the official Claude Code extension. Nothing else: the
extension brings its own small notifying app and runs with VS Code's own runtime, so no
Node.js or Homebrew.

## Setup

On first start a setup page opens (*Notify for Claude Code: Set up…* opens it again):

1. **Connect to Claude Code** — adds four hooks to `~/.claude/settings.json`. Nothing else in
   the file changes.
2. **Allow notifications** — macOS asks once.
3. Optional: set the *Persistent* style so notifications stay on screen, and allow them while
   the screen is shared (macOS hides them in calls and recordings otherwise).

If something does not arrive, run *Notify for Claude Code: Check that notifications work*.
It names what is missing.

## Remote windows

Over Remote-SSH or in a Dev Container, Claude Code and this extension run on the remote
machine, which has no screen. To get system notifications on your Mac, install a second small
extension, **Notify for Claude Code — Bridge**. In a remote window the extension offers it
once; VS Code installs it on your Mac. Clicks work as in a local window.

## Settings

| Setting | Default | |
| --- | --- | --- |
| `claudeNotify.enabled` | `true` | master switch |
| `claudeNotify.minTurnSeconds` | `45` | shorter turns finish quietly (15 s to 2 min) |
| `claudeNotify.events` | all | `done`, `error`, `waitingInput` |
| `claudeNotify.sound` | `true` | |
| `claudeNotify.editorNotifications` | `true` | also show notifications inside VS Code |
| `claudeNotify.statusBar` | `true` | sessions in the status bar |

All commands are under *Notify for Claude Code* in the Command Palette: go to a session,
pause and resume, send a test notification, check, add or remove the hooks.

## How it works

Claude Code runs a small script on four hook events. The script times the turn and shows the
notification with the extension's app, *Notify for Claude Code*, kept in
`~/.claude/claude-notify/`. Each VS Code window listens on a local port guarded by a token; on
a click the script finds the window whose folder holds the session and asks it to open the
session through the Claude Code extension's own command.

In a remote window the script and the extension run on the remote machine. The extension
passes each notification to the bridge on your Mac through VS Code itself, and the click comes
back the same way. No port or tunnel crosses the network.

Nothing leaves your computer. No telemetry.

## Uninstalling

Removes everything it added: hooks, notifications on screen, the app, the script and its
state. VS Code does it after the next restart. Your `claudeNotify.*` settings and the
macOS notification permission stay.

## Known limits

- macOS only. Linux and Windows desktops are not supported yet; the extension installs on
  Linux only as the remote side of a window.
- macOS hides notifications while the screen is shared or recorded, unless *System Settings →
  Notifications → When mirroring or sharing the display* is on.
- A session started in a plain terminal has no tab to go to. It still notifies.
- A remote machine reaches your Mac only through an open VS Code window.
- The command that opens a session belongs to the Claude Code extension and is not a public
  API. If it changes, clicks fall back to a `vscode://` link, which VS Code confirms once.

## Support the project

Free and open source. Donations are welcome:

| Currency | Network | Address |
| --- | --- | --- |
| USDC | Solana | `uHftUQ48JKELxBTJsrWqG7Cz4jLv2hgkz9G6jHptJFV` |
| USDT | TRON (TRC-20) | `TUq4f7MCFvnQBcECteVp9Wun71hqgLrL63` |
| BTC | Bitcoin | `1DbpWsEA2uxN99jRuy9n2Zi7mYEgbFLVeb` |

![QR codes: USDC on Solana, USDT on TRON (TRC-20), BTC on Bitcoin](media/readme/donate.png)

Send each currency only on its own network; coins sent on another network cannot be
recovered.

---

An independent project, not affiliated with or endorsed by Anthropic.
