// Refreshes app/year2 from the Year 2 repository. Run this whenever Year 2 changes on the website and the phone app
// should carry the change:   npm run pull-year2 [path to a local copy of anchored-steps-year2]
// With no path it looks for a sibling folder (../../anchored-steps-year2), then clones from GitHub.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { APP_DIR, REPO } from './vite.shared.mjs'

const REMOTE = 'https://github.com/eloraradianceco-art/anchored-steps-year2.git'
let src = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(REPO, '..', 'anchored-steps-year2')
if (!fs.existsSync(path.join(src, 'src', 'App_Y2.jsx'))) {
  src = fs.mkdtempSync(path.join(os.tmpdir(), 'year2-'))
  execFileSync('git', ['clone', '--depth', '1', REMOTE, src], { stdio: 'inherit' })
}
const git = (...a) => execFileSync('git', ['-C', src, ...a]).toString().trim()
const dirty = git('status', '--porcelain')
if (dirty) throw new Error('The Year 2 folder has uncommitted changes; commit them first so the copy matches a real commit.')

const dest = path.join(APP_DIR, 'year2')
fs.rmSync(dest, { recursive: true, force: true })
fs.mkdirSync(dest, { recursive: true })
for (const item of ['index.html', 'src', 'public']) fs.cpSync(path.join(src, item), path.join(dest, item), { recursive: true })
fs.writeFileSync(path.join(dest, 'SOURCE.md'), `# Copy of Anchored Steps Year 2\n\nDo not edit these files here. Change Year 2 in its own repository (anchored-steps-year2), then run \`npm run pull-year2\` in app/.\n\n- Commit: ${git('rev-parse', 'HEAD')}\n- Committed: ${git('log', '-1', '--format=%cI')}\n- Subject: ${git('log', '-1', '--format=%s')}\n`)
console.log('app/year2 now matches', git('rev-parse', '--short', 'HEAD'))
