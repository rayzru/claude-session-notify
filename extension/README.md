# Notify for Claude Code

Know when a Claude Code session finishes or needs you, and get back to it in one click.

![macOS notifications: one session done, another waiting for permission](media/readme/notification.png)

## What you get

**A notification** when a session is done, stopped with an error, or waiting for a permission
or an answer. It names the session and shows how its last answer began. A click brings that
session's window to the front with the session open. Turns shorter than 45 seconds stay quiet:
you were watching them.

**The same notification inside VS Code**, in the window that holds the session.

![The notification inside VS Code, with an Open session button](media/readme/toast.png)

**Every session in the status bar**: how many are running and how many are waiting for you,
across all windows.

![The status bar: two sessions running; then one waiting for you, highlighted](media/readme/statusbar.png)

Click it for the list. Pick a session to go there.

![The session list: every Claude Code session in every window](media/readme/sessions.png)

## How it works

Claude Code reports what its sessions do through hooks. The extension adds four of them to
`~/.claude/settings.json`: when you send a prompt, when a turn ends or fails, and when Claude
asks for something. On each event a small script decides whether it is worth a notification
and shows it with the extension's own notifying app. On a click, the script finds the VS Code
window that holds the session and asks the Claude Code extension there to open it.

Everything stays on your computer. No telemetry.

## Install

Search for **Notify for Claude Code** in the Extensions view, or run
`code --install-extension rayz.claude-session-notify`. Also on
[Open VSX](https://open-vsx.org/extension/rayz/claude-session-notify).

Needs macOS 13 or later and the official Claude Code extension. Nothing else: no Node.js, no
Homebrew.

A setup page opens on first start: connect to Claude Code, allow notifications, try it. If a
notification does not arrive, run *Notify for Claude Code: Check that notifications work*.

## Remote windows

Over Remote-SSH or in a Dev Container, Claude Code runs on the remote machine, and the
extension has to run there too. That machine has no screen, so a second small extension,
**Notify for Claude Code — Bridge**, shows the notifications on your Mac. In a remote window
the extension offers to install it. Clicks work the same way.

## More

- [Commands and settings](https://github.com/rayzru/claude-session-notify/blob/main/docs/commands-and-settings.md)
- [How it works, in detail](https://github.com/rayzru/claude-session-notify/blob/main/docs/how-it-works.md)
- [Known limits, uninstalling, plans](https://github.com/rayzru/claude-session-notify/blob/main/docs/limits.md)
- [Changelog](https://github.com/rayzru/claude-session-notify/blob/main/extension/CHANGELOG.md)

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
