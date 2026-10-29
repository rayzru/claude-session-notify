# claude-session-notify

Notifications for Claude Code sessions: when a session finishes or needs you, a click opens it.
This repository holds two things that share one notifier script:

- **[Notify for Claude Code](extension/README.md)**, the VS Code extension — what most people
  want. Nothing else to install; works in local and remote (SSH, Dev Container) windows.
- **`claude-notify`**, a Claude Code plugin with the same notifications, for setups without
  the extension. Described below.

![macOS notifications: one session done, another waiting for permission](extension/media/readme/notification.png)

Tested on macOS with VS Code and the official Claude Code extension. The script also builds
Windows toasts and Linux `notify-send` notifications, but those paths have only dry-run tests.

## Install the plugin

```
/plugin marketplace add rayzru/claude-session-notify
/plugin install claude-notify@rayzru
```

Hooks are read when a session starts, so open a new session. Then:

```
/claude-notify:doctor
```

It names whatever is broken.

### Requirements

- **Node 18 or newer** — the plugin's hooks run with it.
- **Something to show the notifications**: the VS Code extension's own app (install the
  extension), or [`terminal-notifier`](https://github.com/julienXX/terminal-notifier)
  (`brew install terminal-notifier`; launch it once by hand so macOS asks for permission:
  `open -a "$(brew --prefix terminal-notifier)/terminal-notifier.app" --args -message hi`).
  Without either, notifications come through `osascript` and cannot be clicked.

## What you get

| Event | Notification |
| --- | --- |
| Session finished | *Done · N min* |
| Session stopped with an error | *Stopped with an error* |
| Session wants a permission or an answer | the actual request text |

Turns shorter than `minTurnSeconds` (45 by default) stay quiet, a newer notification for a
session replaces the older one, and subagents stay silent.

## Clicking a notification

The click opens `vscode://<extensionId>/open?session=<id>`, which reveals that session's
existing tab instead of opening a second one.

- **VS Code asks once** before the link reaches the extension. Until you answer, a click only
  raises the window. `doctor` tells you whether it has been answered.
- **The URL is not a documented API.** If the Claude Code extension changes it, clicks stop
  working; notifications keep working.
- **A session in a plain terminal** has no tab, so the notification has no click.

## Configuration

Settings live in `~/.claude/claude-notify.config.json`. Write a file with every key at its
default with `--init-config`.

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | master switch |
| `language` | `"auto"` | follows the editor's UI language; or pin a code |
| `style` | `"alert"` | `alert` waits for a reply; `banner` fades out on its own |
| `events` | all `true` | `done`, `error`, `waitingInput` |
| `minTurnSeconds` | `45` | below this a finished turn is not announced |
| `waitTimeoutSeconds` | `0` | how long an alert waits; `0` waits indefinitely |
| `groupPerSession` | `true` | `false` keeps every notification instead of replacing |
| `click` | `"auto"` | `auto` links to the editor only when running in one; `focusSession` always; `none` never |
| `sound` | `true` | |
| `uriScheme` | `"vscode"` | use `vscode-insiders`, `cursor`, … for a fork |
| `extensionId` | `"Anthropic.claude-code"` | the extension that handles the link |
| `staleHours` | `24` | age at which an unanswered notification is cleaned up |

Every key has an environment override, which wins over the file:
`CLAUDE_NOTIFY_DISABLED=1`, `CLAUDE_NOTIFY_LANG`, `CLAUDE_NOTIFY_STYLE`,
`CLAUDE_NOTIFY_CLICK`, `CLAUDE_NOTIFY_SOUND`, `CLAUDE_NOTIFY_MIN_SECONDS`,
`CLAUDE_NOTIFY_TIMEOUT`, `CLAUDE_NOTIFY_STALE_HOURS`, `CLAUDE_NOTIFY_CONFIG`.

Shipped languages: `en`, `ru`, `de`, `fr`, `es`, `pt-br`, `ja`, `zh-cn`. Adding one is a
single entry in the `STRINGS` table at the top of the script — eight short strings.

## Commands

| Slash command | What it does |
| --- | --- |
| `/claude-notify:doctor` | check the environment and explain whatever is broken |
| `/claude-notify:test` | send one notification and verify the click |
| `/claude-notify:config` | show the effective settings, or change one |
| `/claude-notify:pause` | pause notifications for a while, or resume them — `/claude-notify:pause 30` |

The script is also a plain CLI, which is what those commands call:

```sh
hooks/claude-notify.mjs --doctor        # environment check
hooks/claude-notify.mjs --test          # sample notification
hooks/claude-notify.mjs --config        # effective settings and detected language
hooks/claude-notify.mjs --init-config   # write a config file with the defaults
hooks/claude-notify.mjs --list          # delivered notifications
hooks/claude-notify.mjs --pause [minutes] [--editor]   # quiet for a while; no minutes = until --resume
hooks/claude-notify.mjs --resume        # notifications back on
hooks/claude-notify.mjs --help
```

## How it works

Four hooks, one script, no dependencies. `UserPromptSubmit` notes when a turn starts; `Stop`
and `StopFailure` measure it and stay quiet if it was short; `Notification` fires when Claude
wants a permission or an answer. The hook hands the notification to a detached process and
returns at once, so it never holds up the session. A newer notification for a session replaces
the older one.

## Support the project

Notify for Claude Code is free and open source. If it saves you time, you can support its
development with a donation:

| Currency | Network | Address |
| --- | --- | --- |
| USDC | Solana | `uHftUQ48JKELxBTJsrWqG7Cz4jLv2hgkz9G6jHptJFV` |
| USDT | TRON (TRC-20) | `TUq4f7MCFvnQBcECteVp9Wun71hqgLrL63` |
| BTC | Bitcoin | `1DbpWsEA2uxN99jRuy9n2Zi7mYEgbFLVeb` |

![QR codes: USDC on Solana, USDT on TRON (TRC-20), BTC on Bitcoin](extension/media/readme/donate.png)

**Send each currency only on its own network.** Coins sent on any other network — USDT on
Ethereum, say — cannot be recovered.
