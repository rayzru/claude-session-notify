# Notify for Claude Code — Bridge

The local half of [Notify for Claude Code](https://marketplace.visualstudio.com/items?itemName=rayz.claude-session-notify)
for windows that work on a remote machine: Remote-SSH, WSL, Dev Containers.

In such a window Claude Code, its hooks and Notify for Claude Code itself run on the remote
machine, beside your sessions. That machine has no screen, so a system notification has
nowhere to appear. The bridge runs on the computer in front of you instead: Notify for
Claude Code hands it each notification through VS Code, and it shows it with the same
notifying app the extension uses on a Mac of its own. A click raises the window and opens
the session, as it does locally.

You do not need it for local windows, where the extension shows notifications itself. In a
remote window without it, the extension offers to install it once; notifications inside VS
Code keep coming either way.

It has no settings and no commands of its own: everything is set in Notify for Claude Code.
"Notify for Claude Code: Check that notifications work" reports on both halves.

macOS only for now, like the extension's notifying app.
