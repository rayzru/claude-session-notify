import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { helperPath } from './wiring'

/**
 * What only the computer in front of the user can answer: may the notifying app notify, how
 * long its notifications stay, are they hidden while the screen is shared. The extension
 * asks here when it runs on that computer, and through the bridge when it runs on a remote
 * machine. No vscode API, so the bridge shares it as it is.
 */

export const HELPER_ID = 'ru.rayz.notify-for-claude-code'

export const helperBinary = (home: string) => join(helperPath(home), 'Contents', 'MacOS', 'notify')

export type HelperResult = { code: number | null; out: string }

/** What the setup page and the doctor need to know about this computer. */
export type NotifyStatus = HelperResult & { platform: string; hiddenWhileSharing: boolean | null }

/** Runs the notifying app; resolves with its exit code and what it printed. */
export function runHelper(home: string, args: string[]): Promise<HelperResult> {
  return new Promise((resolve) => {
    const binary = helperBinary(home)
    if (!existsSync(binary)) return resolve({ code: null, out: 'not installed' })
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (c) => { out += c })
    child.stderr.on('data', (c) => { out += c })
    child.on('close', (code) => resolve({ code, out: out.trim() }))
    child.on('error', (err) => resolve({ code: null, out: String(err) }))
  })
}

/**
 * macOS hides every notification while the screen is mirrored, shared or recorded, unless
 * "When mirroring or sharing the display" is on — in a call or a demo none would show.
 * Read through cfprefsd: the file on disk lags behind the switch. null when it cannot tell.
 */
export function hiddenWhileSharing(): Promise<boolean | null> {
  if (process.platform !== 'darwin') return Promise.resolve(false)
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-c',
      'defaults export com.apple.ncprefs - | plutil -extract dnd_prefs raw -o - - | base64 -D | plutil -convert json -o - -',
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    child.stdout.on('data', (c) => { out += c })
    child.on('close', () => {
      try { resolve(JSON.parse(out).dndMirrored === true) } catch { resolve(null) }
    })
    child.on('error', () => resolve(null))
  })
}

export async function notifyStatus(home: string): Promise<NotifyStatus> {
  const status = process.platform === 'darwin' ? await runHelper(home, ['-status']) : { code: 0, out: '' }
  return { platform: process.platform, ...status, hiddenWhileSharing: await hiddenWhileSharing() }
}

/**
 * System Settings → Notifications: `app` goes straight to our app's page (a macOS that
 * ignores the id opens the list), `sharing` to the list, where the switch for shared
 * screens is.
 */
export function openNotificationSettings(page: 'app' | 'sharing', log: (line: string) => void): void {
  const url = page === 'app'
    ? `x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=${HELPER_ID}`
    : 'x-apple.systempreferences:com.apple.Notifications-Settings.extension'
  spawn('open', [url], { stdio: 'ignore' })
    .on('error', (err) => log(`could not open System Settings: ${String(err)}`))
}
