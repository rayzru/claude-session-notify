import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import * as vscode from 'vscode'
import { installHelper, installScript, linkPath, linksDir, runnerPath, writeRunner } from './wiring'
import { notifyStatus, openNotificationSettings, runHelper } from './macos'

/**
 * The bridge: the half of Notify for Claude Code that stays on the computer in front of the
 * user when a window works on a remote machine — over SSH, in WSL or a container. There
 * Claude Code, its hooks and the extension itself all run remotely, and the remote machine
 * has no screen to show a notification on. VS Code carries commands between a window's two
 * extension hosts, so the extension hands each notification over by command; this side
 * shows it with the notifying app, as the notifier would on a Mac of its own.
 *
 * A click goes back the way the notifier's own clicks go: the notification runs the
 * notifier here, which finds this window by its link file, raises it, and asks over the
 * loopback socket for the session; this side passes that on to the extension by command.
 *
 * In a window that is not remote the extension itself runs here, and the bridge stays idle.
 */
const HOME = homedir()
const LINK_FILE = linkPath(HOME, process.pid)

let server: Server | undefined
let output: vscode.OutputChannel | undefined
let linkInfo: { port: number; token: string } | undefined

function log(line: string): void {
  output?.appendLine(`${new Date().toISOString().slice(11, 19)}  ${line}`)
}

/** Starts the notifier here, detached: on Linux it stays to wait for a click. */
function runNotifier(args: string[]): boolean {
  if (!existsSync(runnerPath(HOME))) {
    log('the notifier is not installed here yet')
    return false
  }
  try {
    const child = spawn(runnerPath(HOME), args, { detached: true, stdio: 'ignore' })
    child.on('error', (err) => log(`could not start the notifier: ${String(err)}`))
    child.unref()
    return true
  } catch (err) {
    log(`could not start the notifier: ${String(err)}`)
    return false
  }
}

/** This window's remote address, which a click finds it by: its folder's, or its workspace's. */
function address(): string {
  const workspaceFile = vscode.workspace.workspaceFile
  if (workspaceFile && workspaceFile.scheme !== 'untitled') return workspaceFile.toString()
  return vscode.workspace.workspaceFolders?.[0]?.uri.toString() || ''
}

/** The notification as the remote notifier composed it, and where it came from. */
function present(o: unknown): boolean {
  if (!vscode.env.remoteName || !o || typeof o !== 'object') return false
  return runNotifier(['--relay', JSON.stringify({ ...o, window: address() })])
}

function dismiss(group: unknown): boolean {
  if (!vscode.env.remoteName || typeof group !== 'string' || !group) return false
  return runNotifier(['--dismiss', group])
}

/**
 * VS Code's command line, which can name a remote folder and so raise the window that has
 * it open: `code`, `code-insiders`, `cursor` — whichever this editor ships.
 */
function cliPath(): string | undefined {
  const dir = join(vscode.env.appRoot, 'bin')
  try {
    const names = readdirSync(dir)
      .filter((name) => process.platform === 'win32' ? name.endsWith('.cmd') : !name.includes('.'))
      .filter((name) => !name.includes('tunnel'))
      .sort((a, b) => a.length - b.length)
    return names.length ? join(dir, names[0]) : undefined
  } catch {
    return undefined
  }
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 64_000) req.destroy()
    })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

function startServer(token: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.headers['x-claude-notify-token'] !== token) {
        res.writeHead(403).end()
        return
      }
      const body = await readBody(req)
      if (req.url === '/focus') {
        let ok = false
        try {
          ok = await vscode.commands.executeCommand<boolean>('claudeNotify.focusSession', String(body.session || '')) === true
        } catch (err) {
          log(`the extension could not focus ${String(body.session)}: ${String(err)}`)
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok }))
        return
      }
      // Toasts inside VS Code are the extension's, shown on the remote side already.
      res.writeHead(404).end()
    })
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address()
      if (address && typeof address === 'object') {
        server = srv
        resolve(address.port)
      } else reject(new Error('no port'))
    })
  })
}

/**
 * The same link file a window of the extension writes, so the notifier treats this window
 * like any other. Its folders are the remote paths, which is how the sessions name them;
 * the remote addresses and the command line are what raise it.
 */
function writeLink(): void {
  if (!linkInfo) return
  const folders = vscode.workspace.workspaceFolders || []
  const workspaceFile = vscode.workspace.workspaceFile
  try {
    mkdirSync(linksDir(HOME), { recursive: true })
    writeFileSync(LINK_FILE, JSON.stringify({
      ...linkInfo,
      pid: process.pid,
      folders: folders.map((f) => f.uri.path),
      folderUri: folders[0]?.uri.toString(),
      workspaceUri: workspaceFile && workspaceFile.scheme !== 'untitled' ? workspaceFile.toString() : undefined,
      cli: cliPath(),
      appName: vscode.env.appName,
      bridge: vscode.env.remoteName,
      focusedAt: vscode.window.state.focused ? Date.now() : 0,
    }, null, 2), { mode: 0o600 })
    chmodSync(LINK_FILE, 0o600)
  } catch (err) {
    log(`could not write the link file: ${String(err)}`)
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  output = vscode.window.createOutputChannel('Notify for Claude Code — Bridge')
  context.subscriptions.push(output)

  if (vscode.env.remoteName) {
    try {
      // The notifier, its runner and the notifying app, at the same fixed paths the
      // extension uses on a computer of its own: whichever came last is current.
      if (installScript(context.asAbsolutePath(join('dist', 'claude-notify.mjs')), HOME)) log('notifier script updated')
      if (writeRunner(HOME, process.execPath)) log('runner updated')
      if (process.platform === 'darwin' && installHelper(context.asAbsolutePath(join('dist', 'notify-helper')), HOME)) {
        log('notifying app installed')
      }
    } catch (err) {
      log(`could not install the notifier: ${String(err)}`)
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeNotifyBridge.present', present),
    vscode.commands.registerCommand('claudeNotifyBridge.dismiss', dismiss),
    vscode.commands.registerCommand('claudeNotifyBridge.status', () => notifyStatus(HOME)),
    vscode.commands.registerCommand('claudeNotifyBridge.authorize', () => runHelper(HOME, ['-authorize'])),
    vscode.commands.registerCommand('claudeNotifyBridge.openSettings', (page: unknown) =>
      openNotificationSettings(page === 'sharing' ? 'sharing' : 'app', log)),
  )

  if (!vscode.env.remoteName) {
    log('a local window: the extension shows notifications here itself')
    return
  }
  try {
    const token = randomBytes(24).toString('hex')
    linkInfo = { port: await startServer(token), token }
    writeLink()
    log(`bridging ${vscode.env.remoteName}; listening on 127.0.0.1:${linkInfo.port}`)
  } catch (err) {
    log(`could not start the listener: ${String(err)} — clicks fall back to vscode:// links`)
  }
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => { if (state.focused) writeLink() }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => writeLink()),
  )
}

export function deactivate(): void {
  server?.close()
  try { rmSync(LINK_FILE, { force: true }) } catch {}
}
