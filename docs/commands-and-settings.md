# Commands and settings

## Commands

All are in the Command Palette under *Notify for Claude Code*.

| Command | What it does |
| --- | --- |
| Go to a session | the list of every active session, as a click on the status bar |
| Set up… | the setup page: connect, allow notifications, try it |
| Allow notifications | asks macOS, as the setup page does |
| Open notification settings | this app's page in System Settings → Notifications |
| Show notifications while sharing the screen | the System Settings page with *When mirroring or sharing the display* |
| Announce turns longer than… | 15 seconds to 2 minutes; also at the bottom of the session list |
| Send a test notification | one notification, to check it appears; it belongs to no session, so a click opens nothing |
| Check that notifications work | checks the setup and names what is broken; in a remote window, the bridge too |
| Turn notifications on or off | master switch |
| Pause notifications… | all of them or only the ones inside VS Code, for a while; also at the bottom of the session list |
| Resume notifications | lifts any pause |
| Add hooks to Claude Code settings | connects, as the setup page does |
| Remove hooks from Claude Code settings | takes out only what it added |

The bridge has no commands of its own.

## Settings

| Setting | Default | |
| --- | --- | --- |
| `claudeNotify.enabled` | `true` | master switch |
| `claudeNotify.minTurnSeconds` | `45` | 15, 30, 45 seconds, 1, 1.5 or 2 minutes; shorter turns finish quietly |
| `claudeNotify.events` | all | `done`, `error`, `waitingInput` |
| `claudeNotify.style` | `alert` | Linux and Windows only: `alert` stays until answered, `banner` fades out. On macOS this is set in System Settings → Notifications |
| `claudeNotify.sound` | `true` | |
| `claudeNotify.editorNotifications` | `true` | the same notification inside the window that holds the session |
| `claudeNotify.statusBar` | `true` | running and waiting sessions in the status bar |

The extension mirrors these into `~/.claude/claude-notify.config.json`, which the notifier reads
on every event. Keys that only the file has (language, click behaviour and more) are described
on the [plugin page](plugin.md#configuration).
