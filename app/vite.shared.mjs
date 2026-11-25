// Every part of the phone app (front page, Year 1, Year 2) takes its packages from app/node_modules, so the build
// needs one `npm ci` here and nothing installed at the repo root or in the Year 2 copy.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const APP_DIR = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(APP_DIR, '..')
const mods = path.join(APP_DIR, 'node_modules')
export const alias = [
  { find: /^(react|react-dom|@supabase\/supabase-js|html-to-image)(\/.*)?$/, replacement: path.join(mods, '$1') + '$2' },
]
