import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import * as w from './.build/wiring.mjs'

const fresh = () => mkdtempSync(join(tmpdir(), 'cn-home-'))
const settings = (h) => JSON.parse(readFileSync(join(h, '.claude', 'settings.json'), 'utf8'))
const ours = (h) => `"${w.runnerPath(h)}"`
const legacy = (h) => `node "${w.stableScriptPath(h)}"`
let n = 0
const test = (name, fn) => { fn(); n++; console.log('ok  ', name) }

test('empty home: adds the four hooks', () => {
  const h = fresh()
  assert.equal(w.hooksWired(h), false)
  w.wireHooks(h)
  assert.equal(w.hooksWired(h), true)
  for (const e of w.HOOK_EVENTS) assert.equal(settings(h).hooks[e].length, 1)
})

test('leaves other hooks and keys alone; running twice adds nothing', () => {
  const h = fresh(); mkdirSync(join(h, '.claude'))
  const other = { hooks: [{ type: 'command', command: 'other-tool stop' }] }
  writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify({ theme: 'light', hooks: { Stop: [other] } }))
  w.wireHooks(h); w.wireHooks(h)
  const s = settings(h)
  assert.equal(s.theme, 'light')
  assert.equal(s.hooks.Stop.length, 2)
  assert.deepEqual(s.hooks.Stop[0], other)
  assert.equal(s.hooks.Notification.length, 1)
})

test('removal takes only ours and drops events left empty', () => {
  const h = fresh(); mkdirSync(join(h, '.claude'))
  const other = { hooks: [{ type: 'command', command: 'other-tool stop' }] }
  writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [other] } }))
  w.wireHooks(h)
  assert.equal(w.unwireHooks(h), 4)
  const s = settings(h)
  assert.deepEqual(s.hooks.Stop, [other])
  assert.equal('Notification' in s.hooks, false)
  assert.equal(w.unwireHooks(h), 0)
})

test('hooks from before the runner are replaced, not doubled, and removal takes both kinds', () => {
  const h = fresh(); mkdirSync(join(h, '.claude'))
  const other = { type: 'command', command: 'other-tool stop' }
  const old = (cmd) => ({ hooks: [{ type: 'command', command: cmd, timeout: 10 }] })
  writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify({ hooks: {
    Stop: [{ hooks: [other, { type: 'command', command: legacy(h) }] }],
    Notification: [old(legacy(h))],
  } }))
  assert.equal(w.hooksOutdated(h), true)
  w.wireHooks(h)
  assert.equal(w.hooksOutdated(h), false)
  assert.equal(w.hooksWired(h), true)
  const s = settings(h)
  assert.deepEqual(s.hooks.Stop[0].hooks, [other])
  assert.equal(s.hooks.Stop[1].hooks[0].command, ours(h))
  assert.equal(s.hooks.Notification.length, 1)
  // An install that was never migrated still comes out clean.
  writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [old(legacy(h)), old(ours(h))] } }))
  assert.equal(w.unwireHooks(h), 2)
})

test('the runner starts the notifier with the editor runtime, and falls back to node', () => {
  const h = fresh()
  const runtime = join(h, 'fake runtime')
  writeFileSync(runtime, '#!/bin/sh\necho "runtime $ELECTRON_RUN_AS_NODE $*"\n', { mode: 0o755 })
  assert.equal(w.writeRunner(h, runtime), true)
  assert.equal(w.writeRunner(h, runtime), false)
  assert.equal(statSync(w.runnerPath(h)).mode & 0o111, 0o111)
  const viaRuntime = spawnSync(w.runnerPath(h), ['--focus', 'x'], { encoding: 'utf8' })
  assert.equal(viaRuntime.stdout.trim(), `runtime 1 ${w.stableScriptPath(h)} --focus x`)
  // The editor moved: node on PATH runs the script instead.
  mkdirSync(join(h, '.claude', 'claude-notify'), { recursive: true })
  writeFileSync(w.stableScriptPath(h), 'console.log("node", process.argv.slice(2).join(" "))\n')
  w.writeRunner(h, join(h, 'gone'))
  assert.equal(spawnSync(w.runnerPath(h), ['--doctor'], { encoding: 'utf8' }).stdout.trim(), 'node --doctor')
})

/** A Mac on Linux: a sounds folder and a codesign that only records its calls. */
const fakeMac = (h, { sign = 0, verify = 0, sounds = ['Glass.aiff', 'Ping.aiff', 'Basso.aiff'] } = {}) => {
  const soundsDir = join(h, 'System-Sounds')
  mkdirSync(soundsDir, { recursive: true })
  for (const name of sounds) writeFileSync(join(soundsDir, name), `sound ${name}`)
  const calls = []
  const run = (cmd, args) => {
    calls.push([cmd, ...args])
    if (cmd !== 'codesign') return { status: 0 }
    return { status: args[0] === '--verify' ? verify : sign }
  }
  return { soundsDir, calls, deps: { run, soundsDir, codesign: 'codesign', lsregister: join(h, 'no-lsregister') } }
}
const helperBinary = (root) => join(root, 'Contents', 'MacOS', 'notify')
const bundle = (h, body = 'v1') => {
  const bundled = join(h, 'notify-helper')
  mkdirSync(join(bundled, 'Contents', 'MacOS'), { recursive: true })
  mkdirSync(join(bundled, 'Contents', 'Resources'), { recursive: true })
  writeFileSync(helperBinary(bundled), body)
  writeFileSync(join(bundled, 'Contents', 'Info.plist'), '<plist/>')
  writeFileSync(join(bundled, 'Contents', 'Resources', 'done.wav'), 'wav')
  return bundled
}
const stamp = (h) => JSON.parse(readFileSync(w.helperStampPath(h), 'utf8'))
const resources = (h) => readdirSync(join(w.helperPath(h), 'Contents', 'Resources')).sort()

test('the notifying app is not installed where it was not built', () => {
  const h = fresh()
  assert.equal(w.installHelper(join(h, 'notify-helper'), h, fakeMac(h).deps), false)
  assert.equal(existsSync(w.helperStampPath(h)), false)
})

test('installs the app with the system sounds, re-signed, and writes a stamp', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  assert.ok(w.helperPath(h).endsWith('.app'))
  assert.equal(readFileSync(helperBinary(w.helperPath(h)), 'utf8'), 'v1')
  assert.deepEqual(resources(h), ['Basso.aiff', 'Glass.aiff', 'Ping.aiff', 'done.wav'])
  assert.equal(readFileSync(join(w.helperPath(h), 'Contents', 'Resources', 'Glass.aiff'), 'utf8'), 'sound Glass.aiff')
  const signs = mac.calls.filter((c) => c[0] === 'codesign')
  assert.deepEqual(signs[0].slice(1, 6), ['--force', '--sign', '-', '--identifier', 'ru.rayz.notify-for-claude-code'])
  assert.deepEqual(signs[1].slice(1, 3), ['--verify', '--strict'])
  for (const c of signs) assert.ok(!c[c.length - 1].endsWith('.app'), 'the staging folder is not named .app')
  assert.deepEqual(stamp(h).added, ['Glass.aiff', 'Ping.aiff', 'Basso.aiff'])
  assert.equal(stamp(h).fallback, undefined)
  assert.deepEqual(readdirSync(dirname(w.helperPath(h))).filter((n) => n.startsWith('.helper-staging')), [])
  // the bundled app itself is left as it was
  assert.deepEqual(readdirSync(join(bundled, 'Contents', 'Resources')), ['done.wav'])
})

test('a second start with the same bundle writes nothing; a changed one reinstalls', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  const before = readFileSync(w.helperStampPath(h), 'utf8')
  mac.calls.length = 0
  assert.equal(w.installHelper(bundled, h, mac.deps), false)
  assert.equal(mac.calls.length, 0)
  assert.equal(readFileSync(w.helperStampPath(h), 'utf8'), before)
  writeFileSync(helperBinary(bundled), 'v2')
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  assert.equal(readFileSync(helperBinary(w.helperPath(h)), 'utf8'), 'v2')
  assert.notEqual(readFileSync(w.helperStampPath(h), 'utf8'), before)
})

test('an app from before the stamp, or a removed one, is installed again', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  // what 0.3.3 left: the same app, no stamp
  mkdirSync(dirname(w.helperPath(h)), { recursive: true })
  cpSync(bundled, w.helperPath(h), { recursive: true })
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  assert.ok(resources(h).includes('Glass.aiff'))
  rmSync(w.helperPath(h), { recursive: true })
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
})

test('a failed re-sign installs the unmodified app, and is not retried on every start', () => {
  for (const failure of [{ sign: 1 }, { verify: 1 }]) {
    const h = fresh()
    const mac = fakeMac(h, failure)
    const bundled = bundle(h)
    assert.equal(w.installHelper(bundled, h, mac.deps), true)
    assert.deepEqual(resources(h), ['done.wav'])
    assert.deepEqual(stamp(h).added, [])
    assert.ok(stamp(h).fallback)
    assert.equal(w.installHelper(bundled, h, mac.deps), false)
    // a new release tries again, and a success replaces the fallback
    writeFileSync(helperBinary(bundled), 'v2')
    assert.equal(w.installHelper(bundled, h, { ...mac.deps, run: fakeMac(h).deps.run }), true)
    assert.ok(resources(h).includes('Glass.aiff'))
    assert.equal(stamp(h).fallback, undefined)
  }
})

test('a missing codesign also falls back to the unmodified app', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  const run = (cmd) => cmd === 'codesign' ? { status: null, error: new Error('ENOENT') } : { status: 0 }
  assert.equal(w.installHelper(bundled, h, { ...mac.deps, run }), true)
  assert.deepEqual(resources(h), ['done.wav'])
})

test('copies only the system sounds that exist; with none, signs nothing', () => {
  const h = fresh()
  const mac = fakeMac(h, { sounds: ['Glass.aiff'] })
  assert.equal(w.installHelper(bundle(h), h, mac.deps), true)
  assert.deepEqual(resources(h), ['Glass.aiff', 'done.wav'])
  const h2 = fresh()
  const none = fakeMac(h2, { sounds: [] })
  assert.equal(w.installHelper(bundle(h2), h2, none.deps), true)
  assert.deepEqual(resources(h2), ['done.wav'])
  assert.equal(none.calls.filter((c) => c[0] === 'codesign').length, 0)
})

test('a macOS update that adds a system sound installs the app again', () => {
  const h = fresh()
  const mac = fakeMac(h, { sounds: ['Glass.aiff'] })
  const bundled = bundle(h)
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  writeFileSync(join(mac.soundsDir, 'Ping.aiff'), 'ping')
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  assert.ok(resources(h).includes('Ping.aiff'))
})

test('an app another version put in is replaced, though the stamp matches this one', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  // 0.3.3 in the other extension (or the bridge) copies its own app over this one
  rmSync(w.helperPath(h), { recursive: true })
  cpSync(bundle(fresh(), 'v0'), w.helperPath(h), { recursive: true })
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  assert.equal(readFileSync(helperBinary(w.helperPath(h)), 'utf8'), 'v1')
  assert.ok(resources(h).includes('Glass.aiff'))
})

test('a macOS update that changes a system sound installs the app again', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  writeFileSync(join(mac.soundsDir, 'Glass.aiff'), 'a new glass')
  assert.equal(w.installHelper(bundled, h, mac.deps), true)
  assert.equal(readFileSync(join(w.helperPath(h), 'Contents', 'Resources', 'Glass.aiff'), 'utf8'), 'a new glass')
})

test('an install cut short is cleaned up later; one at work is left alone', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const dir = dirname(w.helperPath(h))
  mkdirSync(join(dir, '.helper-staging-1-1', 'Contents'), { recursive: true })
  mkdirSync(join(dir, '.helper-staging-2-2'), { recursive: true })
  const old = (Date.now() - 3600_000) / 1000
  utimesSync(join(dir, '.helper-staging-1-1'), old, old)
  w.installHelper(bundle(h), h, mac.deps)
  assert.deepEqual(readdirSync(dir).filter((n) => n.startsWith('.helper-staging')), ['.helper-staging-2-2'])
})

test('re-signs with the identifier the bundle names', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const bundled = bundle(h)
  writeFileSync(join(bundled, 'Contents', 'Info.plist'), '<plist><dict><key>CFBundleIdentifier</key>\n  <string>com.example.other</string></dict></plist>')
  w.installHelper(bundled, h, mac.deps)
  const sign = mac.calls.find((c) => c[0] === 'codesign' && c[1] === '--force')
  assert.equal(sign[sign.indexOf('--identifier') + 1], 'com.example.other')
})

test('lsregister registers the installed app where it exists', () => {
  const h = fresh()
  const mac = fakeMac(h)
  const lsregister = join(h, 'lsregister')
  writeFileSync(lsregister, '')
  w.installHelper(bundle(h), h, { ...mac.deps, lsregister })
  assert.deepEqual(mac.calls.at(-1), [lsregister, '-f', w.helperPath(h)])
})

test('refuses to rewrite an unreadable settings.json', () => {
  const h = fresh(); mkdirSync(join(h, '.claude'))
  writeFileSync(join(h, '.claude', 'settings.json'), '{ not json')
  assert.throws(() => w.wireHooks(h))
  assert.equal(readFileSync(join(h, '.claude', 'settings.json'), 'utf8'), '{ not json')
})

test('detects the Claude Code plugin', () => {
  const h = fresh()
  assert.equal(w.pluginInstalled(h), false)
  mkdirSync(join(h, '.claude', 'plugins'), { recursive: true })
  writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'claude-notify@rayzru': [{}] } }))
  assert.equal(w.pluginInstalled(h), true)
})

test('a plugin switched off brings no hooks, so it does not count', () => {
  const h = fresh()
  mkdirSync(join(h, '.claude', 'plugins'), { recursive: true })
  writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'claude-notify@rayzru': [{}] } }))
  writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'claude-notify@rayzru': false } }))
  assert.equal(w.pluginInstalled(h), false)
})

test('copies the script only when it changed', () => {
  const h = fresh(); const src = join(h, 'bundled.mjs'); writeFileSync(src, '// v1')
  assert.equal(w.installScript(src, h), true)
  assert.equal(w.installScript(src, h), false)
  writeFileSync(src, '// v2')
  assert.equal(w.installScript(src, h), true)
  assert.equal(readFileSync(w.stableScriptPath(h), 'utf8'), '// v2')
})

test('config: writes our keys, keeps the rest', () => {
  const h = fresh(); mkdirSync(join(h, '.claude'))
  writeFileSync(w.configPath(h), JSON.stringify({ language: 'ru', enabled: false }))
  w.writeConfig(h, { enabled: true, minTurnSeconds: 30, events: ['done'], style: 'banner', sound: false })
  const c = JSON.parse(readFileSync(w.configPath(h), 'utf8'))
  assert.equal(c.language, 'ru'); assert.equal(c.enabled, true); assert.equal(c.minTurnSeconds, 30)
  assert.deepEqual(c.events, { done: true, error: false, waitingInput: false })
})

test('full removal leaves nothing behind', () => {
  const h = fresh(); const tmp = fresh(); const src = join(h, 'b.mjs'); writeFileSync(src, '//')
  w.installScript(src, h); w.wireHooks(h); w.writeRunner(h, '/no/such/editor')
  w.writeConfig(h, { enabled: true, minTurnSeconds: 30, events: ['done'], style: 'alert', sound: true })
  writeFileSync(w.legacyLinkPath(h), '{}')
  mkdirSync(w.linksDir(h), { recursive: true }); writeFileSync(w.linkPath(h, 123), '{}')
  mkdirSync(w.sessionsDir(h), { recursive: true }); writeFileSync(join(w.sessionsDir(h), 's.json'), '{}')
  w.setPause(h, 'all', Infinity)
  writeFileSync(join(h, '.claude', 'claude-notify', 'debug.log'), 'history')
  mkdirSync(w.stateDir(tmp)); writeFileSync(join(w.stateDir(tmp), 'turn-x'), '1')
  assert.equal(w.removeEverything(h, tmp), 4)
  assert.equal(existsSync(join(h, '.claude', 'claude-notify')), false)
  assert.equal(existsSync(w.legacyLinkPath(h)), false)
  assert.equal(existsSync(w.stateDir(tmp)), false)
  assert.equal(existsSync(w.configPath(h)), false)
  assert.equal(w.hooksWired(h), false)
})

test('removal keeps the config while the claude-notify plugin still reads it', () => {
  const h = fresh(); const tmp = fresh()
  w.writeConfig(h, { enabled: true, minTurnSeconds: 30, events: ['done'], style: 'alert', sound: true })
  mkdirSync(join(h, '.claude', 'plugins'), { recursive: true })
  writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'claude-notify@rayzru': [{}] } }))
  w.removeEverything(h, tmp)
  assert.equal(existsSync(w.configPath(h)), true)
})

test('a pause holds until its time, or until resumed, for each scope on its own', () => {
  const h = fresh()
  assert.equal(w.pausedUntil(h, 'all'), 0)
  w.setPause(h, 'all', 2_000)
  w.setPause(h, 'editor', Infinity)
  assert.equal(w.pausedUntil(h, 'all', 1_000), 2_000)
  assert.equal(w.pausedUntil(h, 'all', 3_000), 0)
  assert.equal(w.pausedUntil(h, 'editor', 3_000), Infinity)
  // The notifier reads the same file: until resumed is stored as true, not as a number.
  assert.deepEqual(JSON.parse(readFileSync(w.pausePath(h), 'utf8')), { all: 2_000, editor: true })
  w.setPause(h, 'editor', null)
  assert.equal(w.pausedUntil(h, 'editor'), 0)
  assert.equal(w.pausedUntil(h, 'all', 1_000), 2_000)
})

console.log(`\n${n} passed`)
