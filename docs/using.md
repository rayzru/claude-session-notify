# Using it

## Notifications

| When | Notification |
| --- | --- |
| A session finished | *Done · N min* |
| A session stopped with an error | *Stopped with an error* |
| A session wants a permission or an answer | the request text |

Each notification is titled with the session's name, the one on its tab, with the project
underneath. It shows how the last answer began: *Done · 12 min — Fixed the flaky test and pushed
the branch.*

- **A click** brings the session's window to the front with the session open, in its tab or in
  the Claude sidebar. It never opens a second view of a session.
- **Short turns stay quiet.** A turn under 45 seconds you were watching. The threshold goes from
  15 seconds to 2 minutes (*Announce turns longer than…*).
- **One notification per session.** A newer one replaces the older one, and going back to a
  session clears it. Claude Code's "waiting for your input" a few minutes after a turn is the
  same news as *Done* and is not shown again.

The window that holds the session shows the notification too. Its *Open session* button does
what a click on the system notification does.

## Status bar and session list

*✻* in the status bar counts running and waiting sessions across all VS Code windows and lights
up while one waits for you. Click it for the list:

| | |
| --- | --- |
| **who** | the session's title, or the name you gave its tab |
| **where** | the project it was started in and the window that has it, plus where it works now if it moved to another repository |
| **state** | waiting for you, with what it asks, or running and for how long; running includes background agents still at work after the turn |
| **size** | the model and how much context the session carries |

Pick one to go there. A session no window has open (started in a terminal, or its window was
closed) is listed as such; picking it offers to open its folder.

## Pausing

Pause for 15 minutes, an hour, three hours or until you resume: every notification, or only
the ones inside VS Code. A pause holds in every window and shows as a crossed-out bell in the
status bar. Sessions keep being counted.

## Setup

The setup page opens on first start; *Notify for Claude Code: Set up…* opens it again.

1. **Connect to Claude Code.** Adds four hooks to `~/.claude/settings.json`; nothing else in the
   file changes. With the [claude-notify plugin](plugin.md) installed, its hooks already do this.
2. **Allow notifications.** macOS asks once.
3. **Keep them on screen** (optional). The *Persistent* style keeps a notification until you
   deal with it.
4. **Show them while sharing the screen** (optional). macOS hides notifications in calls and
   recordings unless *When mirroring or sharing the display* is on.
5. **Try it.** Give Claude something that takes longer than 45 seconds and switch to another app.

If a notification does not arrive, *Check that notifications work* names what is missing.

In a remote window (Remote-SSH, Dev Container) the extension also offers the bridge; see
[How it works](how-it-works.md#remote-windows).
