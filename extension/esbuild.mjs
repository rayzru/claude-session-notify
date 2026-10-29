import { build, context } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'

const watch = process.argv.includes('--watch')
const options = {
  entryPoints: ['src/extension.ts', 'src/uninstall.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: watch,
  minify: !watch,
}
// The bridge: a package of its own, for the computer in front of the user (src/bridge.ts).
const bridgeOptions = { ...options, entryPoints: ['src/bridge.ts'], outdir: 'bridge/dist' }

// One copy of the notifier, shared with the Claude Code plugin next door.
mkdirSync('dist', { recursive: true })
copyFileSync('../hooks/claude-notify.mjs', 'dist/claude-notify.mjs')
mkdirSync('bridge/dist', { recursive: true })
mkdirSync('bridge/media', { recursive: true })
copyFileSync('../hooks/claude-notify.mjs', 'bridge/dist/claude-notify.mjs')
copyFileSync('LICENSE', 'bridge/LICENSE')
copyFileSync('media/icon.png', 'bridge/media/icon.png')

/**
 * The macOS notifying app. It takes half a minute to build, so only when its sources or
 * the version changed. Elsewhere there is no compiler for it, and the package goes without.
 */
function buildHelper() {
  if (process.platform !== 'darwin') return console.log('not on macOS: the notifying app is left out')
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version
  const out = 'dist/notify-helper'
  const binary = `${out}/Contents/MacOS/notify`
  const sources = ['native/macos/main.swift', 'native/macos/Info.plist', 'native/macos/AppIcon.icns', 'native/macos/build.sh']
  const fresh = existsSync(binary)
    && readFileSync(`${out}/Contents/Info.plist`, 'utf8').includes(`<string>${version}</string>`)
    && sources.every((file) => statSync(file).mtimeMs <= statSync(binary).mtimeMs)
  if (fresh) return
  const result = spawnSync('sh', ['native/macos/build.sh', out, version], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('building the notifying app failed')
}
if (!watch) buildHelper()
// The bridge shows the notifications, so it carries the same app.
rmSync('bridge/dist/notify-helper', { recursive: true, force: true })
if (existsSync('dist/notify-helper')) cpSync('dist/notify-helper', 'bridge/dist/notify-helper', { recursive: true })

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  await (await context(bridgeOptions)).watch()
  console.log('watching')
} else {
  await build(options)
  await build(bridgeOptions)
  console.log('built dist/ and bridge/dist/')
}
