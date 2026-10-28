import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

/**
 * A window on a remote machine: the notifier runs there, beside the sessions, and hands the
 * system notification to the window, whose bridge shows it on the user's computer.
 */
const SCRIPT = new URL('../../hooks/claude-notify.mjs', import.meta.url).pathname
const home = mkdtempSync(join(tmpdir(), 'cn-bridge-'))
const tmp = join(home, 'tmp')
const links = join(home, '.claude', 'claude-notify', 'links')
mkdirSync(links, { recursive: true })
mkdirSync(tmp)
writeFileSync(join(home, '.claude', 'claude-notify.config.json'), JSON.stringify({ enabled: true, minTurnSeconds: 0, language: 'en' }))

async function fakeWindow(name, folders, extra = {}, dir = links) {
  const got = []
  const token = `token-${name}`
  const srv = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      got.push({ path: req.url, body: JSON.parse(raw) })
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
    })
  })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  writeFileSync(join(dir, `${name}.json`), JSON.stringify({ port: srv.address().port, token, pid: process.pid, folders, focusedAt: 1, ...extra }))
  return { got, close: () => srv.close() }
}

const env = (more = {}) => ({ ...process.env, HOME: home, TMPDIR: tmp, CLAUDE_CODE_ENTRYPOINT: 'claude-vscode', CLAUDE_NOTIFY_PLATFORM: 'linux', ...more })
const run = (args, { payload, more } = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, [SCRIPT, ...args], { env: env(more), stdio: ['pipe', 'pipe', 'ignore'] })
  let out = ''
  p.stdout.on('data', (c) => { out += c })
  p.on('close', () => resolve(out.trim()))
  p.stdin.end(payload ? JSON.stringify(payload) : '')
})
const until = async (check) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 50))
  assert.ok(check())
}

let n = 0
const ok = (name) => { n++; console.log('ok  ', name) }

const S = '11111111-2222-4333-8444-555555555555'
const group = `claude-${S}`
const box = await fakeWindow('box', ['/home/me/planner'], { remote: 'ssh-remote' })
const local = await fakeWindow('local', ['/work/app'])

const o = JSON.parse(await run([], { payload: { hook_event_name: 'Stop', session_id: S, cwd: '/home/me/planner' }, more: { CLAUDE_NOTIFY_DRYRUN: '1' } }))
const dry = JSON.parse(await run(['--show', JSON.stringify(o)], { more: { CLAUDE_NOTIFY_DRYRUN: '1' } }))
assert.deepEqual(dry.relay.window, ['/home/me/planner'])
assert.deepEqual(dry.editor.window, ['/home/me/planner'])
ok('a session of a remote window is relayed to it, and still shown inside VS Code')

assert.equal(JSON.parse(await run(['--show', JSON.stringify({ ...o, root: '/work/app', cwd: '/work/app' })], { more: { CLAUDE_NOTIFY_DRYRUN: '1' } })).relay, null)
ok('a session of a local window is not')

await run(['--show', JSON.stringify(o)])
await until(() => box.got.some((r) => r.path === '/relay'))
const relayed = box.got.find((r) => r.path === '/relay').body
assert.equal(relayed.sessionId, S)
assert.equal(relayed.group, group)
assert.equal(local.got.length, 0)
assert.ok(existsSync(join(tmp, 'claude-notify', `relayed-${group}`)))
ok('the window gets the whole notification, and the notifier remembers it went there')

// The window is away — disconnected — when the user writes to the session over SSH.
const boxLink = readFileSync(join(links, 'box.json'), 'utf8')
writeFileSync(join(links, 'box.json'), JSON.stringify({ ...JSON.parse(boxLink), port: 1 }))
await run([], { payload: { hook_event_name: 'UserPromptSubmit', session_id: S, cwd: '/home/me/planner' } })
assert.ok(existsSync(join(tmp, 'claude-notify', `relayed-${group}`)))
ok('with no window to take it back, the notifier keeps trying')

// Meanwhile a window from another computer, for another folder: its answer does not count.
const stranger = await fakeWindow('stranger', ['/home/me/other'], { remote: 'ssh-remote' })
await run([], { payload: { hook_event_name: 'UserPromptSubmit', session_id: S, cwd: '/home/me/planner' } })
assert.ok(existsSync(join(tmp, 'claude-notify', `relayed-${group}`)))
stranger.close()
rmSync(join(links, 'stranger.json'))
ok('nor does another window\'s answer stand for the one it went to')

writeFileSync(join(links, 'box.json'), boxLink)
await run([], { payload: { hook_event_name: 'UserPromptSubmit', session_id: S, cwd: '/home/me/planner' } })
assert.deepEqual(box.got.filter((r) => r.path === '/dismiss').map((r) => r.body), [{ group }])
assert.equal(existsSync(join(tmp, 'claude-notify', `relayed-${group}`)), false)
ok('a new prompt takes it back')

await run([], { payload: { hook_event_name: 'UserPromptSubmit', session_id: S, cwd: '/home/me/planner' } })
assert.equal(box.got.filter((r) => r.path === '/dismiss').length, 1)
ok('and asks only when there is something to take back')

// The user's computer: what --relay shows there, and where its click goes.
const mac = mkdtempSync(join(tmpdir(), 'cn-mac-'))
const kept = join(mac, '.claude', 'claude-notify')
const helper = join(kept, 'Notify for Claude Code.app', 'Contents', 'MacOS', 'notify')
mkdirSync(dirname(helper), { recursive: true })
writeFileSync(helper, '')
writeFileSync(join(kept, 'claude-notify'), '')
const address = 'vscode-remote://ssh-remote%2Bbox/home/me/planner'
const shown = JSON.parse(await run(['--relay', JSON.stringify({ ...relayed, window: address, focusCommand: "'/box/runner' '--focus'" })], {
  more: { HOME: mac, CLAUDE_NOTIFY_PLATFORM: 'darwin', CLAUDE_NOTIFY_DRYRUN: '1' },
}))
assert.equal(shown.cmd, helper)
assert.equal(shown.args[shown.args.indexOf('-execute') + 1], `'${join(kept, 'claude-notify')}' '--focus' '${S}' '/home/me/planner' '--window' '${address}'`)
assert.equal(shown.relay, null)
assert.equal(shown.editor, null)
ok('relayed, it is shown by the app here, and its click runs this computer\'s runner')

mkdirSync(join(kept, 'links'), { recursive: true })
const calls = join(mac, 'cli-calls')
const cli = join(mac, 'code')
writeFileSync(cli, `#!/bin/sh\necho "$@" >> '${calls}'\n`)
chmodSync(cli, 0o755)
const macLinks = join(kept, 'links')
const bridged = await fakeWindow('bridge', ['/home/me/planner'], { bridge: 'ssh-remote', cli, folderUri: address }, macLinks)
// Another machine, the same path: only the address tells them apart.
const other = await fakeWindow('other', ['/home/me/planner'], {
  bridge: 'dev-container', cli, folderUri: 'vscode-remote://dev-container%2Babc/home/me/planner',
}, macLinks)
const onMac = { more: { HOME: mac, CLAUDE_NOTIFY_PLATFORM: 'darwin' } }
assert.equal(await run(['--focus', S, '/home/me/planner', '--window', address], onMac), 'focused')
assert.equal(readFileSync(calls, 'utf8').trim(), `--folder-uri ${address}`)
assert.deepEqual(bridged.got.map((r) => r.path), ['/focus'])
assert.equal(other.got.length, 0)
ok('the click raises the remote window by its address and asks its bridge for the session')

assert.equal(await run(['--focus', S, '/home/me/planner', '--window', 'vscode-remote://ssh-remote%2Bgone/x'], onMac), 'no-window')
ok('a window that is gone is not stood in for by another with the same path')

// Not a UUID: no vscode:// link to fall back on, so nothing is opened on the test machine.
const T = 'local-session'
assert.equal(await run(['--focus', T, '/home/me/planner'], onMac), 'link')
assert.equal(bridged.got.length + other.got.length, 1)
ok('a session of this computer is never sent to a bridge, whatever its path')

for (const w of [box, local, bridged, other]) w.close()
console.log(`\n${n} passed`)
