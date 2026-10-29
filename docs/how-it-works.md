# How it works

## Hooks and the notifier

Claude Code tells other programs about a session only through hooks. The extension adds four to
`~/.claude/settings.json`:

| Hook | What the notifier does |
| --- | --- |
| `UserPromptSubmit` | notes when the turn started; clears the session's old notification |
| `Stop`, `StopFailure` | measures the turn; announces it unless it was short |
| `Notification` | announces a permission request or a question |

Each hook runs one script, `claude-notify.mjs`, kept at `~/.claude/claude-notify/`. It is started
by `~/.claude/claude-notify/claude-notify` with VS Code's own runtime, so no Node.js is needed. The
script hands the notification to a detached process and returns at once: a hook never holds up
the session it reports on.

## The notifying app

An extension cannot show a system notification: VS Code has no API for it. macOS also gives every
notification to an app, with that app's name and icon, and asks once whether the app may notify.
So the extension brings a small app of its own, *Notify for Claude Code*, kept at
`~/.claude/claude-notify/`. The command a click should run travels inside the notification;
nothing waits for an answer, and macOS relaunches the app to deliver the click.

## Windows and clicks

Each VS Code window's extension listens on a loopback port, guarded by a random token, and
writes its port and folders to `~/.claude/claude-notify/links/`. On a click the script picks the
window whose folders hold the session (the folder the session was started in, even if it moved
on to another repository), brings it to the front and asks it to open the session. The extension
does that through the Claude Code extension's own command, so VS Code's confirmation prompt for
external links never appears. A session that no window holds is not sent to a stranger window,
which would show an empty tab.

## The session list

The script keeps one small file per active session in `~/.claude/claude-notify/sessions/`; every
window reads them for its status bar and list. Whether a session is running is what Claude Code
says in its own record of running processes (`~/.claude/sessions/`). For a session it says
nothing about, the transcript decides: a working session keeps adding dated records to it. Title,
model and context size come from the end of the transcript when the list opens.

## Remote windows

Over Remote-SSH or in a Dev Container, Claude Code runs on the remote machine, so its hooks, the
script and the extension run there too. That machine has no screen. The notifications inside VS
Code still appear, because VS Code draws them on your computer; the system ones need a part on
your Mac: **Notify for Claude Code — Bridge**, a separate extension that VS Code installs on the
Mac (it is a UI extension).

A VS Code window has two extension hosts, one on the remote machine and one on your Mac, and VS
Code carries commands between them. No port, tunnel or token crosses the network.

1. The script on the remote machine sees that the session's window is remote and hands the
   notification to the extension there instead of showing it.
2. The extension passes it to the bridge by command.
3. The bridge runs the same script on the Mac, which shows the notification with the notifying
   app and stores the window's remote address (`vscode-remote://…`) in the click command.
4. On a click the script on the Mac raises that window with VS Code's command line
   (`code --folder-uri`) and asks the bridge, and through it the extension on the remote
   machine, to open the session.
5. A new prompt in the session takes its notification back from the Mac.

The remote machine needs no Node.js either: the hooks run with the VS Code server's runtime.

## Privacy

Nothing leaves your computer: no telemetry, no network calls beyond loopback.
