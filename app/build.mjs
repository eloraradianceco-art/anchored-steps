// Builds the Anchored Steps phone app into app/dist:
//   /index.html          the front page (app/src/hub.jsx)
//   /bridge.js           window.ERApp, loaded first on every page (app/src/bridge.js)
//   /year1/…             Year 1, from this repo's own source (../src, ../public, ../index.html)
//   /year2/…             Year 2, from the copy in app/year2 (refresh it with `npm run pull-year2`)
// Run from app/:  npm ci && npm run build      Then: npx cap sync ios
import { build } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { APP_DIR, REPO } from './vite.shared.mjs'

const dist = path.join(APP_DIR, 'dist')
const years = [
  { name: 'Year 1', root: REPO, base: '/year1/', out: path.join(dist, 'year1') },
  { name: 'Year 2', root: path.join(APP_DIR, 'year2'), base: '/year2/', out: path.join(dist, 'year2') },
]
if (!fs.existsSync(path.join(APP_DIR, 'year2', 'index.html'))) throw new Error('app/year2 is missing. Run: npm run pull-year2')

console.log('\n— Front page')
await build({ configFile: path.join(APP_DIR, 'vite.config.mjs'), logLevel: 'warn' })

for (const y of years) {
  console.log(`— ${y.name}`)
  Object.assign(process.env, { YEAR_ROOT: y.root, YEAR_BASE: y.base, YEAR_OUT: y.out })
  await build({ configFile: path.join(APP_DIR, 'vite.year.config.mjs'), logLevel: 'warn' })

  // The year's page loads the bridge before its own code, so window.ERApp exists when the app starts.
  const file = path.join(y.out, 'index.html')
  let html = fs.readFileSync(file, 'utf8')
  const at = html.indexOf('<script type="module"')
  if (at < 0) throw new Error(`${y.name}: no module script found in its page`)
  html = html.slice(0, at) + '<script type="module" src="/bridge.js"></script>\n    ' + html.slice(at)
  // Website-only pieces that mean nothing inside the app
  html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '')
  fs.writeFileSync(file, html)
  for (const f of ['sw.js', 'manifest.json']) fs.rmSync(path.join(y.out, f), { force: true })
  // Everything the page points at inside its own folder must exist
  for (const m of html.matchAll(/(?:src|href)="(\/year[12]\/[^"#?]+)"/g)) {
    if (!fs.existsSync(path.join(dist, m[1]))) throw new Error(`${y.name}: ${m[1]} is missing from the build`)
  }
}
if (!fs.existsSync(path.join(dist, 'bridge.js'))) throw new Error('bridge.js was not built')
console.log('\nBuilt app/dist: front page, Year 1, Year 2.\n')
