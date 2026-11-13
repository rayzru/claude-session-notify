// On a Mac only, after the build: installs the app built into dist/ with the real codesign and
// the system's own sounds, into a scratch home, and checks the result is sealed. CI runs it on
// macOS; elsewhere it says why it skipped.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { platform, tmpdir } from 'node:os'
import { join } from 'node:path'
import * as w from './.build/wiring.mjs'

const bundled = 'dist/notify-helper'
if (platform() !== 'darwin' || !existsSync(join(bundled, 'Contents', 'MacOS', 'notify'))) {
  console.log('skip: needs macOS and the app built into dist/ (npm run build)')
  process.exit(0)
}

const home = mkdtempSync(join(tmpdir(), 'cn-mac-'))
const deps = { lsregister: join(home, 'no-lsregister') } // keep the scratch copy out of LaunchServices
assert.equal(w.installHelper(bundled, home, deps), true)
const app = w.helperPath(home)
const stamp = JSON.parse(readFileSync(w.helperStampPath(home), 'utf8'))
console.log('stamp', JSON.stringify({ ...stamp, sounds: Object.keys(stamp.sounds) }))

assert.equal(stamp.fallback, undefined, `fell back: ${stamp.fallback}`)
assert.deepEqual(stamp.added, ['Glass.aiff', 'Ping.aiff', 'Basso.aiff'])
const resources = readdirSync(join(app, 'Contents', 'Resources')).sort()
for (const name of ['Basso.aiff', 'Glass.aiff', 'Ping.aiff', 'done.wav', 'error.wav', 'waiting.wav']) {
  assert.ok(resources.includes(name), `${name} in Resources: ${resources}`)
}

const verify = spawnSync('codesign', ['--verify', '--strict', '--verbose=2', app], { encoding: 'utf8' })
assert.equal(verify.status, 0, verify.stderr)
const info = spawnSync('codesign', ['-dv', app], { encoding: 'utf8' })
assert.match(info.stderr, /Identifier=ru\.rayz\.notify-for-claude-code/)
console.log('ok   the installed app carries the system sounds and its seal holds')

for (const name of ['Glass.aiff', 'Ping.aiff', 'Basso.aiff']) {
  const fmt = spawnSync('afinfo', [join(app, 'Contents', 'Resources', name)], { encoding: 'utf8' })
  console.log(name, (fmt.stdout.match(/Data format:.*$/m) || ['?'])[0])
}

assert.equal(w.installHelper(bundled, home, deps), false)
console.log('ok   and a second start leaves it alone')
